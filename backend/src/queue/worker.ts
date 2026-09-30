import { Worker, Job, DelayedError } from 'bullmq';
import axios from 'axios';
import { redis, redisOptions } from '../lib/redis.js';
import { sendEmail } from '../lib/mailer.js';
import { db } from '../lib/db.js';
import { env } from '../config/env.js';
import { indexEmail } from '../lib/elastic.js';
import { EmailJobData } from './producer.js';

async function triggerSlackRateLimitAlert(sender: string, limit: number, userId?: string) {
  let webhookUrl = env.SLACK_WEBHOOK_URL;

  if (userId) {
    try {
      const user = await db.user.findUnique({ where: { id: userId }, select: { slackWebhookUrl: true } });
      if (user?.slackWebhookUrl) {
        webhookUrl = user.slackWebhookUrl;
      }
    } catch (err: any) {
      console.warn('Could not query user slack webhook:', err.message);
    }
  }

  if (!webhookUrl) {
    console.log(`Rate limit reached for sender ${sender}. No Slack webhook configured.`);
    return;
  }

  try {
    await axios.post(webhookUrl, {
      text: `⚠️ *ReachInbox Rate Limit Alert*: Sender \`${sender}\` reached the hourly limit of *${limit}* emails. Excess emails are safely delayed to the next hour window.`,
    });
    console.log(`Slack alert dispatched for sender ${sender}`);
  } catch (err: any) {
    console.error(`Failed to send Slack alert: ${err.message}`);
  }
}

export function createEmailWorker(concurrency = 5) {
  const worker = new Worker<EmailJobData>(
    'email-queue',
    async (job: Job<EmailJobData>, token?: string) => {
      const { emailJobId, sender, recipient, subject, body, hourlyLimit, delayBetweenEmailsMs, userId } = job.data;
      const limit = hourlyLimit ?? env.DEFAULT_MAX_HOURLY_LIMIT;
      const minDelay = delayBetweenEmailsMs ?? env.DEFAULT_MIN_DELAY_MS;

      // Rate limit check using atomic Redis counter per hour window
      const now = Date.now();
      const hourWindow = Math.floor(now / (60 * 60 * 1000));
      const rateKey = `ratelimit:${sender}:${hourWindow}`;

      const count = await redis.incr(rateKey);
      if (count === 1) {
        await redis.expire(rateKey, 7200);
      }

      if (count > limit) {
        // Decrement so counter reflects actual dispatched volume
        await redis.decr(rateKey);

        const nextHourTimestamp = (hourWindow + 1) * 60 * 60 * 1000;
        const delayUntilNextHour = Math.max(1000, nextHourTimestamp - now + 1000);

        // Deduplicate Slack alerts per sender per hour window
        const alertFlagKey = `ratelimit:alerted:${sender}:${hourWindow}`;
        const alreadyAlerted = await redis.set(alertFlagKey, '1', 'EX', 7200, 'NX');
        if (alreadyAlerted) {
          await triggerSlackRateLimitAlert(sender, limit, userId);
        }

        try {
          await db.emailJob.update({
            where: { id: emailJobId },
            data: { scheduledAt: new Date(nextHourTimestamp) },
          });
        } catch (dbErr: any) {
          console.warn(`Could not update email job ${emailJobId} reschedule time:`, dbErr.message);
        }

        if (token) {
          await job.moveToDelayed(now + delayUntilNextHour, token);
          throw new DelayedError();
        }
        return;
      }

      // Enforce inter-email minimum delay
      if (minDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, minDelay));
      }

      await sendEmail({
        from: sender,
        to: recipient,
        subject,
        body,
        attachments: job.data.attachments,
      });

      try {
        const updated = await db.emailJob.update({
          where: { id: emailJobId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
          },
        });
        await indexEmail({
          emailJobId: updated.id,
          userId: updated.userId || undefined,
          sender: updated.sender,
          recipient: updated.recipient,
          subject: updated.subject,
          body: updated.body,
          status: updated.status,
          scheduledAt: updated.scheduledAt.toISOString(),
          sentAt: updated.sentAt ? updated.sentAt.toISOString() : null,
        });
      } catch (dbErr: any) {
        console.warn(`Could not update email job ${emailJobId} status to SENT:`, dbErr.message);
      }
    },
    {
      connection: redisOptions,
      concurrency,
    }
  );

  worker.on('failed', async (job, err) => {
    if (err instanceof DelayedError) {
      return;
    }
    console.error(`Email job ${job?.id} failed:`, err.message);
    if (job?.data?.emailJobId) {
      try {
        const failedJob = await db.emailJob.update({
          where: { id: job.data.emailJobId },
          data: {
            status: 'FAILED',
            error: err.message,
          },
        });
        await indexEmail({
          emailJobId: failedJob.id,
          userId: failedJob.userId || undefined,
          sender: failedJob.sender,
          recipient: failedJob.recipient,
          subject: failedJob.subject,
          body: failedJob.body,
          status: failedJob.status,
          scheduledAt: failedJob.scheduledAt.toISOString(),
          sentAt: null,
        });
      } catch (dbErr: any) {
        console.warn(`Could not update email job ${job.data.emailJobId} status to FAILED:`, dbErr.message);
      }
    }
  });

  return worker;
}
