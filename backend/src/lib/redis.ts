import { Redis, RedisOptions } from 'ioredis';
import { env } from '../config/env.js';

export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  : new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

export const redisOptions: RedisOptions = env.REDIS_URL
  ? (redis.options as RedisOptions)
  : {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});
