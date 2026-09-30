# 🎬 5-Minute Demo Video Walkthrough Script & Speaking Notes

**Student Name**: Nipun Dewangan  
**Registration Number**: RA2311047010074  
**Project**: ReachInbox / Outbox Labs SDE Intern Assignment  
**Video Length Target**: Max 5 minutes (approx. 4:30 – 4:50)  

---

## 🕒 Video Timeline & Step-by-Step Script

| Timestamp | Section | Visual / Screen Action | Spoken Script ("What to Say") |
|---|---|---|---|
| **0:00 – 0:35** | **Introduction & Student Details** | • Start screen on Login Page (`http://localhost:3000`).<br>• Point mouse to the footer signature: `MADE BY NIPUN DEWANGAN • RA2311047010074`.<br>• Click **Direct Access to Dashboard**. | *"Hello everyone, my name is Nipun Dewangan, Registration Number RA2311047010074. Today, I am presenting my solution for the ReachInbox distributed email job scheduler assignment. The goal of this project was to engineer a production-grade, fault-tolerant outbox scheduling system using Next.js, Express, BullMQ, Redis, and MySQL. Let’s enter the dashboard."* |
| **0:35 – 1:35** | **Creating Scheduled Emails** | • Click **Compose** in the sidebar.<br>• Enter two recipient emails (e.g., `lead1@example.com`, `lead2@example.com`) or show **Upload List** (`.csv` / `.txt` parsing).<br>• Highlight **Delay between 2 emails** (`2s`) and **Hourly Limit** (`50`).<br>• Type a subject and message body; demonstrate the toolbar buttons: **Bold (`B`)**, **Italics (`I`)**, **Heading (`TT`)**.<br>• Click the paperclip icon (`Attach`) to attach a sample file/image.<br>• Click **Send Later** and pick a time 2 minutes into the future.<br>• Click **Schedule Send**. | *"In our Compose view, pixel-matched to the Figma design, we can enter multiple recipients manually or upload a CSV list using client-side parsing. We have granular controls for inter-email delay and hourly sending quotas to safeguard sender domain reputation. Our rich-text editor supports headings, bold, italics, quotes, and real file attachments. We’ll schedule this outreach batch for 2 minutes from now. Notice how the job immediately appears in our Scheduled queue."* |
| **1:35 – 2:20** | **Dashboard Overview & Instant Search** | • Show the **Scheduled** tab with its countdown badge `Clock: [Day & Time]`.<br>• Switch to the **Sent** tab to show previously dispatched emails.<br>• Type in the **Search Bar** (e.g. `lead` or `kabir`) — point out the instant 0ms matching banner, then click **Clear Search**.<br>• Click the **Filter** funnel icon — show Status, Date Range, Attachments toggle, and active filter chips.<br>• Click on an email row to open **EmailDetailView** (show Star toggle, Archive, headers drawer, and attachment download). | *"The dashboard provides two core views: Scheduled and Sent. The status badges reflect the exact state stored in MySQL. Our search bar provides instant, zero-latency client filtering across subjects, bodies, and recipients, backed by a 200ms debounced server query to Elasticsearch and MySQL. We also have a multi-criteria filter dropdown, and a detailed view with persistent stars, archiving, and single-email deletion."* |
| **2:20 – 3:30** | **Server Restart & Fault Tolerance Scenario** | • Ensure there is an email scheduled for 1–2 minutes in the future.<br>• Open your backend terminal window side-by-side.<br>• Press `Ctrl + C` to kill the backend server process.<br>• Point out that the backend is completely offline.<br>• Wait 10 seconds, then restart: `npm run dev`.<br>• Point to the console log: `[Startup Recovery] Found 1 SCHEDULED jobs in MySQL...`<br>• Return to browser: watch the scheduled email automatically process when the time arrives and transition to the **Sent** tab. | *"Now for the core fault-tolerance requirement: what happens if the server crashes or restarts? Let’s kill the backend server completely right now with Ctrl+C. The server is completely offline. Because our architecture does not rely on in-memory timers or cron loops, all delayed jobs remain safe inside Redis sorted sets and MySQL. When I restart the server with `npm run dev`, our startup recovery verifies any pending jobs, the BullMQ worker reconnects, and as soon as the scheduled timestamp arrives, the email dispatches through SMTP with zero data loss."* |
| **3:30 – 4:30** | **(Bonus) Rate Limiting & Throttling Under Load** | • Open the BullMQ Live Monitor (`http://localhost:5000/admin/queues`) in a separate browser tab.<br>• In terminal, run the test script: `npx tsx src/scripts/demo_scenarios.ts`.<br>• Point out terminal output and BullMQ UI: emails 1 & 2 dispatched with 2s delay; emails 3, 4, 5 hitting the hourly limit.<br>• Show the terminal log for Slack: `Slack alert dispatched`.<br>• Show excess jobs moved to the `delayed` tab for the next hour window. | *"Finally, let’s demonstrate how our system behaves under heavy load. I'm dispatching 5 emails with an hourly limit of 2 and a 2-second delay. Notice: emails 1 and 2 send with the required delay. But when email 3 arrives, our atomic Redis counter detects that the hourly quota has been reached. Instead of dropping the email or failing, BullMQ calls `moveToDelayed()` to park it at the start of the next hour window, and immediately fires a rate-limit alert to our Slack webhook. Zero emails dropped, zero domain blacklisting."* |
| **4:30 – 4:55** | **Conclusion & Wrap-Up** | • Switch back to the clean dashboard view. | *"To summarize, we built a production-ready, fault-tolerant email scheduler with persistent queues, ESP rate protection, instant live search, and a pixel-perfect Figma UI. All code is cleanly structured and documented in the repository. Thank you for reviewing my assignment!"* |

