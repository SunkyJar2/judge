import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://:judge0_redis_secret@localhost:6379';

const globalForRedis = globalThis as unknown as {
  redisClient?: ReturnType<typeof createClient>;
};

export const redis = globalForRedis.redisClient ?? createClient({ url: redisUrl });

if (!redis.isOpen) {
  redis.connect().catch((err) => {
    console.error('Failed to connect to Redis:', err);
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redisClient = redis;
}

export function createRedisSubscriber() {
  const sub = createClient({ url: redisUrl });
  return sub;
}

