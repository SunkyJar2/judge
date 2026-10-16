import { json, error, type RequestHandler } from '@sveltejs/kit';
import { prisma } from '#lib/server/prisma';

export const GET: RequestHandler = async ({ params, locals }) => {
  const submissionId = params.id;
  if (!submissionId) throw error(400, 'Submission ID required.');

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      problem: {
        select: {
          id: true,
          title: true,
          points: true,
          timeLimit: true,
          memoryLimit: true,
        },
      },
      testResults: {
        include: {
          testCase: {
            select: {
              orderIndex: true,
              isSample: true,
              sampleInputPreview: true,
              sampleOutputPreview: true,
            },
          },
        },
        orderBy: { testCase: { orderIndex: 'asc' } },
      },
    },
  });

  if (!submission) {
    throw error(404, 'Submission not found.');
  }

  const currentUser = locals.user;
  const isOwner = currentUser?.id === submission.userId;
  const isStaff = currentUser?.role === 'teacher' || currentUser?.role === 'admin';

  // Sanitize testcase output based on sample vs secret
  const sanitizedTestResults = submission.testResults.map((r) => ({
    testCaseId: r.testCaseId,
    orderIndex: r.testCase.orderIndex,
    isSample: r.testCase.isSample,
    verdict: r.verdict,
    executionTimeMs: r.executionTimeMs,
    memoryUsedKb: r.memoryUsedKb,
    // Secret testcase actual output is never exposed to contestants
    actualOutputPreview: r.testCase.isSample ? r.actualOutputPreview : null,
    sampleInputPreview: r.testCase.isSample ? r.testCase.sampleInputPreview : null,
    sampleOutputPreview: r.testCase.isSample ? r.testCase.sampleOutputPreview : null,
    errorSignal: isOwner || isStaff ? r.errorSignal : null,
  }));

  return json({
    success: true,
    submission: {
      id: submission.id,
      userId: submission.userId,
      user: submission.user,
      problemId: submission.problemId,
      problem: submission.problem,
      languageId: submission.languageId,
      verdict: submission.verdict,
      passedTests: submission.passedTests,
      totalTests: submission.totalTests,
      maxExecutionMs: submission.maxExecutionMs,
      maxMemoryUsedKb: submission.maxMemoryUsedKb,
      compilerOutput: isOwner || isStaff ? submission.compilerOutput : null,
      sourceCode: isOwner || isStaff ? submission.sourceCode : null,
      createdAt: submission.createdAt,
      completedAt: submission.completedAt,
      testResults: sanitizedTestResults,
    },
  });
};

