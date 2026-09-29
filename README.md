# ReachInbox Email Job Scheduler

Production-grade distributed email scheduling service and real-time dashboard built for ReachInbox hiring assignment.

## Tech Stack
- **Backend**: Express.js, TypeScript, BullMQ, Redis, PostgreSQL (Prisma), Nodemailer (Ethereal Email), Elasticsearch
- **Frontend**: Next.js 14/15 (App Router), Tailwind CSS, TypeScript, PapaParse
- **Queue & Monitoring**: BullMQ delayed jobs with Bull Board live dashboard

## Core Features
- Delay-based scheduling using BullMQ (strictly zero cron jobs)
- Persistent queue state across server and worker restarts
- Strict idempotency via deterministic job IDs
- Minimum inter-email delay throttling & hourly per-sender rate limiting
- Automatic non-destructive rescheduling on rate limit breach
- Live Slack notification when sender hourly threshold is hit
- Real-time search index via Elasticsearch
- Interactive frontend matching modern dashboard specs with CSV lead ingestion
