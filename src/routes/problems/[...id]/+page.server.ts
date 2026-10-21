import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { prisma } from '#lib/server/prisma';
import { marked } from 'marked';
import { sanitizeHtmlSimple } from '#lib/sanitize';
import { SUPPORTED_LANGUAGES } from '#lib/server/judge/client';

export const load: PageServerLoad = async ({ params, locals }) => {
  const rawId = params.id;
  if (!rawId) {
    throw error(400, 'Problem ID required.');
  }

  const decodedId = decodeURIComponent(rawId);

  try {
    // 1. Fetch Problem using findUnique for exact primary key lookup
    let problem = await prisma.problem.findUnique({
      where: { id: rawId },
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

    if (!problem && rawId !== decodedId) {
      problem = await prisma.problem.findUnique({
        where: { id: decodedId },
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
    }

    if (!problem) {
      throw error(404, `Problem "${rawId}" not found.`);
    }

    // 2. Render and sanitize Markdown statement
    let sanitizedHtml: string | null = null;
    if (problem.statementMd) {
      try {
        const rawHtml = await marked.parse(problem.statementMd);
        sanitizedHtml = sanitizeHtmlSimple(rawHtml);
      } catch (markdownErr) {
        console.error('[MarkdownParseError]:', markdownErr);
        sanitizedHtml = `<pre class="whitespace-pre-wrap">${problem.statementMd.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
      }
    }

    // 3. Check if solved by current user
    let isSolved = false;
    if (locals.user) {
      try {
        const award = await prisma.userProblemPoints.findUnique({
          where: {
            userId_problemId: {
              userId: locals.user.id,
              problemId: problem.id,
            },
          },
        });
        isSolved = !!award;
      } catch (awardErr) {
        console.error('[UserPointsLookupError]:', awardErr);
      }
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
  } catch (err: any) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error(`[ProblemLoadError] Failed to load problem "${params.id}":`, err);
    throw error(500, `Problem loader error: ${err?.message || 'Internal Error'}`);
  }
};
