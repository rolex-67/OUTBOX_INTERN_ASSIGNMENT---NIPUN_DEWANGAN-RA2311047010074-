# ReachInbox Email Job Scheduler

Production-grade distributed email scheduling service + real-time dashboard built for the ReachInbox SDE intern assignment.

---

## 🏗 Architecture Overview

```
frontend (Next.js)  →  backend (Express + BullMQ)  →  MySQL (Prisma)
                                 ↓
                           Redis (BullMQ queue)
                                 ↓
                        BullMQ Worker (concurrency=5)
                                 ↓
                    Ethereal SMTP  +  MySQL update  +  Elasticsearch index
                                 ↓ (rate limit hit)
                          Slack Webhook alert
```

### How Scheduling Works (Zero Cron)

1. Client calls `POST /api/schedule` with recipients, subject, body, start time, delay, and hourly limit.
2. Backend creates a DB record per recipient (`status=SCHEDULED`), then calls `queue.add('send-email', data, { jobId, delay })`.
3. BullMQ stores the delayed job in Redis. The job fires at the correct wallclock time even after a server restart — Redis persists the scheduled timestamp.
4. The worker picks up the job at `delay` milliseconds and sends via Ethereal SMTP.

### Persistence on Restart

- BullMQ delayed jobs live **inside Redis** — no jobs are lost on server restart.
- Future emails continue to fire at the correct time because Redis stores the `processAt` epoch.
- MySQL is the source of truth for status (`SCHEDULED` → `SENT` / `FAILED`).

### Rate Limiting & Concurrency

| Mechanism | Implementation |
|-----------|----------------|
| Worker concurrency | `new Worker('email-queue', processor, { concurrency: 5 })` |
| Inter-email min delay | `await new Promise(r => setTimeout(r, minDelayMs))` inside worker |
| Hourly per-sender limit | Atomic `REDIS INCR ratelimit:{sender}:{hourWindow}` with 2-hour TTL |
| Rate limit breach | `job.moveToDelayed(nextHourTimestamp, token)` + `throw new DelayedError()` — job is **never dropped** |
| Slack alert | Single deduped alert per sender per hour via `SET alertFlagKey NX EX 7200` |

**Default values (configurable via env):**
- `DEFAULT_MIN_DELAY_MS=2000` — 2 seconds between each email
- `DEFAULT_MAX_HOURLY_LIMIT=200` — 200 emails per sender per hour

### Elasticsearch

- Index: `reachinbox-emails` with mappings for subject, body, recipient, sender, status.
- Multi-match fuzzy search with field boosting (`subject^3`).
- Automatic DB fallback (`LIKE` query) if Elasticsearch is offline.

---

## 🚀 Running Locally

### Prerequisites

- Node.js 18+
- Redis running on `localhost:6379`
- MySQL running on `localhost:3306`
- (Optional) Elasticsearch on `localhost:9200`

### 1. Backend

```bash
cd backend
cp .env.example .env          # Edit your DB password, JWT secret, etc.
npm install
npx prisma db push             # Creates tables in MySQL
npm run dev                    # Starts Express on port 5000
```

**Backend endpoints:**
- `http://localhost:5000/health` — Health check
- `http://localhost:5000/admin/queues` — Live BullMQ dashboard
- `http://localhost:5000/api/schedule` — Schedule emails
- `http://localhost:5000/api/emails/scheduled` — List scheduled
- `http://localhost:5000/api/emails/sent` — List sent
- `http://localhost:5000/api/emails/search?q=...` — Search

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local    # Add NEXT_PUBLIC_GOOGLE_CLIENT_ID if you have one
npm install
npm run dev                    # Starts Next.js on port 3000
```

Open: `http://localhost:3000`

### 3. (Optional) Docker for Elasticsearch

```bash
docker compose up -d elasticsearch
```

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Express port |
| `DATABASE_URL` | MySQL connection string | Prisma connection |
| `REDIS_HOST` | `127.0.0.1` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password (optional) |
| `ETHEREAL_USER` | — | Ethereal SMTP user (auto-created if blank) |
| `ETHEREAL_PASS` | — | Ethereal SMTP password |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch URL |
| `DEFAULT_MIN_DELAY_MS` | `2000` | Min ms between emails |
| `DEFAULT_MAX_HOURLY_LIMIT` | `200` | Max emails/hour per sender |
| `SLACK_WEBHOOK_URL` | — | Global Slack webhook (fallback) |
| `JWT_SECRET` | `reachinbox-scheduler-jwt-secret-xyz` | JWT signing secret |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allowed origin |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000/api` | Backend API base URL |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | — | Google OAuth Client ID |

---

## 📋 Getting a Google OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select or create a project
3. Click **Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Add Authorized JavaScript origins: `http://localhost:3000`
6. Add Authorized redirect URIs: `http://localhost:3000`
7. Copy the Client ID into `frontend/.env.local` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

> **Note**: The app works without a Google Client ID — it uses a direct login fallback that calls `POST /api/auth/google` with your email.

---

