import express, { Request, Response } from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { env } from './config/env.js';
import { q } from './queue/producer.js';
import { createEmailWorker } from './queue/worker.js';
import { apiRouter } from './routes/api.js';
import { initElasticsearch } from './lib/elastic.js';

const app = express();

app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));

// BullMQ Live Dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(q)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// REST APIs
app.use('/api', apiRouter);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

import { db } from './lib/db.js';
import { scheduleEmailJob } from './queue/producer.js';

// Initialize worker and search
const worker = createEmailWorker(5);
initElasticsearch().catch((err) => console.warn('ES Init error:', err.message));

async function reconcilePendingJobsOnStartup() {
  try {
    const pendingJobs = await db.emailJob.findMany({
      where: { status: 'SCHEDULED' },
    });
    if (pendingJobs.length > 0) {
      console.log(`[Startup Recovery] Found ${pendingJobs.length} SCHEDULED jobs in MySQL.`);
      for (const job of pendingJobs) {
        const bullJob = await q.getJob(job.id);
        if (!bullJob) {
          console.log(`[Startup Recovery] Restoring BullMQ job for ${job.recipient} (scheduled for ${job.scheduledAt})`);
          await scheduleEmailJob(
            {
              emailJobId: job.id,
              sender: job.sender,
              recipient: job.recipient,
              subject: job.subject,
              body: job.body,
              attachments: job.attachments ? JSON.parse(job.attachments) : undefined,
              scheduledAt: job.scheduledAt.toISOString(),
            },
            job.scheduledAt
          );
        }
      }
    }
  } catch (err: any) {
    console.warn('Startup job reconciliation notice:', err.message);
  }
}

reconcilePendingJobsOnStartup();

const server = app.listen(env.PORT, () => {
  console.log(`ReachInbox Scheduler backend running on port ${env.PORT}`);
  console.log(`BullMQ live dashboard available at http://localhost:${env.PORT}/admin/queues`);
});

async function shutdown() {
  console.log('Gracefully terminating scheduler services...');
  server.close();
  await worker.close();
  await q.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
