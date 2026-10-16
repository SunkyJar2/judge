import { json, error, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '#lib/server/rbac';
import { createJudge0Submission, type Judge0SubmissionRequest } from '#lib/server/judge/client';
import { executeWithPiston } from '#lib/server/judge/piston';
import { z } from 'zod';
import { redis } from '#lib/server/redis';

const playgroundSchema = z.object({
  sourceCode: z.string().min(1).max(128 * 1024, 'Source code cannot exceed 128 KB'),
  languageId: z.number().int().positive(),
  stdin: z.string().max(64 * 1024, 'Standard input cannot exceed 64 KB').default(''),
});

export const POST: RequestHandler = async (event) => {
  const user = requireAuth(event);

  // Rate Limiting & Concurrency Lock via Redis (if available)
  const rateLimitKey = `rate:playground:${user.id}`;
  const lockKey = `lock:playground:${user.id}`;
  let lockAcquired = false;

  if (redis.isOpen) {
    try {
      const currentCount = await redis.incr(rateLimitKey);
      if (currentCount === 1) {
        await redis.expire(rateLimitKey, 60);
      }
      if (currentCount > 10) {
        throw error(429, 'Playground rate limit exceeded (10 runs / minute). Please wait.');
      }

      const acquired = await redis.set(lockKey, '1', { NX: true, EX: 10 });
      if (!acquired) {
        throw error(429, 'Another playground execution is already in progress. Please wait.');
      }
      lockAcquired = true;
    } catch (err: any) {
      if (err?.status === 429) throw err;
      // Continue if Redis error
    }
  }

  try {
    const body = await event.request.json().catch(() => null);
    const parsed = playgroundSchema.safeParse(body);
    if (!parsed.success) {
      throw error(400, parsed.error.issues[0]?.message || 'Invalid payload.');
    }

    const { sourceCode, languageId, stdin } = parsed.data;

    const isPiston = process.env.EXECUTION_ENGINE === 'piston' || (!process.env.JUDGE0_URL && !!process.env.PISTON_URL);

    if (isPiston) {
      const pistonRes = await executeWithPiston({
        sourceCode,
        languageId,
        stdin,
        timeLimitSec: 3.0,
      });

      return json({
        success: true,
        status: {
          id: pistonRes.statusId,
          description: pistonRes.verdict,
        },
        stdout: pistonRes.stdout,
        stderr: pistonRes.stderr,
        compile_output: pistonRes.compileOutput,
        time: (pistonRes.executionTimeMs / 1000).toFixed(3),
        memory: pistonRes.memoryUsedKb,
      });
    }

    // Default: Judge0
    const judge0Req: Judge0SubmissionRequest = {
      source_code: sourceCode,
      language_id: languageId,
      stdin,
      cpu_time_limit: 3.0,
      wall_time_limit: 5.0,
      memory_limit: 256 * 1024, // 256 MB in KB
    };

    const response = await createJudge0Submission(judge0Req, true);

    return json({
      success: true,
      status: response.status,
      stdout: response.stdout,
      stderr: response.stderr,
      compile_output: response.compile_output,
      time: response.time,
      memory: response.memory,
    });
  } finally {
    if (lockAcquired && redis.isOpen) {
      await redis.del(lockKey).catch(() => {});
    }
  }
};