## 📨 Ethereal Email

Ethereal Email is a fake SMTP service for testing — no real emails are sent.

- If `ETHEREAL_USER` / `ETHEREAL_PASS` are empty, the backend **auto-creates a disposable test inbox** on first email send.
- Preview URLs for every sent email are logged in the backend console:
  ```
  Ethereal email preview [recipient@example.com]: https://ethereal.email/message/...
  ```

---

## 💬 Slack Integration

1. In the dashboard, click **Connect Slack** in the top navbar.
2. Paste an [Incoming Webhook URL](https://api.slack.com/messaging/webhooks) from your Slack workspace.
3. Click **Save Webhook**.

When any sender's hourly limit is reached, a single alert fires to that Slack channel:
```
⚠️ ReachInbox Rate Limit Alert: Sender growth@company.ai reached the hourly limit of 200 emails.
```

---

## ✅ Features Implemented

### Backend
- [x] BullMQ delayed jobs (zero cron, zero `setInterval`)
- [x] Persistent queue — survives server restarts
- [x] Idempotent job IDs via deterministic `jobId`
- [x] Worker concurrency (configurable, default 5)
- [x] Minimum inter-email delay throttling
- [x] Per-sender hourly rate limit via atomic Redis counters
- [x] Non-dropping rescheduling: `moveToDelayed()` into next hour window
- [x] Live Slack webhook alert on rate limit hit (deduped per hour)
- [x] Ethereum (Ethereal) SMTP via Nodemailer with auto test inbox
- [x] Elasticsearch indexing + fuzzy multi-match search
- [x] MySQL DB fallback search when Elasticsearch is offline
- [x] Bull Board live queue dashboard at `/admin/queues`
- [x] Google Auth endpoint (JWT-based session)

### Frontend
- [x] Login page with Google authentication and feature showcase
- [x] Protected `/dashboard` route with auth guard
- [x] Sticky header with user avatar, name, email, and logout
- [x] BullMQ dashboard quick-link in header
- [x] Slack webhook connect modal in header
- [x] Stats grid: Scheduled / Sent / Failed counts
- [x] Tabbed view: Scheduled Emails | Sent Emails
- [x] Real-time Elasticsearch search with DB fallback
- [x] 10-second auto-refresh poll
- [x] Email table with loading skeletons and empty states
- [x] Status badges (SCHEDULED, SENT, FAILED) with animations
- [x] Compose modal with CSV/text file lead upload (PapaParse)
- [x] Manual email paste fallback for leads
- [x] Start time, inter-email delay, and hourly limit configuration

---

## 🔄 Behavior Under Load (1000+ emails)

When 1000 emails are scheduled for the same time:

1. All jobs are enqueued in Redis with the same `delay` — BullMQ handles the queue fan-out.
2. Worker picks up jobs at `concurrency=5` simultaneously.
3. Inter-email delay (`DEFAULT_MIN_DELAY_MS`) throttles actual SMTP sends.
4. Hourly rate counter (`INCR ratelimit:{sender}:{hour}`) prevents exceeding the per-hour limit.
5. Once the limit is hit, all remaining jobs are `moveToDelayed()` into the **next hour window** — nothing is dropped.
6. A single Slack alert fires per sender per hour window.

---

## 📁 Project Structure

```
reachinbox-scheduler/
├── README.md
├── docker-compose.yml            # Postgres/Redis/Elasticsearch (optional)
├── backend/
│   ├── prisma/schema.prisma      # User + EmailJob models (MySQL)
│   ├── src/
│   │   ├── config/env.ts         # Zod env validator
│   │   ├── lib/
│   │   │   ├── db.ts             # Prisma singleton
│   │   │   ├── redis.ts          # IORedis shared connection
│   │   │   ├── mailer.ts         # Ethereal SMTP transporter
│   │   │   └── elastic.ts        # Elasticsearch index + search
│   │   ├── queue/
│   │   │   ├── producer.ts       # Queue + scheduleEmailJob()
│   │   │   └── worker.ts         # Worker: rate limit, delay, Slack, SMTP
│   │   ├── routes/api.ts         # Express API routes
│   │   └── server.ts             # App entry + Bull Board
│   └── package.json
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx          # Login page
    │   │   └── dashboard/page.tsx # Main dashboard
    │   ├── components/
    │   │   ├── Header.tsx        # Top nav + Slack modal
    │   │   ├── EmailTable.tsx    # Data table + loading/empty states
    │   │   └── ComposeModal.tsx  # CSV parsing + scheduling form
    │   └── lib/api.ts            # Typed fetch wrappers
    └── package.json
```

---

## 🎥 Demo Video Notes

For the demo video, show:
1. Login → Dashboard with empty states
2. Compose modal → Upload CSV → Schedule emails
3. Watch emails move from "Scheduled" tab → "Sent" tab (auto-refresh)
4. Ethereal preview URL in backend console
5. BullMQ Live Dashboard at `/admin/queues`
6. Search a keyword → Elasticsearch/DB results
7. Restart backend → future scheduled emails still send
