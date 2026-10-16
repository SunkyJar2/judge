import { json, error, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '#lib/server/rbac';
import { prisma } from '#lib/server/prisma';
import { z } from 'zod';
import { dispatchSubmission } from '#lib/server/judge/dispatcher';
import { Verdict } from '@prisma/client';

const submissionSchema = z.object({
  problemId: z.string().min(1),
  languageId: z.number().int().positive(),
  sourceCode: z.string().min(1).max(128 * 1024, 'Source code cannot exceed 128 KB'),
});

export const POST: RequestHandler = async (event) => {
  const user = requireAuth(event);

  const body = await event.request.json().catch(() => null);
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    throw error(400, parsed.error.issues[0]?.message || 'Invalid submission payload.');
  }

  const { problemId, languageId, sourceCode } = parsed.data;

  // Verify problem exists
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true, testcaseVersion: true },
  });

  if (!problem) {
    throw error(404, `Problem "${problemId}" not found.`);
  }

  // Create submission record
  const submission = await prisma.submission.create({
    data: {
      userId: user.id,
      problemId: problem.id,
      languageId,
      sourceCode,
      verdict: Verdict.IN_QUEUE,
      testcaseVersion: problem.testcaseVersion,
    },
  });

  // Launch asynchronous evaluation
  await dispatchSubmission(submission.id);

  return json({
    success: true,
    submissionId: submission.id,
  });
};

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user;
  const problemId = url.searchParams.get('problemId');
  const userIdFilter = url.searchParams.get('userId');
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));

  const where: any = {};
  if (problemId) where.problemId = problemId;
  if (userIdFilter) where.userId = userIdFilter;

  // Public submission list
  const submissions = await prisma.submission.findMany({
    where,
    select: {
      id: true,
      userId: true,
      problemId: true,
      languageId: true,
      verdict: true,
      passedTests: true,
      totalTests: true,
      maxExecutionMs: true,
      maxMemoryUsedKb: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          totalPoints: true,
        },
      },
      problem: {
        select: {
          id: true,
          title: true,
          points: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return json({
    success: true,
    submissions,
  });
};

