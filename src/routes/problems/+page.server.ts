import type { PageServerLoad } from './$types';
import { prisma } from '#lib/server/prisma';

export const load: PageServerLoad = async ({ url, locals }) => {
  const selectedModule = url.searchParams.get('module') || undefined;
  const searchQuery = url.searchParams.get('q') || undefined;

  const whereClause: any = {};
  if (selectedModule) {
    whereClause.module = selectedModule;
  }
  if (searchQuery) {
    whereClause.OR = [
      { title: { contains: searchQuery, mode: 'insensitive' } },
      { code: { contains: searchQuery, mode: 'insensitive' } },
    ];
  }

  const [problems, modules] = await Promise.all([
    prisma.problem.findMany({
      where: whereClause,
      select: {
        id: true,
        module: true,
        group: true,
        code: true,
        title: true,
        points: true,
        timeLimit: true,
        memoryLimit: true,
        validationMode: true,
        _count: {
          select: {
            testcases: true,
            submissions: true,
          },
        },
      },
      orderBy: [
        { module: 'asc' },
        { group: 'asc' },
        { code: 'asc' },
      ],
    }),
    prisma.problem.findMany({
      select: { module: true },
      distinct: ['module'],
      orderBy: { module: 'asc' },
    }),
  ]);

  // Check solved status for logged in user
  let solvedProblemIds = new Set<string>();
  if (locals.user) {
    const solved = await prisma.userProblemPoints.findMany({
      where: { userId: locals.user.id },
      select: { problemId: true },
    });
    solvedProblemIds = new Set(solved.map((s) => s.problemId));
  }

  return {
    problems: problems.map((p) => ({
      ...p,
      isSolved: solvedProblemIds.has(p.id),
      testcaseCount: p._count.testcases,
      submissionCount: p._count.submissions,
    })),
    modules: modules.map((m) => m.module),
    selectedModule: selectedModule || null,
    searchQuery: searchQuery || '',
  };
};

