import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '#lib/server/prisma';
import { redis } from '#lib/server/redis';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const GET: RequestHandler = async () => {
  const health: Record<string, any> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {},
  };

  // 1. PostgreSQL check
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = { status: 'healthy' };
  } catch (err: any) {
    health.status = 'degraded';
    health.services.database = { status: 'down', error: err.message };
  }

  // 2. Redis check (optional in serverless mode)
  if (!process.env.REDIS_URL && process.env.SERVERLESS === 'true') {
    health.services.redis = { status: 'skipped (serverless)' };
  } else {
    try {
      const pong = await redis.ping();
      health.services.redis = { status: pong === 'PONG' ? 'healthy' : 'unexpected', response: pong };
    } catch (err: any) {
      if (process.env.SERVERLESS === 'true') {
        health.services.redis = { status: 'offline', note: 'Redis optional in serverless' };
      } else {
        health.status = 'degraded';
        health.services.redis = { status: 'down', error: err.message };
      }
    }
  }

  // 3. Code Execution Engine check (Piston vs Judge0)
  const isPiston = process.env.EXECUTION_ENGINE === 'piston' || (!process.env.JUDGE0_URL && !!process.env.PISTON_URL);

  if (isPiston) {
    try {
      const pistonUrl = (process.env.PISTON_URL || 'https://emkc.org/api/v2/piston').replace(/\/+$/, '').replace(/\/execute$/, '');
      const runtimesUrl = pistonUrl.endsWith('/api/v2') ? `${pistonUrl}/runtimes` : `${pistonUrl}/api/v2/runtimes`;
      const res = await fetch(runtimesUrl);
      if (res.ok) {
        health.services.piston = { status: 'healthy', httpStatus: res.status };
      } else {
        health.status = 'degraded';
        health.services.piston = { status: 'unhealthy', httpStatus: res.status };
      }
    } catch (err: any) {
      health.status = 'degraded';
      health.services.piston = { status: 'down', error: err.message };
    }
  } else {
    // Judge0 check
    try {
      const judge0Url = process.env.JUDGE0_URL || 'http://localhost:2358';
      const judge0Token = process.env.JUDGE0_TOKEN || 'judge0_secret_token_123';
      const res = await fetch(`${judge0Url}/system_info`, {
        headers: { 'X-Judge0-Token': judge0Token },
      });
      if (res.ok) {
        health.services.judge0 = { status: 'healthy', httpStatus: res.status };
      } else {
        health.status = 'degraded';
        health.services.judge0 = { status: 'unhealthy', httpStatus: res.status };
      }
    } catch (err: any) {
      health.status = 'degraded';
      health.services.judge0 = { status: 'down', error: err.message };
    }
  }

  // 4. CAS Storage check
  try {
    const storageRoot = process.env.STORAGE_DIR || './storage';
    await fs.access(path.resolve(storageRoot, 'testcases'));
    health.services.storage = { status: 'healthy' };
  } catch (err: any) {
    health.status = 'degraded';
    health.services.storage = { status: 'down', error: err.message };
  }

  return json(health, { status: health.status === 'ok' ? 200 : 503 });
};

