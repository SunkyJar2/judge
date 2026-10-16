import type { PageServerLoad } from './$types';
import { prisma } from '#lib/server/prisma';

export const load: PageServerLoad = async ({ url }) => {
  const problemId = url.searchParams.get('problemId') || undefined;
  const userId = url.searchParams.get('userId') || undefined;

  const where: any = {};
  if (problemId) where.problemId = problemId;
  if (userId) where.userId = userId;

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
    take: 50,
  });

  return {
    submissions,
  };
};

