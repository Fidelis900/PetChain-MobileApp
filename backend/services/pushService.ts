import fetch from 'node-fetch';

import { getRedisClient, REDIS_KEY_PREFIX } from '../config/redis';
import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationTopic =
  | 'medication_reminders'
  | 'appointment_alerts'
  | 'sos_notifications'
  | 'health_tips';

export const ALL_TOPICS: NotificationTopic[] = [
  'medication_reminders',
  'appointment_alerts',
  'sos_notifications',
  'health_tips',
];

export interface PushJob {
  jobId: string;
  userId: string;
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  topic: NotificationTopic;
  attempts: number;
  createdAt: string;
}

export interface PushMetrics {
  queued: number;
  delivered: number;
  failed: number;
  retried: number;
  deadLettered: number;
}

// ─── Redis key helpers ────────────────────────────────────────────────────────

const K = {
  queue: `${REDIS_KEY_PREFIX}push:queue`,
  dlq: `${REDIS_KEY_PREFIX}push:dlq`,
  dedup: (jobId: string) => `${REDIS_KEY_PREFIX}push:dedup:${jobId}`,
  metrics: `${REDIS_KEY_PREFIX}push:metrics`,
  tokens: (userId: string) => `${REDIS_KEY_PREFIX}push:tokens:${userId}`,
  subscriptions: (userId: string) => `${REDIS_KEY_PREFIX}push:subs:${userId}`,
  preferences: (userId: string) => `${REDIS_KEY_PREFIX}push:prefs:${userId}`,
};

// ─── Config ───────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;
const DEDUP_TTL_SECONDS = 86400; // 24 h
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ─── Metrics ──────────────────────────────────────────────────────────────────

async function incrMetric(field: keyof PushMetrics): Promise<void> {
  try {
    await getRedisClient().hincrby(K.metrics, field, 1);
  } catch {
    // non-critical
  }
}

export async function getMetrics(): Promise<PushMetrics> {
  try {
    const raw = await getRedisClient().hgetall(K.metrics);
    return {
      queued: parseInt(raw?.queued ?? '0'),
      delivered: parseInt(raw?.delivered ?? '0'),
      failed: parseInt(raw?.failed ?? '0'),
      retried: parseInt(raw?.retried ?? '0'),
      deadLettered: parseInt(raw?.deadLettered ?? '0'),
    };
  } catch {
    return { queued: 0, delivered: 0, failed: 0, retried: 0, deadLettered: 0 };
  }
}

// ─── Device token management ──────────────────────────────────────────────────

export async function registerToken(userId: string, token: string): Promise<void> {
  if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
    throw new Error('Invalid Expo push token format');
  }
  await getRedisClient().sadd(K.tokens(userId), token);
  logger.info('push_token_registered', { userId, tokenPrefix: token.slice(0, 20) });
}

export async function removeToken(userId: string, token: string): Promise<void> {
  await getRedisClient().srem(K.tokens(userId), token);
  logger.info('push_token_removed', { userId });
}

export async function getTokens(userId: string): Promise<string[]> {
  return getRedisClient().smembers(K.tokens(userId));
}

export async function removeAllTokens(userId: string): Promise<void> {
  await getRedisClient().del(K.tokens(userId));
}

// ─── Topic subscriptions ──────────────────────────────────────────────────────

export async function subscribe(userId: string, topic: NotificationTopic): Promise<void> {
  if (!ALL_TOPICS.includes(topic)) throw new Error(`Unknown topic: ${topic}`);
  await getRedisClient().sadd(K.subscriptions(userId), topic);
}

export async function unsubscribe(userId: string, topic: NotificationTopic): Promise<void> {
  await getRedisClient().srem(K.subscriptions(userId), topic);
}

export async function getSubscriptions(userId: string): Promise<NotificationTopic[]> {
  const subs = await getRedisClient().smembers(K.subscriptions(userId));
  return subs as NotificationTopic[];
}

export async function isSubscribed(userId: string, topic: NotificationTopic): Promise<boolean> {
  return (await getRedisClient().sismember(K.subscriptions(userId), topic)) === 1;
}

// ─── Notification preferences ─────────────────────────────────────────────────

export interface UserPushPreferences {
  enabled: boolean;
  topics: Partial<Record<NotificationTopic, boolean>>;
}

const DEFAULT_PREFS: UserPushPreferences = {
  enabled: true,
  topics: Object.fromEntries(ALL_TOPICS.map((t) => [t, true])) as Record<NotificationTopic, boolean>,
};

export async function getPreferences(userId: string): Promise<UserPushPreferences> {
  const raw = await getRedisClient().get(K.preferences(userId));
  return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
}

