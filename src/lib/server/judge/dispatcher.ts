import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '#lib/server/prisma';
import { redis } from '#lib/server/redis';
import { Verdict } from '@prisma/client';
import {
  createJudge0Submission,
  getJudge0Submission,
  createJudge0BatchSubmissions,
  type Judge0SubmissionRequest,
  SUPPORTED_LANGUAGES,
} from './client';
import { executeWithPiston } from './piston';
import { readCASString } from '#lib/server/storage/cas';
import { validateOutput } from './validator';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'judge0_webhook_secret_hmac_32_chars_long_key';

/**
 * Computes an HMAC-SHA256 signature for webhook verification.
 */
export function generateWebhookSignature(submissionId: string, testcaseId: string): string {
  return createHmac('sha256', WEBHOOK_SECRET)
    .update(`${submissionId}:${testcaseId}`)
    .digest('hex');
}

/**
 * Verifies an incoming HMAC-SHA256 signature timing-safely.
 */
export function verifyWebhookSignature(submissionId: string, testcaseId: string, signature: string): boolean {
  try {
    const expected = generateWebhookSignature(submissionId, testcaseId);
    if (!signature || signature.length !== expected.length) {
      return false;
    }
    const expectedBuf = Buffer.from(expected, 'utf-8');
    const providedBuf = Buffer.from(signature, 'utf-8');

    return timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

/**
 * Publishes real-time submission progress events to Redis Pub/Sub.
 */
export async function publishSubmissionProgress(submissionId: string, data: Record<string, any>) {
  try {
    if (redis.isOpen) {
      await redis.publish(
        `submission:${submissionId}`,
        JSON.stringify({
          submissionId,
          timestamp: Date.now(),
          ...data,
        })
      );
    }
  } catch (err) {
    // Non-blocking in serverless/offline redis
  }
}

/**
 * Processes a completed testcase result against expected output and records it.
 */
export async function processTestResult(
  submissionId: string,
  testCaseId: string,
  judge0Result: {
    status_id: number;
    time?: string | null;
    memory?: number | null;
    stdout?: string | null;
    stderr?: string | null;
    compile_output?: string | null;
  }
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      problem: true,
    },
  });

  if (!submission) return;

  const testCase = await prisma.testCase.findUnique({
    where: { id: testCaseId },
  });

  if (!testCase) return;

  let verdict: Verdict = Verdict.RUNNING;
  const timeMs = Math.round(parseFloat(judge0Result.time || '0') * 1000);
  const memoryKb = judge0Result.memory || 0;
  let errorSignal: string | null = null;
  let actualOutputPreview: string | null = null;

  // Status mapping
  switch (judge0Result.status_id) {
    case 3: {
      // Finished normally, validate output against CAS
      const expectedOutput = await readCASString(testCase.outputStoragePath);
      const actualOutput = judge0Result.stdout || '';

      const validation = validateOutput(
        expectedOutput,
        actualOutput,
        submission.problem.validationMode,
        submission.problem.floatTolerance
      );

      if (validation.accepted) {
        verdict = Verdict.AC;
      } else {
        verdict = Verdict.WA;
        errorSignal = validation.message || 'Wrong Answer';
      }

      if (testCase.isSample) {
        actualOutputPreview = actualOutput.slice(0, 4096);
      }
      break;
    }
    case 5:
      verdict = Verdict.TLE;
      errorSignal = 'Time Limit Exceeded';
      break;
    case 6:
      verdict = Verdict.CE;
      errorSignal = judge0Result.compile_output?.slice(0, 16384) || 'Compilation Error';
      break;
    case 7:
    case 8:
    case 9:
    case 10:
    case 11:
    case 12: {
      // Check if memory limit was exceeded
      const stderr = judge0Result.stderr || '';
      if (stderr.toLowerCase().includes('memory') || memoryKb >= submission.problem.memoryLimit * 1024) {
        verdict = Verdict.MLE;
        errorSignal = 'Memory Limit Exceeded';
      } else {
        verdict = Verdict.RTE;
        errorSignal = stderr.slice(0, 4096) || `Runtime Error (code ${judge0Result.status_id})`;
      }
      break;
    }
    case 13:
      verdict = Verdict.ERROR;
      errorSignal = 'Internal Judge Error';
      break;
    case 14:
      verdict = Verdict.CE;
      errorSignal = 'Exec Format Error';
      break;
    default:
      verdict = Verdict.ERROR;
      errorSignal = `Unknown Judge0 status: ${judge0Result.status_id}`;
  }

  // Update SubmissionTestResult
  await prisma.submissionTestResult.upsert({
    where: {
      submissionId_testCaseId: {
        submissionId,
        testCaseId,
      },
    },
    update: {
      verdict,
      executionTimeMs: timeMs,
      memoryUsedKb: memoryKb,
      actualOutputPreview,
      errorSignal,
    },
    create: {
      submissionId,
      testCaseId,
      verdict,
      executionTimeMs: timeMs,
      memoryUsedKb: memoryKb,
      actualOutputPreview,
      errorSignal,
    },
  });

  // Check aggregate progress
  await finalizeSubmissionIfComplete(submissionId);
}

