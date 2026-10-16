import { error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '#lib/server/prisma';
import { promises as fs } from 'node:fs';

export const GET: RequestHandler = async ({ params }) => {
  const rawId = params.id;
  if (!rawId) {
    throw error(400, 'Problem ID is required.');
  }
  const decodedId = decodeURIComponent(rawId);

  const problem = await prisma.problem.findFirst({
    where: {
      OR: [{ id: rawId }, { id: decodedId }]
    },
    select: { statementPdfPath: true, title: true }
  });

  if (!problem || !problem.statementPdfPath) {
    throw error(404, 'PDF statement not found for this problem.');
  }

  try {
    const fileBuffer = await fs.readFile(problem.statementPdfPath);
    const safeTitle = problem.title.replace(/[^a-zA-Z0-9-_]/g, '_');

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeTitle}.pdf"`,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (err) {
    console.error('Failed to read statement PDF:', err);
    throw error(404, 'Statement file could not be read from disk.');
  }
};

