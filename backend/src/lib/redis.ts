import { Redis, RedisOptions } from 'ioredis';
import { env } from '../config/env.js';

export const redisOptions: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const redis = new Redis(redisOptions);

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});