/**
 * Checks all testcase results for a submission. If all have finished,
 * determines the final verdict and performs idempotent point awards.
 */
export async function finalizeSubmissionIfComplete(submissionId: string) {
  const allResults = await prisma.submissionTestResult.findMany({
    where: { submissionId },
    include: { testCase: true },
    orderBy: { testCase: { orderIndex: 'asc' } },
  });

  const pending = allResults.some(
    (r) => r.verdict === Verdict.IN_QUEUE || r.verdict === Verdict.COMPILING || r.verdict === Verdict.RUNNING
  );

  if (pending) {
    // Report progress
    const passed = allResults.filter((r) => r.verdict === Verdict.AC).length;
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        verdict: Verdict.RUNNING,
        passedTests: passed,
        totalTests: allResults.length,
      },
    });

    await publishSubmissionProgress(submissionId, {
      verdict: Verdict.RUNNING,
      passedTests: passed,
      totalTests: allResults.length,
    });
    return;
  }

  // All testcases finished!
  let finalVerdict: Verdict = Verdict.AC;
  let maxTimeMs = 0;
  let maxMemoryKb = 0;
  let passedCount = 0;

  for (const r of allResults) {
    if (r.executionTimeMs > maxTimeMs) maxTimeMs = r.executionTimeMs;
    if (r.memoryUsedKb > maxMemoryKb) maxMemoryKb = r.memoryUsedKb;

    if (r.verdict === Verdict.AC) {
      passedCount++;
    } else if (finalVerdict === Verdict.AC) {
      // First non-AC verdict is assigned as final verdict
      finalVerdict = r.verdict;
    }
  }

  const submission = await prisma.submission.update({
    where: { id: submissionId },
    data: {
      verdict: finalVerdict,
      passedTests: passedCount,
      totalTests: allResults.length,
      maxExecutionMs: maxTimeMs,
      maxMemoryUsedKb: maxMemoryKb,
      completedAt: new Date(),
    },
    include: {
      problem: true,
      user: true,
    },
  });

  // Idempotent point credit if AC
  if (finalVerdict === Verdict.AC) {
    try {
      await prisma.$transaction(async (tx) => {
        // Atomic insert: fails if (userId, problemId) already exists
        await tx.userProblemPoints.create({
          data: {
            userId: submission.userId,
            problemId: submission.problemId,
            submissionId: submission.id,
            points: submission.problem.points,
          },
        });

        // Award points and increment user stats
        await tx.user.update({
          where: { id: submission.userId },
          data: {
            totalPoints: { increment: submission.problem.points },
            solvedCount: { increment: 1 },
          },
        });
      });
    } catch (e: any) {
      // P2002 means already awarded points for this problem previously (idempotent)
      if (e?.code !== 'P2002') {
        console.error('Error awarding points:', e);
      }
    }
  }

  // Publish final status via Redis
  await publishSubmissionProgress(submissionId, {
    verdict: finalVerdict,
    passedTests: passedCount,
    totalTests: allResults.length,
    maxExecutionMs: maxTimeMs,
    maxMemoryUsedKb: maxMemoryKb,
  });
}