export async function setPreferences(
  userId: string,
  prefs: Partial<UserPushPreferences>,
): Promise<void> {
  const current = await getPreferences(userId);
  const updated = { ...current, ...prefs, topics: { ...current.topics, ...prefs.topics } };
  await getRedisClient().set(K.preferences(userId), JSON.stringify(updated));
}

// ─── Queue ────────────────────────────────────────────────────────────────────

/** Enqueue a push notification. Returns false if duplicate (idempotent). */
export async function enqueue(job: Omit<PushJob, 'attempts' | 'createdAt'>): Promise<boolean> {
  const redis = getRedisClient();

  // Idempotency check
  const dedupKey = K.dedup(job.jobId);
  const isNew = await redis.set(dedupKey, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
  if (!isNew) return false;

  // Preference + subscription gate
  const [prefs, subscribed] = await Promise.all([
    getPreferences(job.userId),
    isSubscribed(job.userId, job.topic),
  ]);
  if (!prefs.enabled || prefs.topics[job.topic] === false || !subscribed) {
    logger.info('push_skipped_preference', { userId: job.userId, topic: job.topic });
    return false;
  }

  const fullJob: PushJob = { ...job, attempts: 0, createdAt: new Date().toISOString() };
  await redis.rpush(K.queue, JSON.stringify(fullJob));
  await incrMetric('queued');
  logger.info('push_enqueued', { jobId: job.jobId, userId: job.userId, topic: job.topic });
  return true;
}

/** Send to Expo Push API. Returns true on success. */
async function sendToExpo(job: PushJob): Promise<boolean> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      to: job.token,
      title: job.title,
      body: job.body,
      data: job.data ?? {},
      sound: 'default',
    }),
  });

  if (!response.ok) {
    logger.warn('expo_push_http_error', { status: response.status, jobId: job.jobId });
    return false;
  }

  const result = (await response.json()) as { data?: { status?: string; details?: { error?: string } } };
  const status = result?.data?.status;

  if (status === 'error') {
    const error = result?.data?.details?.error;
    // DeviceNotRegistered = permanent failure, remove token
    if (error === 'DeviceNotRegistered') {
      await removeToken(job.userId, job.token);
      logger.info('push_token_invalidated', { userId: job.userId, error });
    }
    return false;
  }

  return true;
}

/** Process one job from the queue. Returns true if a job was processed. */
export async function processOne(): Promise<boolean> {
  const redis = getRedisClient();
  const raw = await redis.lpop(K.queue);
  if (!raw) return false;

  const job: PushJob = JSON.parse(raw);
  job.attempts += 1;

  try {
    const ok = await sendToExpo(job);
    if (ok) {
      await incrMetric('delivered');
      logger.info('push_delivered', { jobId: job.jobId, attempt: job.attempts });
      return true;
    }
    throw new Error('Expo push returned non-ok status');
  } catch (err) {
    logger.warn('push_attempt_failed', {
      jobId: job.jobId,
      attempt: job.attempts,
      error: err instanceof Error ? err.message : 'unknown',
    });

    if (job.attempts < MAX_ATTEMPTS) {
      // Exponential backoff: re-enqueue with delay via a scored set would be ideal,
      // but for simplicity we push back to the tail (processed after current items)
      await redis.rpush(K.queue, JSON.stringify(job));
      await incrMetric('retried');
    } else {
      await redis.rpush(K.dlq, JSON.stringify(job));
      await incrMetric('deadLettered');
      await incrMetric('failed');
      logger.error('push_dead_lettered', { jobId: job.jobId, userId: job.userId });
    }
    return true;
  }
}

/** Drain the queue, processing up to `limit` jobs. */
export async function drainQueue(limit = 100): Promise<number> {
  let processed = 0;
  while (processed < limit) {
    const had = await processOne();
    if (!had) break;
    processed++;
  }
  return processed;
}

/** Enqueue a push notification to all tokens of a user for a given topic. */
export async function sendToUser(
  userId: string,
  topic: NotificationTopic,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<number> {
  const tokens = await getTokens(userId);
  let enqueued = 0;
  for (const token of tokens) {
    const jobId = `${userId}:${topic}:${Date.now()}:${token.slice(-8)}`;
    const queued = await enqueue({ jobId, userId, token, title, body, data, topic });
    if (queued) enqueued++;
  }
  return enqueued;
}

/** Peek at DLQ entries (for monitoring). */
export async function getDLQ(limit = 50): Promise<PushJob[]> {
  const items = await getRedisClient().lrange(K.dlq, 0, limit - 1);
  return items.map((i) => JSON.parse(i) as PushJob);
}

/** Clear DLQ (admin action). */
export async function clearDLQ(): Promise<void> {
  await getRedisClient().del(K.dlq);
}
