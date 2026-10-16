import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '#lib/server/prisma';

export const GET: RequestHandler = async ({ params }) => {
  const problemId = params.id;
  if (!problemId) {
    throw error(400, 'Problem ID is required.');
  }

  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    include: {
      testcases: {
        where: { isSample: true },
        select: {
          id: true,
          orderIndex: true,
          isSample: true,
          sampleInputPreview: true,
          sampleOutputPreview: true,
          inputBytes: true,
          outputBytes: true
        },
        orderBy: { orderIndex: 'asc' }
      },
      _count: {
        select: {
          testcases: true
        }
      }
    }
  });

  if (!problem) {
    throw error(404, `Problem "${problemId}" not found.`);
  }

  return json({
    success: true,
    problem: {
      id: problem.id,
      module: problem.module,
      group: problem.group,
      code: problem.code,
      title: problem.title,
      statementMd: problem.statementMd,
      hasStatementPdf: !!problem.statementPdfPath,
      timeLimit: problem.timeLimit,
      wallTimeLimit: problem.wallTimeLimit,
      memoryLimit: problem.memoryLimit,
      points: problem.points,
      validationMode: problem.validationMode,
      totalTestcases: problem._count.testcases,
      samples: problem.testcases
    }
  });
};