/**
 * Dispatches a formal submission for evaluation.
 * Evaluates testcases against Judge0 sequentially or concurrently.
 */
export async function dispatchSubmission(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      problem: {
        include: {
          testcases: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      },
    },
  });

  if (!submission) {
    throw new Error(`Submission ${submissionId} not found`);
  }

  const testcases = submission.problem.testcases;
  if (testcases.length === 0) {
    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        verdict: Verdict.AC,
        completedAt: new Date(),
      },
    });
    return;
  }

  // Mark status as COMPILING / RUNNING
  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      verdict: Verdict.COMPILING,
      totalTests: testcases.length,
    },
  });

  await publishSubmissionProgress(submissionId, {
    verdict: Verdict.COMPILING,
    totalTests: testcases.length,
  });

  // Check execution engine (Judge0 vs Piston)
  const isPiston = process.env.EXECUTION_ENGINE === 'piston' || (!process.env.JUDGE0_URL && !!process.env.PISTON_URL);
  const isServerless = process.env.SERVERLESS === 'true' || isPiston;

  const runEvaluation = async () => {
    try {
      for (const tc of testcases) {
        const inputStr = await readCASString(tc.inputStoragePath);

        if (isPiston) {
          const pistonResult = await executeWithPiston({
            languageId: submission.languageId,
            sourceCode: submission.sourceCode,
            stdin: inputStr,
            timeLimitSec: submission.problem.timeLimit,
          });

          await prisma.submissionTestResult.upsert({
            where: {
              submissionId_testCaseId: {
                submissionId,
                testCaseId: tc.id,
              },
            },
            update: {
              judge0Token: `piston-${Date.now()}-${tc.orderIndex}`,
            },
            create: {
              submissionId,
              testCaseId: tc.id,
              judge0Token: `piston-${Date.now()}-${tc.orderIndex}`,
            },
          });

          await processTestResult(submissionId, tc.id, {
            status_id: pistonResult.statusId,
            time: (pistonResult.executionTimeMs / 1000).toString(),
            memory: pistonResult.memoryUsedKb,
            stdout: pistonResult.stdout,
            stderr: pistonResult.stderr,
            compile_output: pistonResult.compileOutput,
          });

          // Fast-fail: if compilation error, stop evaluating further testcases
          if (pistonResult.statusId === 6) {
            break;
          }
          continue;
        }

        // Judge0 Execution
        const judge0Req: Judge0SubmissionRequest = {
          source_code: submission.sourceCode,
          language_id: submission.languageId,
          stdin: inputStr,
          cpu_time_limit: submission.problem.timeLimit,
          wall_time_limit: submission.problem.wallTimeLimit,
          memory_limit: submission.problem.memoryLimit * 1024, // KB
        };

        // Submit to Judge0 synchronously with wait=true
        const response = await createJudge0Submission(judge0Req, true);

        // Store Judge0 token in DB
        await prisma.submissionTestResult.upsert({
          where: {
            submissionId_testCaseId: {
              submissionId,
              testCaseId: tc.id,
            },
          },
          update: {
            judge0Token: response.token,
          },
          create: {
            submissionId,
            testCaseId: tc.id,
            judge0Token: response.token,
          },
        });

        await processTestResult(submissionId, tc.id, {
          status_id: response.status.id,
          time: response.time,
          memory: response.memory,
          stdout: response.stdout,
          stderr: response.stderr,
          compile_output: response.compile_output,
        });

        // Fast-fail: if compilation error, stop evaluating further testcases
        if (response.status.id === 6) {
          break;
        }
      }
    } catch (err: any) {
      console.error(`Error judging submission ${submissionId}:`, err);
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          verdict: Verdict.ERROR,
          completedAt: new Date(),
        },
      });
      await publishSubmissionProgress(submissionId, {
        verdict: Verdict.ERROR,
        message: err.message,
      });
    }
  };

  // On serverless platforms (Vercel), await evaluation before response ends
  if (isServerless) {
    await runEvaluation();
  } else {
    runEvaluation();
  }
}