---

## 🧠 Key Technical Takeaways & Architecture Concepts

Keep these 5 points in mind if asked technical questions by the evaluators:

### 1. Why BullMQ over Cron / `setInterval`?
- **Cron / `setInterval` Limitations**:
  - In-memory timers (`setTimeout`) are wiped whenever the Node.js process restarts.
  - Polling every second with cron creates unnecessary database lock contention and CPU thrashing.
  - Cron lacks native distributed concurrency controls and retry backoffs.
- **BullMQ Advantages**:
  - Leverages Redis Sorted Sets (`ZSET`).
  - Stores execution times as integer epoch scores (`processAt`).
  - Redis triggers jobs with microsecond precision regardless of how many times the server boots, and supports horizontal scaling across multiple worker instances.

### 2. Dual-Layer Persistence (Redis + MySQL)
- **Redis 7**: Acts as the ultra-fast queue broker, tracking job states (`delayed`, `waiting`, `active`, `completed`).
- **MySQL 8 (via Prisma)**: Acts as the durable system of record for audit history, sender/recipient relationships, rich email HTML bodies, and base64 attachment blobs (`@db.LongText`).
- **Startup Reconciliation**: `reconcilePendingJobsOnStartup()` runs on server boot to scan MySQL for any unqueued `SCHEDULED` jobs and restore them to BullMQ if Redis was ever flushed while offline.

### 3. ESP & Sender Domain Protection Under Load
- **Inter-Email Delay**: Spreads bulk dispatches across time (e.g. 2000ms delay between consecutive sends).
- **Atomic Rate Limiter**: Uses `redis.incr(ratelimit:{sender}:{hourWindow})` with a 2-hour TTL.
- **Non-Dropping Reschedule**: When a sender exceeds their hourly quota, jobs are **never dropped**. The worker computes the next hour boundary and calls `job.moveToDelayed(nextHourTimestamp, token)`, deferring them cleanly while alerting the team via Slack.

### 4. Resilient Search Architecture
- Combines **0ms instant client-side filtering** on active memory with a **200ms debounced server query**.
- If Elasticsearch is available, it executes fuzzy multi-match queries with field boosting (`subject^3`).
- If Elasticsearch is unavailable, it automatically falls back to optimized MySQL index queries with zero downtime.

### 5. Figma Pixel-Perfect UI
- Light theme strictly matching Figma Node 59-4050.
- Features a functional rich text formatting toolbar (`TT`, `B`, `I`, `U`, lists, blockquotes, links, strikethrough, attachments, delay, hourly limit).
- Filter and sorting popover with status, date range, attachment toggles, and active removable filter chips.

---

## 🛠 Pre-Recording Checklist

Before you hit "Record":
1. **Ensure Local Services are Running**:
   - Backend: `npm run dev` (Port `5000`)
   - Frontend: `npm run dev` (Port `3000`)
   - MySQL running on port `3306`
   - Redis running on port `6379`
2. **Open Browser Tabs**:
   - **Tab 1**: `http://localhost:3000` (Login Page)
   - **Tab 2**: `http://localhost:5000/admin/queues` (BullMQ Dashboard)
3. **Open Terminal**:
   - Split view or separate window running `backend` so reviewers can see the worker logs live.
4. **Resolution**: Set recording resolution to 1080p (1920x1080) for clear text readability.
