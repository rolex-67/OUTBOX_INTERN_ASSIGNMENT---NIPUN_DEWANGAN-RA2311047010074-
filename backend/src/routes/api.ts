import { Router, Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { db } from '../lib/db.js';
import { scheduleEmailJob } from '../queue/producer.js';
import { searchEmails, indexEmail } from '../lib/elastic.js';
import { env } from '../config/env.js';

export const apiRouter = Router();

function getAuthUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    return jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      email: string;
      name?: string;
      avatar?: string;
    };
  } catch {
    return null;
  }
}

const scheduleSchema = z.object({
  sender: z.string().email(),
  recipients: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  startTime: z.string().optional(),
  delayBetweenEmailsMs: z.coerce.number().min(0).optional(),
  hourlyLimit: z.coerce.number().min(1).optional(),
});

apiRouter.post('/schedule', async (req: Request, res: Response) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }

  const { sender, recipients, subject, body, startTime, delayBetweenEmailsMs, hourlyLimit } = parsed.data;
  const auth = getAuthUser(req);

  const baseStartTime = startTime ? new Date(startTime).getTime() : Date.now();
  const interDelay = delayBetweenEmailsMs ?? env.DEFAULT_MIN_DELAY_MS;
  const limit = hourlyLimit ?? env.DEFAULT_MAX_HOURLY_LIMIT;

  const createdJobs = [];

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const targetScheduledTime = new Date(baseStartTime + i * interDelay);

    const emailRecord = await db.emailJob.create({
      data: {
        jobId: `job_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
        userId: auth?.id ?? null,
        sender,
        recipient,
        subject,
        body,
        scheduledAt: targetScheduledTime,
        status: 'SCHEDULED',
      },
    });

    await scheduleEmailJob(
      {
        emailJobId: emailRecord.id,
        sender,
        recipient,
        subject,
        body,
        scheduledAt: targetScheduledTime.toISOString(),
        hourlyLimit: limit,
        delayBetweenEmailsMs: interDelay,
        userId: auth?.id,
      },
      targetScheduledTime
    );

    await indexEmail({
      emailJobId: emailRecord.id,
      userId: auth?.id,
      sender,
      recipient,
      subject,
      body,
      status: 'SCHEDULED',
      scheduledAt: targetScheduledTime.toISOString(),
      sentAt: null,
    });

    createdJobs.push({
      id: emailRecord.id,
      recipient,
      scheduledAt: targetScheduledTime,
    });
  }

  return res.json({
    success: true,
    scheduledCount: createdJobs.length,
    jobs: createdJobs,
  });
});

apiRouter.get('/emails/scheduled', async (req: Request, res: Response) => {
  const auth = getAuthUser(req);
  const emails = await db.emailJob.findMany({
    where: {
      status: 'SCHEDULED',
      ...(auth?.id ? { userId: auth.id } : {}),
    },
    orderBy: { scheduledAt: 'asc' },
    take: 100,
  });

  return res.json({ emails });
});

apiRouter.get('/emails/sent', async (req: Request, res: Response) => {
  const auth = getAuthUser(req);
  const emails = await db.emailJob.findMany({
    where: {
      status: { in: ['SENT', 'FAILED'] },
      ...(auth?.id ? { userId: auth.id } : {}),
    },
    orderBy: { sentAt: 'desc' },
    take: 100,
  });

  return res.json({ emails });
});

apiRouter.get('/emails/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  if (!query.trim()) {
    return res.json({ emails: [] });
  }

  const auth = getAuthUser(req);
  const results = await searchEmails(query.trim(), auth?.id);
  return res.json({ emails: results });
});

apiRouter.post('/slack/webhook', async (req: Request, res: Response) => {
  const { webhookUrl } = req.body;
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    return res.status(400).json({ error: 'Valid webhookUrl required' });
  }

  const auth = getAuthUser(req);
  if (auth?.id) {
    await db.user.update({
      where: { id: auth.id },
      data: { slackWebhookUrl: webhookUrl },
    });
  }

  return res.json({ success: true, message: 'Slack webhook connected successfully' });
});

apiRouter.get('/slack/status', async (req: Request, res: Response) => {
  const auth = getAuthUser(req);
  if (auth?.id) {
    const user = await db.user.findUnique({
      where: { id: auth.id },
      select: { slackWebhookUrl: true },
    });
    return res.json({
      connected: Boolean(user?.slackWebhookUrl || env.SLACK_WEBHOOK_URL),
      webhookUrl: user?.slackWebhookUrl || (env.SLACK_WEBHOOK_URL ? 'Configured via Environment' : null),
    });
  }

  return res.json({
    connected: Boolean(env.SLACK_WEBHOOK_URL),
    webhookUrl: env.SLACK_WEBHOOK_URL ? 'Configured via Environment' : null,
  });
});

apiRouter.post('/auth/google', async (req: Request, res: Response) => {
  const { email, name, avatar } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = await db.user.upsert({
    where: { email },
    update: {
      name: name ?? undefined,
      avatar: avatar ?? undefined,
    },
    create: {
      email,
      name: name ?? 'User',
      avatar: avatar ?? '',
    },
  });

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      slackWebhookUrl: user.slackWebhookUrl,
    },
  });
});

apiRouter.get('/auth/me', async (req: Request, res: Response) => {
  const auth = getAuthUser(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await db.user.findUnique({
    where: { id: auth.id },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      slackWebhookUrl: user.slackWebhookUrl,
    },
  });
});
