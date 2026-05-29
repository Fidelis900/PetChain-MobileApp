# PetChain Backend — Scaling Runbook

This document describes how to horizontally scale the PetChain backend using **PM2 cluster mode**, a reverse-proxy load balancer, and **Redis** for shared session state.

---

## 1. Architecture Overview

```
                       ┌──────────────────────────────┐
Internet ──► LB/Nginx  │  PM2 cluster (N workers)      │
            (port 443) │  Worker 0  │ Worker 1  │ …    │  ◄── Redis (sessions)
                       │  port 3000 │ port 3000 │      │  ◄── PostgreSQL
                       └──────────────────────────────┘
```

Each PM2 worker is a **stateless** Node.js process.  Session data lives in Redis, so any worker can handle any request without sticky routing.

---

## 2. Prerequisites

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | ≥ 20 LTS | |
| PM2 | ≥ 5.x | `npm i -g pm2` |
| Redis | ≥ 7.x | Session store |
| PostgreSQL | ≥ 15 | Primary database |
| Nginx / HAProxy | latest | Reverse-proxy / LB |

Install the required backend packages:

```bash
npm install express-session connect-redis redis
npm install --save-dev @types/express-session @types/connect-redis
```

---

## 3. Starting the Cluster

```bash
# Production
pm2 start ecosystem.config.js --env production

# Staging
pm2 start ecosystem.config.js --env staging

# List running processes
pm2 list

# Save process list (survives reboots)
pm2 save && pm2 startup
```

The `instances: 'max'` setting in `ecosystem.config.js` forks one worker per logical CPU core.  Adjust if you want to reserve cores for other services:

```js
instances: Math.max(1, require('os').cpus().length - 1),
```

---

## 4. Zero-Downtime Reloads

PM2's `reload` command sends `SIGTERM` to workers one-at-a-time, waits for `listen_timeout` (15 s), then starts a replacement before killing the old one:

```bash
pm2 reload petchain-api
```

The server uses `process.send('ready')` to signal PM2 when it is listening (`wait_ready: true` in the config), and a `SIGTERM` handler in `backend/server/index.ts` that:

1. Marks the `/api/ready` probe as unhealthy so the load balancer stops sending new requests.
2. Calls `server.close()` to drain in-flight connections.
3. Exits cleanly once all connections are drained (or after a 9 s safety timeout).

---

## 5. Health & Readiness Probes

| Endpoint | Purpose | Expected status |
|----------|---------|-----------------|
| `GET /api/health` | Liveness — is the process alive? | `200 { ok: true }` always |
| `GET /api/ready` | Readiness — is the process ready for traffic? | `200` when ready, `503` while draining |

Configure your load balancer to use `/api/ready` for traffic routing and `/api/health` for restart decisions.

### Nginx upstream health check example

```nginx
upstream petchain {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 443 ssl;
    server_name api.petchain.app;

    location / {
        proxy_pass http://petchain;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Readiness check used by Nginx Plus / upstream health checks
    location = /api/ready {
        proxy_pass http://petchain;
    }
}
```

---

## 6. Redis Session Configuration

| Environment variable | Default | Description |
|---------------------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `SESSION_SECRET` | `petchain-dev-session-secret` | **Change in production** — use ≥ 32 random bytes |
| `SESSION_MAX_AGE_MS` | `86400000` (24 h) | Session TTL in milliseconds |

Sessions are stored at `petchain:sess:<sid>` keys in Redis.  They expire automatically via the TTL set by `SESSION_MAX_AGE_MS`.

### Redis HA (optional)

For high availability use Redis Sentinel or a managed service (ElastiCache, Upstash, Redis Cloud).  Update `REDIS_URL` to the Sentinel / cluster endpoint.

---

## 7. Load Testing with k6

Verify linear scaling before deploying to production:

```bash
# Install k6: https://k6.io/docs/get-started/installation/

# Baseline — 1 worker
pm2 scale petchain-api 1
k6 run --vus 50 --duration 30s scripts/k6-load-test.js

# Scale up — all cores
pm2 scale petchain-api max
k6 run --vus 50 --duration 30s scripts/k6-load-test.js
```

A minimal `scripts/k6-load-test.js`:

```js
import http from 'k6/http';
import { check } from 'k6';

export default function () {
  const res = http.get('http://localhost:3000/api/health');
  check(res, { 'status is 200': (r) => r.status === 200 });
}
```

Expected: throughput scales near-linearly with the number of workers; p99 latency stays below 200 ms.

---

## 8. Monitoring

```bash
# Real-time dashboard
pm2 monit

# Aggregated logs from all workers
pm2 logs petchain-api

# JSON metrics (CPU, memory, restarts per worker)
pm2 show petchain-api
```

Log files rotate automatically; configure `log_rotate` via `pm2-logrotate`:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 7
```
