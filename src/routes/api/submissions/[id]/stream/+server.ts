import { error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '#lib/server/prisma';
import { createRedisSubscriber } from '#lib/server/redis';
import { Verdict } from '@prisma/client';

export const GET: RequestHandler = async ({ params }) => {
  const submissionId = params.id;
  if (!submissionId) throw error(400, 'Submission ID required.');

  // Fetch initial submission state from DB to solve late-join race condition
  const initialSubmission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      verdict: true,
      passedTests: true,
      totalTests: true,
      maxExecutionMs: true,
      maxMemoryUsedKb: true,
      completedAt: true,
    },
  });

  if (!initialSubmission) {
    throw error(404, 'Submission not found.');
  }

  const subscriber = await createRedisSubscriber();
  const channel = `submission:${submissionId}`;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // 1. Immediately emit current database snapshot
      sendEvent('state', {
        submissionId: initialSubmission.id,
        verdict: initialSubmission.verdict,
        passedTests: initialSubmission.passedTests,
        totalTests: initialSubmission.totalTests,
        maxExecutionMs: initialSubmission.maxExecutionMs,
        maxMemoryUsedKb: initialSubmission.maxMemoryUsedKb,
      });

      // 2. If already completed, close stream immediately
      const isTerminal = (verdict: Verdict) =>
        verdict !== Verdict.IN_QUEUE &&
        verdict !== Verdict.COMPILING &&
        verdict !== Verdict.RUNNING;

      if (isTerminal(initialSubmission.verdict)) {
        await subscriber.disconnect();
        controller.close();
        return;
      }

      // 3. Subscribe to Redis Pub/Sub channel
      await subscriber.subscribe(channel, (message) => {
        try {
          const payload = JSON.parse(message);
          sendEvent('state', payload);

          if (payload.verdict && isTerminal(payload.verdict)) {
            subscriber.unsubscribe(channel);
            subscriber.disconnect();
            controller.close();
          }
        } catch (err) {
          console.error('Error handling Redis SSE message:', err);
        }
      });
    },

    async cancel() {
      try {
        await subscriber.unsubscribe(channel);
        await subscriber.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
};

