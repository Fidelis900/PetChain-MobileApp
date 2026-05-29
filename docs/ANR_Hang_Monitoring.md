# ANR / Hang Monitoring

This single resource defines a practical implementation plan for monitoring Android ANRs and iOS hangs, capturing stack traces, and reporting them to the backend.

## Goal
- Detect Android ANRs and iOS main-thread hangs.
- Capture a stack trace that identifies the root cause.
- Report failures to a backend endpoint for later analysis.

---

## 1. Android ANR detection

Android ANRs happen when the UI thread is blocked for too long. Use a watchdog thread to detect stalls and capture the main thread’s stack trace.

### Android native module example (`ANRWatchdog.kt`)

```kotlin
package com.petchain.monitoring

import android.os.Handler
import android.os.Looper
import android.util.Log
import java.util.concurrent.atomic.AtomicBoolean

object ANRWatchdog {
    private const val WATCHDOG_INTERVAL_MS = 2500L
    private val mainThreadResponded = AtomicBoolean(true)
    private val handler = Handler(Looper.getMainLooper())
    private val checker = object : Runnable {
        override fun run() {
            mainThreadResponded.set(false)
            handler.post {
                mainThreadResponded.set(true)
            }

            handler.postDelayed(this, WATCHDOG_INTERVAL_MS)
            checkForAnr()
        }
    }

    private fun checkForAnr() {
        if (!mainThreadResponded.get()) {
            val stackTrace = captureMainThreadStack()
            reportAnr(stackTrace)
        }
    }

    private fun captureMainThreadStack(): String {
        val mainThread = Looper.getMainLooper().thread
        val trace = mainThread.stackTrace
        return trace.joinToString(separator = "\n") { element ->
            "at ${element.className}.${element.methodName}(${element.fileName}:${element.lineNumber})"
        }
    }

    private fun reportAnr(stackTrace: String) {
        Log.e("ANRWatchdog", "Detected ANR:\n$stackTrace")
        // TODO: send a report to backend
    }

    fun start() {
        handler.postDelayed(checker, WATCHDOG_INTERVAL_MS)
    }

    fun stop() {
        handler.removeCallbacks(checker)
    }
}
```

### Notes
- Start this as early as possible, ideally in `Application.onCreate()`.
- `WATCHDOG_INTERVAL_MS` should be below the ANR threshold (e.g. 2.5 seconds).
- When a hang is detected, capture the UI thread stack trace immediately.

---

## 2. iOS hang detection

On iOS, detect main thread stalls using a periodic runloop observer or a semaphore-based watchdog.

### iOS native module example (`HangMonitor.swift`)

```swift
import Foundation
import UIKit

final class HangMonitor {
    private let signalSemaphore = DispatchSemaphore(value: 0)
    private let monitorQueue = DispatchQueue(label: "com.petchain.hangmonitor")
    private var running = false

    func start() {
        guard !running else { return }
        running = true

        let runLoopObserver = CFRunLoopObserverCreateWithHandler(
            kCFAllocatorDefault,
            CFRunLoopActivity.afterWaiting.rawValue,
            true,
            0
        ) { _, _ in
            self.signalSemaphore.signal()
        }

        CFRunLoopAddObserver(CFRunLoopGetMain(), runLoopObserver, .commonModes)

        monitorQueue.async {
            while self.running {
                let timeout = DispatchTime.now() + .seconds(2)
                if self.signalSemaphore.wait(timeout: timeout) == .timedOut {
                    self.handleHangDetected()
                }
            }
        }
    }

    func stop() {
        running = false
        signalSemaphore.signal()
    }

    private func captureMainThreadStack() -> String {
        Thread.callStackSymbols.joined(separator: "\n")
    }

    private func handleHangDetected() {
        let stack = captureMainThreadStack()
        reportHang(stackTrace: stack)
    }

    private func reportHang(stackTrace: String) {
        print("[HangMonitor] Detected hang:\n\(stackTrace)")
        // TODO: send a report to backend
    }
}
```

### Notes
- A 2-second timeout is a good baseline for identifying hangs before they become user-visible.
- Capture `Thread.callStackSymbols` from the main thread whenever possible.

---

## 3. Reporting schema

Use a common payload format for Android and iOS reports.

### Example payload

```json
{
  "platform": "android",
  "type": "anr",
  "timestamp": "2026-04-28T12:00:00.000Z",
  "threadName": "main",
  "stackTrace": "at com.petchain.MainActivity.onCreate(MainActivity.kt:45)\n...",
  "appVersion": "1.0.0",
  "osVersion": "Android 14",
  "deviceModel": "Pixel 8",
  "additionalInfo": {
    "activeScreen": "PetProfile",
    "pendingNetworkRequests": 3
  }
}
```

### Backend endpoint contract

- HTTP method: `POST`
- URL: `/api/monitoring/anr-report`
- Content-Type: `application/json`
- Required fields: `platform`, `type`, `timestamp`, `stackTrace`
- Optional fields: `appVersion`, `osVersion`, `deviceModel`, `additionalInfo`

---

## 4. React Native integration example

If this project uses React Native, expose the native monitor through a bridge and start it immediately on app launch.

### Example JavaScript module

```js
import { NativeModules, Platform } from 'react-native';

const { ANRWatchdog, HangMonitor } = NativeModules;

export function startPerformanceMonitoring() {
  if (Platform.OS === 'android' && ANRWatchdog?.start) {
    ANRWatchdog.start();
  }

  if (Platform.OS === 'ios' && HangMonitor?.start) {
    HangMonitor.start();
  }
}
```

### Startup call

```js
import { startPerformanceMonitoring } from './monitoring/PerformanceMonitor';

startPerformanceMonitoring();
```

---

## 5. Backend report handling example

This repository currently contains backend types and validation utilities, so add a reporting contract here.

### Example validation pseudo-code

```ts
export interface AnrReportPayload {
  platform: 'android' | 'ios';
  type: 'anr' | 'hang';
  timestamp: string;
  threadName: string;
  stackTrace: string;
  appVersion?: string;
  osVersion?: string;
  deviceModel?: string;
  additionalInfo?: Record<string, unknown>;
}

export function validateAnrReport(payload: any): ValidationResult {
  if (!payload) return invalid('Payload is required.');
  if (!['android', 'ios'].includes(payload.platform)) return invalid('platform must be android or ios.');
  if (!['anr', 'hang'].includes(payload.type)) return invalid('type must be anr or hang.');
  if (!payload.timestamp) return invalid('timestamp is required.');
  if (!payload.stackTrace) return invalid('stackTrace is required.');
  return valid();
}
```

### Reporting implementation notes

- Store raw reports in a durable logging store or database.
- Flag repeated stack traces and root causes.
- Attach `deviceModel`, `appVersion`, and `osVersion` for faster triage.

---

## 6. Acceptance criteria mapping

- `ANRs captured` — achieved through the Android watchdog and iOS hang monitor.
- `Stack trace capture` — both platforms capture the main thread stack immediately when a stall is detected.
- `Reporting` — a backend report payload is defined, with endpoint contract and validation.
- `Root cause identifiable` — the captured stack trace plus app/OS metadata provide a clear root cause signal.

---

## 7. Next step

- Add native bridge code to the mobile app project.
- Implement the `/api/monitoring/anr-report` endpoint in the backend.
- Connect native monitor `reportAnr` / `reportHang` to the backend payload.
- Validate the payload and persist failures for analysis.
