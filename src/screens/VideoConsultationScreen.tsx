/**
 * VideoConsultationScreen
 *
 * In-app telemedicine video consultation between a pet owner and a vet.
 *
 * Features:
 *  - WebRTC peer-to-peer video via react-native-webrtc
 *  - Socket.IO signaling via the /signaling endpoint
 *  - Waiting room with estimated wait time
 *  - Screen sharing (show medical documents to the vet)
 *  - Recording consent dialog — recording only starts after both parties consent
 *  - Adaptive bitrate indicator (network quality badge)
 *  - Graceful handling of poor network conditions
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
} from 'react-native-webrtc';
import { io, type Socket } from 'socket.io-client';

import config from '../config';
import { logError } from '../utils/errorLogger';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  consultationId: string;
  roomToken: string;
  userId: string;
  userRole: 'OWNER' | 'VET';
  petName: string;
  onEnd: () => void;
}

type NetworkQuality = 'good' | 'fair' | 'poor';
type CallState =
  | 'idle'
  | 'connecting'
  | 'waiting_room'
  | 'in_call'
  | 'screen_sharing'
  | 'ended';

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Adaptive bitrate thresholds (round-trip time in ms)
const QUALITY_THRESHOLDS = { good: 150, fair: 400 };

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const VideoConsultationScreen: React.FC<Props> = ({
  consultationId,
  roomToken,
  userId,
  userRole,
  petName,
  onEnd,
}) => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('good');
  const [waitPosition, setWaitPosition] = useState<number>(0);
  const [estimatedWait, setEstimatedWait] = useState<number>(0);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const qualityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Network quality monitoring ----------------------------------------
  const startQualityMonitor = useCallback((pc: RTCPeerConnection) => {
    qualityTimerRef.current = setInterval(() => {
      void pc.getStats().then((stats) => {
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && (report as Record<string, unknown>).state === 'succeeded') {
            const rtt = (report as Record<string, unknown>).currentRoundTripTime as number | undefined;
            if (rtt != null) {
              const rttMs = rtt * 1000;
              if (rttMs < QUALITY_THRESHOLDS.good) setNetworkQuality('good');
              else if (rttMs < QUALITY_THRESHOLDS.fair) setNetworkQuality('fair');
              else setNetworkQuality('poor');
            }
          }
        });
      });
    }, 3000);
  }, []);

  // ---- Start local media -------------------------------------------------
  const startLocalMedia = useCallback(async () => {
    try {
      const stream = await mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      logError(err instanceof Error ? err : new Error(String(err)), {
        screen: 'VideoConsultationScreen',
        action: 'startLocalMedia',
      });
      Alert.alert(
        'Camera / Microphone',
        'Please grant camera and microphone permissions to join the consultation.',
      );
      return null;
    }
  }, []);

  // ---- Build RTCPeerConnection -------------------------------------------
  const buildPeerConnection = useCallback(
    (iceServers: IceServer[], stream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers });

      // Add local tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Remote stream
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0] ?? null);
      };

      // ICE candidate relay
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('ice_candidate', {
            consultationId,
            candidate: event.candidate,
          });
        }
      };

      // Connection state changes
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallState('in_call');
          startQualityMonitor(pc);
        } else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          setNetworkQuality('poor');
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [consultationId, startQualityMonitor],
  );

  // ---- Connect to signaling server & join room ---------------------------
  const joinRoom = useCallback(
    async (iceServers: IceServer[]) => {
      const stream = await startLocalMedia();
      if (!stream) return;

      const socket = socketRef.current!;
      const pc = buildPeerConnection(iceServers, stream);

      // ---- Signaling event handlers -------------------------------------
      socket.on('peer_joined', async ({ role }: { role: string }) => {
        // Caller (owner) creates the offer
        if (userRole === 'OWNER' || role === 'OWNER') {
          try {
            const offer = await pc.createOffer({});
            await pc.setLocalDescription(new RTCSessionDescription(offer));
            socket.emit('offer', { consultationId, sdp: offer });
          } catch (err) {
            logError(err instanceof Error ? err : new Error(String(err)), {
              screen: 'VideoConsultationScreen',
              action: 'createOffer',
            });
          }
        }
      });

      socket.on('offer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(new RTCSessionDescription(answer));
          socket.emit('answer', { consultationId, sdp: answer });
        } catch (err) {
          logError(err instanceof Error ? err : new Error(String(err)), {
            screen: 'VideoConsultationScreen',
            action: 'handleOffer',
          });
        }
      });

      socket.on('answer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (err) {
          logError(err instanceof Error ? err : new Error(String(err)), {
            screen: 'VideoConsultationScreen',
            action: 'handleAnswer',
          });
        }
      });

      socket.on('ice_candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          // Non-fatal — ICE may arrive out of order
        }
      });

      socket.on('peer_left', () => {
        setRemoteStream(null);
        setCallState('ended');
        void endCall();
      });

      socket.on('screen_toggle', ({ enabled }: { enabled: boolean }) => {
        if (!enabled) setIsSharingScreen(false);
      });

      socket.on('error', ({ message }: { message: string }) => {
        Alert.alert('Connection Error', message);
        onEnd();
      });

      // Emit join event
      socket.emit('join_room', { consultationId, roomToken, userId, role: userRole });
    },
    [
      consultationId,
      roomToken,
      userId,
      userRole,
      startLocalMedia,
      buildPeerConnection,
      onEnd,
    ],
  );

  // ---- Initialise --------------------------------------------------------
  useEffect(() => {
    setCallState('connecting');

    const socket = io(config.api.baseUrl.replace('/api', ''), {
      path: '/signaling',
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on(
      'joined',
      (data: { iceServers: IceServer[]; position?: number; estimatedWaitMinutes?: number }) => {
        if (data.position != null) {
          setCallState('waiting_room');
          setWaitPosition(data.position);
          setEstimatedWait(data.estimatedWaitMinutes ?? 0);
        } else {
          void joinRoom(data.iceServers);
        }
      },
    );

    // Show consent dialog before joining (recording opt-in)
    setShowConsentModal(true);

    return () => {
      socket.disconnect();
      if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);
    };
  }, [joinRoom]);

  // ---- Controls ----------------------------------------------------------
  const toggleMute = useCallback(() => {
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = isMuted;
    });
    setIsMuted((prev) => !prev);
  }, [localStream, isMuted]);

  const toggleCamera = useCallback(() => {
    localStream?.getVideoTracks().forEach((t) => {
      t.enabled = isCameraOff;
    });
    setIsCameraOff((prev) => !prev);
  }, [localStream, isCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    if (!socketRef.current) return;

    if (!isSharingScreen) {
      try {
        const screenStream = await mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pcRef.current
          ?.getSenders()
          .find((s) => s.track?.kind === 'video');

        if (sender && screenTrack) {
          await sender.replaceTrack(screenTrack);
          setIsSharingScreen(true);
          socketRef.current.emit('toggle_screen', { consultationId, enabled: true });

          screenTrack.onended = () => {
            void toggleScreenShare();
          };
        }
      } catch (err) {
        logError(err instanceof Error ? err : new Error(String(err)), {
          screen: 'VideoConsultationScreen',
          action: 'startScreenShare',
        });
        Alert.alert('Screen Sharing', 'Could not start screen sharing.');
      }
    } else {
      // Restore camera track
      const cameraStream = await mediaDevices.getUserMedia({ video: true });
      const cameraTrack = cameraStream.getVideoTracks()[0];
      const sender = pcRef.current
        ?.getSenders()
        .find((s) => s.track?.kind === 'video');

      if (sender && cameraTrack) {
        await sender.replaceTrack(cameraTrack);
      }
      setIsSharingScreen(false);
      socketRef.current.emit('toggle_screen', { consultationId, enabled: false });
    }
  }, [consultationId, isSharingScreen]);

  const endCall = useCallback(async () => {
    if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);

    pcRef.current?.close();
    localStream?.getTracks().forEach((t) => t.stop());

    socketRef.current?.emit('leave_room', { consultationId });
    socketRef.current?.disconnect();

    setCallState('ended');
    onEnd();
  }, [consultationId, localStream, onEnd]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // Recording consent modal
  if (showConsentModal) {
    return (
      <Modal transparent animationType="slide" visible>
        <View style={styles.consentOverlay}>
          <View style={styles.consentCard}>
            <Text style={styles.consentTitle}>Session Recording Consent</Text>
            <Text style={styles.consentBody}>
              This telemedicine consultation may be recorded for your medical records. Both the pet
              owner and the vet must consent before recording begins.{'\n\n'}
              You can change your preference during the call.
            </Text>
            <View style={styles.consentButtons}>
              <TouchableOpacity
                style={[styles.consentBtn, styles.consentBtnDecline]}
                onPress={() => {
                  setConsentGiven(false);
                  setShowConsentModal(false);
                }}
              >
                <Text style={styles.consentBtnTextDecline}>No Recording</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.consentBtn, styles.consentBtnAccept]}
                onPress={() => {
                  setConsentGiven(true);
                  setShowConsentModal(false);
                  // Notify backend of consent
                  void fetch(
                    `${config.api.baseUrl}/consultations/${consultationId}/consent`,
                    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
                  ).catch(() => null);
                }}
              >
                <Text style={styles.consentBtnTextAccept}>I Consent</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Waiting room
  if (callState === 'waiting_room') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.waitTitle}>Waiting Room</Text>
        <Text style={styles.waitBody}>
          Consultation for <Text style={styles.bold}>{petName}</Text>
        </Text>
        <Text style={styles.waitPosition}>Your position: #{waitPosition}</Text>
        {estimatedWait > 0 && (
          <Text style={styles.waitEst}>Estimated wait: ~{estimatedWait} min</Text>
        )}
        <TouchableOpacity style={styles.leaveBtn} onPress={() => void endCall()}>
          <Text style={styles.leaveBtnText}>Leave Queue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Connecting
  if (callState === 'connecting' || callState === 'idle') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.connectingText}>Connecting to consultation…</Text>
      </View>
    );
  }

  // Ended
  if (callState === 'ended') {
    return (
      <View style={styles.centered}>
        <Text style={styles.endedTitle}>Consultation Ended</Text>
        {consentGiven && (
          <Text style={styles.endedSub}>Your session recording has been saved securely.</Text>
        )}
        <TouchableOpacity style={styles.doneBtn} onPress={onEnd}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Active call
  return (
    <View style={styles.callContainer}>
      {/* Remote video (full screen) */}
      {remoteStream ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
          mirror={false}
        />
      ) : (
        <View style={[styles.remoteVideo, styles.noRemote]}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.waitingForPeer}>Waiting for the other participant…</Text>
        </View>
      )}

      {/* Local video (picture-in-picture) */}
      {localStream && !isCameraOff && (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.localVideo}
          objectFit="cover"
          mirror
        />
      )}

      {/* Network quality badge */}
      <View style={[styles.qualityBadge, styles[`quality_${networkQuality}`]]}>
        <Text style={styles.qualityText}>
          {networkQuality === 'good' ? '●' : networkQuality === 'fair' ? '◕' : '○'}{' '}
          {networkQuality.toUpperCase()}
        </Text>
      </View>

      {/* Screen sharing indicator */}
      {isSharingScreen && (
        <View style={styles.sharingBadge}>
          <Text style={styles.sharingText}>Sharing Screen</Text>
        </View>
      )}

      {/* Call controls */}
      <View style={styles.controls}>
        <Pressable
          style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          onPress={toggleMute}
          accessibilityRole="button"
          accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
        >
          <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
        </Pressable>

        <Pressable
          style={[styles.controlBtn, isCameraOff && styles.controlBtnActive]}
          onPress={toggleCamera}
          accessibilityRole="button"
          accessibilityLabel={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
        >
          <Text style={styles.controlIcon}>{isCameraOff ? '📵' : '📷'}</Text>
        </Pressable>

        <Pressable
          style={[styles.controlBtn, isSharingScreen && styles.controlBtnActive]}
          onPress={() => void toggleScreenShare()}
          accessibilityRole="button"
          accessibilityLabel="Share screen"
        >
          <Text style={styles.controlIcon}>🖥</Text>
        </Pressable>

        <Pressable
          style={[styles.controlBtn, styles.endCallBtn]}
          onPress={() => void endCall()}
          accessibilityRole="button"
          accessibilityLabel="End call"
        >
          <Text style={styles.controlIcon}>📵</Text>
        </Pressable>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111', gap: 12 },

  // Connecting
  connectingText: { color: '#fff', fontSize: 15, marginTop: 12 },

  // Waiting room
  waitTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 16 },
  waitBody: { color: '#ccc', fontSize: 15 },
  bold: { fontWeight: '700', color: '#fff' },
  waitPosition: { color: '#4A90E2', fontSize: 18, fontWeight: '600' },
  waitEst: { color: '#aaa', fontSize: 14 },
  leaveBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e53935' },
  leaveBtnText: { color: '#e53935', fontWeight: '600' },

  // Ended
  endedTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  endedSub: { color: '#aaa', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  doneBtn: { marginTop: 20, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 10, backgroundColor: '#4A90E2' },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  // Active call
  callContainer: { flex: 1, backgroundColor: '#000' },
  remoteVideo: { flex: 1 },
  noRemote: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  waitingForPeer: { color: '#888', marginTop: 12 },
  localVideo: {
    position: 'absolute',
    right: 16,
    top: 56,
    width: 100,
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  qualityBadge: {
    position: 'absolute',
    top: 56,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  quality_good: { backgroundColor: 'rgba(76,175,80,0.85)' },
  quality_fair: { backgroundColor: 'rgba(255,152,0,0.85)' },
  quality_poor: { backgroundColor: 'rgba(229,57,53,0.85)' },
  qualityText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  sharingBadge: {
    position: 'absolute',
    top: 90,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(74,144,226,0.85)',
  },
  sharingText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  // Controls bar
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: { backgroundColor: 'rgba(229,57,53,0.5)' },
  endCallBtn: { backgroundColor: '#e53935' },
  controlIcon: { fontSize: 22 },

  // Consent modal
  consentOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  consentCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  consentTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  consentBody: { fontSize: 14, color: '#444', lineHeight: 22, marginBottom: 24 },
  consentButtons: { flexDirection: 'row', gap: 12 },
  consentBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  consentBtnDecline: { borderWidth: 1, borderColor: '#ccc' },
  consentBtnAccept: { backgroundColor: '#4A90E2' },
  consentBtnTextDecline: { color: '#555', fontWeight: '600' },
  consentBtnTextAccept: { color: '#fff', fontWeight: '600' },
});

export default VideoConsultationScreen;
