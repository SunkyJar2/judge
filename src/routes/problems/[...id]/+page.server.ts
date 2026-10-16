import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '#lib/server/prisma';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { SUPPORTED_LANGUAGES } from '#lib/server/judge/client';

export const load: PageServerLoad = async ({ params, locals }) => {
  const rawId = params.id;
  if (!rawId) {
    throw error(400, 'Problem ID required.');
  }
  const decodedId = decodeURIComponent(rawId);

  const problem = await prisma.problem.findFirst({
    where: {
      OR: [{ id: rawId }, { id: decodedId }]
    },
    include: {
      testcases: {
        where: { isSample: true },
        select: {
          id: true,
          orderIndex: true,
          isSample: true,
          sampleInputPreview: true,
          sampleOutputPreview: true,
        },
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  if (!problem) {
    throw error(404, `Problem "${rawId}" not found.`);
  }

  // Render and sanitize Markdown statement
  let sanitizedHtml: string | null = null;
  if (problem.statementMd) {
    const rawHtml = await marked.parse(problem.statementMd);
    sanitizedHtml = sanitizeHtml(rawHtml);
  }

  // Check if solved by current user
  let isSolved = false;
  if (locals.user) {
    const award = await prisma.userProblemPoints.findUnique({
      where: {
        userId_problemId: {
          userId: locals.user.id,
          problemId: problem.id,
        },
      },
    });
    isSolved = !!award;
  }

  return {
    problem: {
      id: problem.id,
      module: problem.module,
      group: problem.group,
      code: problem.code,
      title: problem.title,
      statementHtml: sanitizedHtml,
      hasPdf: !!problem.statementPdfPath,
      timeLimit: problem.timeLimit,
      wallTimeLimit: problem.wallTimeLimit,
      memoryLimit: problem.memoryLimit,
      points: problem.points,
      validationMode: problem.validationMode,
      isSolved,
      samples: problem.testcases,
    },
    languages: SUPPORTED_LANGUAGES,
    currentUser: locals.user,
  };
};

