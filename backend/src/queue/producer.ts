import { Queue } from 'bullmq';
import { redisOptions } from '../lib/redis.js';

export interface EmailJobData {
  emailJobId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  attachments?: Array<{
    name: string;
    size: number;
    type: string;
    data?: string;
  }>;
  scheduledAt: string;
  hourlyLimit?: number;
  delayBetweenEmailsMs?: number;
  userId?: string;
}

export const q = new Queue<EmailJobData>('email-queue', {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

export async function scheduleEmailJob(data: EmailJobData, scheduledAt: Date) {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());

  return q.add('send-email', data, {
    jobId: data.emailJobId,
    delay,
  });
}
