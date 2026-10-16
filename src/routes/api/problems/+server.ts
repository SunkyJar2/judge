import { json, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '#lib/server/prisma';

export const GET: RequestHandler = async ({ url, locals }) => {
  const moduleFilter = url.searchParams.get('module');
  const groupFilter = url.searchParams.get('group');
  const query = url.searchParams.get('q');

  const where: any = {};
  if (moduleFilter) where.module = moduleFilter;
  if (groupFilter) where.group = groupFilter;
  if (query) {
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { code: { contains: query, mode: 'insensitive' } }
    ];
  }

  const problems = await prisma.problem.findMany({
    where,
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
      testcaseVersion: true,
      _count: {
        select: {
          testcases: true,
          submissions: true
        }
      }
    },
    orderBy: [
      { module: 'asc' },
      { group: 'asc' },
      { code: 'asc' }
    ]
  });

  return json({
    success: true,
    problems: problems.map((p) => ({
      ...p,
      testcaseCount: p._count.testcases,
      submissionCount: p._count.submissions
    }))
  });
};

