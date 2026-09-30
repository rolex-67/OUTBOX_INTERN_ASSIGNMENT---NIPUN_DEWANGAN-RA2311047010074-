# ReachInbox Email Job Scheduler & Outbox Dashboard

**Developed by**: Nipun Dewangan  
**Registration Number**: RA2311047010074  
**Project**: Outbox Labs / ReachInbox SDE Intern Assignment  

A fault-tolerant, distributed email scheduling service and outbox dashboard built with **Next.js (App Router)**, **Express**, **BullMQ**, **Redis**, **MySQL (Prisma)**, and **Nodemailer (Ethereal SMTP)**. Designed to pixel-match the official [Figma Design Specification](https://www.figma.com/design/kOTwGlESjijCYnMgtHfvfU/Outbox-Labs-Assignment?node-id=59-4050&p=f&m=dev) with real-time queues, rich-text composing, dynamic throttling, and zero message loss.

---

## 🏗 Architecture & Core Design

```
[ Frontend: Next.js + TailwindCSS ]
          │ (REST API & JWT Auth)
          ▼
[ Backend: Express 4.19 + TypeScript ] ──► [ MySQL: Prisma ORM ]
          │ (Job Enqueueing)                  (Long-term persistence & recovery)
          ▼
   [ Redis 7: BullMQ ]
          │ (Delayed Sorted Sets)
          ▼
 [ BullMQ Worker (Concurrency: 5) ]
          │
          ├─► [ Atomic Redis Rate Limiter ] ──► (Breached?) ──► [ Slack Webhook Alert ]
          │                                         │
          │                                         └──► Reschedule to next hour
          │
          ├─► [ Inter-Email Delay Throttling ]
          │
          └─► [ Nodemailer SMTP (Ethereal) ] ──► Mark SENT in MySQL & Elasticsearch
```

### 1. Zero Cron / Zero setInterval Scheduling
Instead of running heavy polling loops or interval timers that drift and drop jobs on crash, jobs are scheduled using **BullMQ Delayed Queues**:
- When an email batch is scheduled, the backend creates persistent records in **MySQL** (`status: 'SCHEDULED'`), and pushes tasks to Redis with exact execution timestamps.
- Delayed jobs live in a Redis sorted set (`bull:email-queue:delayed`) ordered by epoch score (`processAt`).
- Redis automatically triggers jobs when the timestamp is reached.

### 2. Server Restart & Fault Tolerance
A primary requirement of the assignment is resilience against server crashes:
- **State in Memory is Zero**: All queue metadata and delay timers live in Redis; all email bodies, attachments, and recipient metadata live in MySQL.
- **Worker Reconnection**: When the Node.js backend terminates (`Ctrl+C` or `SIGTERM`) and boots back up, the BullMQ worker automatically re-attaches to Redis and resumes the delayed queue.
- **Startup Recovery Reconciliation**: On boot, [`server.ts`](file:///d:/Projects/OUTBOX%20ASSIGNMENT/backend/src/server.ts) runs `reconcilePendingJobsOnStartup()`:
  - Scans MySQL for any jobs flagged as `SCHEDULED`.
  - Verifies their existence in BullMQ.
  - Automatically re-queues any missing jobs if Redis was flushed or restarted offline.
  - Future emails still dispatch on schedule with zero loss.

### 3. Rate Limiting & Inter-Email Delay Under Load
To protect sender reputation and prevent domain burning:
- **Inter-Email Delay**: Each recipient in a batch is staggered by an offset (`delayBetweenEmailsMs`, default 2 seconds). The worker enforces `await new Promise(r => setTimeout(r, minDelay))` between dispatches.
- **Per-Sender Atomic Hourly Rate Limiter**:
  - Redis atomic counter `ratelimit:{sender}:{hourWindow}` with a 2-hour TTL.
  - When `count > hourlyLimit`:
    1. Decrements the counter to reflect only successfully dispatched volume.
    2. Calculates the exact start timestamp of the next hour window (`nextHourTimestamp`).
    3. Reschedules the job safely using `job.moveToDelayed(nextHourTimestamp, token)`.
    4. Updates MySQL `scheduledAt` to reflect the new time.
    5. Dispatches an automated alert to the configured **Slack Webhook** (deduplicated per sender per hour window).
    6. **Zero emails are dropped or marked failed** — excess emails are cleanly deferred to the next hour.

---

## 🎨 Frontend Features (Figma Pixel-Match)

The frontend strictly implements the white, light-themed Figma specification:
- **Authentication**: Google OAuth login + Direct access bypass for assignment reviewers.
- **Student Attribution**: Footer signature on login and dashboard: `MADE BY NIPUN DEWANGAN • RA2311047010074`.
- **Navigation & Sidebar**:
  - `ONG` brand logo.
  - Profile pill dropdown with user credentials, Slack connection modal, BullMQ monitor link, and logout.
  - Core navigation: **Scheduled** and **Sent** tabs with live badge counters.
- **Compose / Reply View**:
  - **Recipients**: Interactive recipient chips with remove buttons.
  - **Upload List**: Upload `.csv` or `.txt` files to auto-extract and populate email recipient lists.
  - **Throttle Controls**: Editable fields for *Delay between 2 emails* and *Hourly Limit*.
  - **Send Later**: Popover date/time picker with presets (*Tomorrow*, *10:00 AM*, *11:00 AM*, *3:00 PM*).
  - **Rich-Text Formatting Toolbar**:
    - `Undo` & `Redo`
    - `TT` (Heading / H3 title toggle)
    - `B` (Bold), `I` (Italic), `U` (Underline), `S` (Strikethrough)
    - Text alignment cycle (Left, Center, Right)
    - Ordered (`1.`) and Unordered (`•`) lists
    - Blockquotes with green accent borders
    - Link dialog insertion
    - Real file attachments (`📎 Attach`)
- **Real Attachments**:
  - Upload documents or images directly.
  - File chips show name, human-readable size (`KB`/`MB`), and remove button.
  - Persisted in MySQL `@db.LongText` and dispatched via Nodemailer attachments.
  - Rendered with preview cards and direct download links in the detail view.
- **Interactive Filter & Sort Popover**:
  - Filter by Status (`ALL`, `SCHEDULED`, `SENT`, `FAILED`).
  - Filter by Date Range (`All Time`, `Today`, `Past 7 Days`, `Past 30 Days`).
  - Filter toggles for *Has Attachments* and *Starred Only*.
  - Sort by *Newest First*, *Oldest First*, or *Recipient (A to Z)*.
  - Removable active filter chips bar + **Clear all** button.
- **Live Search Bar**:
  - **Instant 0ms client filter** across all loaded emails as you type.
  - **200ms debounced server query** searching MySQL and Elasticsearch across `subject`, `body`, `recipient`, and `sender`.
  - Active search result banner with matching count and **Clear Search** action.
- **Detail View Actions**:
  - Star toggle (`★`) with persistent storage across sessions.
  - Archive action with badge indicators.
  - Single email permanent delete (`Trash`) calling backend `DELETE /api/emails/:id`.
  - Collapsible email headers drawer (`From`, `To`, `Scheduled At`, `Dispatched At`, `Job ID`, `Errors`).
- **Sent Log Management**:
  - **Clear Sent** button to purge sent email history from database and UI.

---

## 🛠 Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, TailwindCSS, Lucide Icons, PapaParse.
- **Backend**: Node.js, Express, TypeScript, Zod, JWT.
- **Queue & Throttling**: BullMQ 5, IORedis, Redis 7.
- **Database**: MySQL 8, Prisma ORM.
- **Search**: Elasticsearch 8 (with transparent MySQL full-text fallback).
- **Email Delivery**: Nodemailer with Ethereal SMTP (live web preview links).
- **Monitoring**: Bull Board (`/admin/queues`).

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js (v18.0 or higher)
- Redis server running on port `6379`
- MySQL server running on port `3306`

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run dev
```

The backend server starts on `http://localhost:5000`.
- Health check: `http://localhost:5000/health`
- BullMQ Live Dashboard: `http://localhost:5000/admin/queues`

### 3. Frontend Setup
```bash
cd ../frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 🧪 Demonstration Scripts & Verification

We provide automated test scripts to demonstrate the key assignment scenarios:

### Scenario 1: Server Restart & Future Email Persistence
```bash
cd backend
npx tsx src/scripts/demo_scenarios.ts
```
1. Schedules an email for 25 seconds in the future.
2. Even if you kill the backend process (`Ctrl+C`), the job remains in Redis and MySQL.
3. Once restarted, `reconcilePendingJobsOnStartup()` verifies the job, and it sends on time.

### Scenario 2: Rate Limiting & Inter-Email Delay Under Load
1. In the UI or via the demo script, send 5 emails with `Hourly Limit = 2` and `Delay = 2000ms`.
2. Emails 1 and 2 are dispatched with a 2-second delay.
3. Emails 3, 4, and 5 exceed the hourly quota:
   - Redis counter catches excess.
   - Slack webhook receives an immediate alert.
   - Jobs are safely rescheduled to the start of the next hour.
   - Open `http://localhost:5000/admin/queues` to watch them in the `delayed` tab in real time.

---

## 🌐 Production Deployment Guide (Live URL)

Follow these steps to deploy a live, publicly accessible instance:

### Step 1: Deploy Redis & MySQL (Free Cloud Providers)

1. **Redis**:
   - Create a free account at [Upstash](https://upstash.com).
   - Create a Redis database (select nearest region).
   - Copy the `redis://...` or `rediss://...` connection URL.
2. **MySQL**:
   - Create a free database on [Aiven](https://aiven.io) or [TiDB Cloud](https://tidbcloud.com) or [Railway](https://railway.app).
   - Copy the MySQL connection URI (`mysql://user:pass@host:port/dbname`).

---

### Step 2: Deploy Backend to Render or Railway

#### Option A: Render (Web Service)
1. Go to [Render.com](https://render.com) and create a **New Web Service**.
2. Connect your GitHub repository.
3. Set the following settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `node dist/server.js`
4. In **Environment Variables**, add:
   ```env
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=mysql://user:pass@host:port/dbname
   REDIS_URL=rediss://default:pass@host:port
   JWT_SECRET=your-random-jwt-secret-string
   DEFAULT_MIN_DELAY_MS=2000
   DEFAULT_MAX_HOURLY_LIMIT=200
   FRONTEND_URL=https://your-frontend-app.vercel.app
   ```
5. Deploy the service. Once deployed, push your schema to the cloud DB:
   ```bash
   DATABASE_URL="your-production-mysql-url" npx prisma db push
   ```
6. Copy your backend service URL (e.g., `https://reachinbox-backend.onrender.com`).

---

### Step 3: Deploy Frontend to Vercel

1. Go to [Vercel.com](https://vercel.com) and click **Add New → Project**.
2. Select your repository.
3. Configure the project:
   - **Root Directory**: Click edit and select `frontend`.
   - **Framework Preset**: `Next.js`.
4. In **Environment Variables**, add:
   ```env
   NEXT_PUBLIC_API_URL=https://reachinbox-backend.onrender.com/api
   ```
5. Click **Deploy**. Vercel will build and assign your live URL (e.g., `https://reachinbox-scheduler.vercel.app`).
6. Update `FRONTEND_URL` on Render with your Vercel URL to allow CORS.

---

## 📁 Repository Directory Structure

```
reachinbox-scheduler/
├── README.md                          # Project documentation & deployment guide
├── docker-compose.yml                 # Local container configurations
├── backend/
│   ├── prisma/
│   │   └── schema.prisma              # User and EmailJob schema models
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts                 # Zod environment variable validation
│   │   ├── lib/
│   │   │   ├── db.ts                  # Prisma client instance
│   │   │   ├── redis.ts               # Redis connection (supports REDIS_URL and options)
│   │   │   ├── mailer.ts              # Nodemailer Ethereal SMTP with attachments
│   │   │   └── elastic.ts             # Elasticsearch client with MySQL query fallback
│   │   ├── queue/
│   │   │   ├── producer.ts            # BullMQ schedule producer
│   │   │   └── worker.ts              # Worker: concurrency, rate limit, delay, Slack alert
│   │   ├── routes/
│   │   │   └── api.ts                 # REST endpoints (schedule, list, clear, delete, search)
│   │   ├── scripts/
│   │   │   └── demo_scenarios.ts      # Automated test runner for restart and rate limiting
│   │   └── server.ts                  # Server entry, Bull Board, startup reconciliation
│   └── package.json
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx             # Root layout with Inter font
    │   │   ├── page.tsx               # Login page with student credentials footer
    │   │   └── dashboard/page.tsx     # Main dashboard with filter popover & search
    │   ├── components/
    │   │   ├── ComposeView.tsx        # Rich-text toolbar, attachments, send later
    │   │   ├── EmailDetailView.tsx    # Email details, persistent stars, archive, delete
    │   │   └── EmailTable.tsx         # Outbox list table with status badges
    │   └── lib/
    │       └── api.ts                 # Type-safe API client wrappers
    └── package.json
```

---

## 📜 API Reference Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Direct login with email (creates/fetches user session) |
| `POST` | `/api/auth/google` | Google OAuth token verification |
| `POST` | `/api/schedule` | Schedule email batch with delay, hourly limit, attachments |
| `GET` | `/api/emails/scheduled`| Fetch all pending scheduled emails |
| `GET` | `/api/emails/sent` | Fetch all dispatched and failed emails |
| `GET` | `/api/emails/search?q=`| Search emails across subject, body, recipient, sender |
| `DELETE`| `/api/emails/:id` | Permanently delete a single email job |
| `DELETE`| `/api/emails/sent` | Clear all sent email logs |
| `POST` | `/api/slack/webhook` | Save incoming Slack alert webhook URL |
| `GET` | `/api/slack/status` | Check Slack integration connection status |
| `GET` | `/admin/queues` | Live BullMQ dashboard interface |

---

## 🛡️ License

This project was built for the ReachInbox/Outbox Labs SDE Intern Assignment. All rights reserved by Nipun Dewangan (RA2311047010074).
