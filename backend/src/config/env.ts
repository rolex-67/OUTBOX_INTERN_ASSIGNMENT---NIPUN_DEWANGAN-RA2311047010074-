import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('mysql://root:@localhost:3306/reachinbox_scheduler'),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  ETHEREAL_USER: z.string().optional(),
  ETHEREAL_PASS: z.string().optional(),
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  DEFAULT_MIN_DELAY_MS: z.coerce.number().default(2000),
  DEFAULT_MAX_HOURLY_LIMIT: z.coerce.number().default(200),
  SLACK_WEBHOOK_URL: z.string().optional(),
  JWT_SECRET: z.string().default('reachinbox-scheduler-jwt-secret-xyz'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
