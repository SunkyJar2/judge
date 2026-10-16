-- CreateEnum
CREATE TYPE "Role" AS ENUM ('student', 'teacher', 'admin');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('IN_QUEUE', 'COMPILING', 'RUNNING', 'AC', 'WA', 'TLE', 'MLE', 'OLE', 'RTE', 'CE', 'ERROR');

-- CreateEnum
CREATE TYPE "ValidationMode" AS ENUM ('TOKEN_NORMALIZED', 'FLOAT_TOLERANCE', 'CUSTOM_VALIDATOR');

-- CreateEnum
CREATE TYPE "FriendStatus" AS ENUM ('PENDING', 'ACCEPTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'student',
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "solvedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statementMd" TEXT,
    "statementPdfPath" TEXT,
    "imageUrl" TEXT,
    "timeLimit" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "wallTimeLimit" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "memoryLimit" INTEGER NOT NULL DEFAULT 512,
    "points" INTEGER NOT NULL DEFAULT 100,
    "validationMode" "ValidationMode" NOT NULL DEFAULT 'TOKEN_NORMALIZED',
    "floatTolerance" DOUBLE PRECISION,
    "validatorScriptPath" TEXT,
    "testcaseVersion" INTEGER NOT NULL DEFAULT 1,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "inputStoragePath" TEXT NOT NULL,
    "outputStoragePath" TEXT NOT NULL,
    "inputSha256" VARCHAR(64) NOT NULL,
    "outputSha256" VARCHAR(64) NOT NULL,
    "inputBytes" INTEGER NOT NULL,
    "outputBytes" INTEGER NOT NULL,
    "sampleInputPreview" TEXT,
    "sampleOutputPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "languageId" INTEGER NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "verdict" "Verdict" NOT NULL DEFAULT 'IN_QUEUE',
    "passedTests" INTEGER NOT NULL DEFAULT 0,
    "totalTests" INTEGER NOT NULL DEFAULT 0,
    "maxExecutionMs" INTEGER NOT NULL DEFAULT 0,
    "maxMemoryUsedKb" INTEGER NOT NULL DEFAULT 0,
    "compilerOutput" TEXT,
    "testcaseVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionTestResult" (
    "submissionId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "judge0Token" TEXT,
    "verdict" "Verdict" NOT NULL DEFAULT 'IN_QUEUE',
    "executionTimeMs" INTEGER NOT NULL DEFAULT 0,
    "memoryUsedKb" INTEGER NOT NULL DEFAULT 0,
    "actualOutputPreview" TEXT,
    "errorSignal" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmissionTestResult_pkey" PRIMARY KEY ("submissionId","testCaseId")
);

-- CreateTable
CREATE TABLE "UserProblemPoints" (
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProblemPoints_pkey" PRIMARY KEY ("userId","problemId")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("userId","problemId")
);

-- CreateTable
CREATE TABLE "ProblemRating" (
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemRating_pkey" PRIMARY KEY ("userId","problemId")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "status" "FriendStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("userAId","userBId")
);

-- CreateTable
CREATE TABLE "ForumThread" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumReply" (
    "id" SERIAL NOT NULL,
    "threadId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteAnnouncement" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "text" VARCHAR(500) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HttpTrafficLog" (
    "id" BIGSERIAL NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "elapsedMs" INTEGER NOT NULL,
    "ipAddress" VARCHAR(45) NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HttpTrafficLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_totalPoints_solvedCount_idx" ON "User"("totalPoints" DESC, "solvedCount" DESC);

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateIndex
CREATE INDEX "Problem_module_group_idx" ON "Problem"("module", "group");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_module_code_key" ON "Problem"("module", "code");

-- CreateIndex
CREATE INDEX "TestCase_problemId_orderIndex_idx" ON "TestCase"("problemId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "TestCase_problemId_orderIndex_key" ON "TestCase"("problemId", "orderIndex");

-- CreateIndex
CREATE INDEX "Submission_userId_createdAt_idx" ON "Submission"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Submission_problemId_verdict_idx" ON "Submission"("problemId", "verdict");

-- CreateIndex
CREATE INDEX "Submission_verdict_createdAt_idx" ON "Submission"("verdict", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionTestResult_judge0Token_key" ON "SubmissionTestResult"("judge0Token");

-- CreateIndex
CREATE INDEX "SubmissionTestResult_submissionId_idx" ON "SubmissionTestResult"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProblemPoints_submissionId_key" ON "UserProblemPoints"("submissionId");

-- CreateIndex
CREATE INDEX "UserProblemPoints_userId_idx" ON "UserProblemPoints"("userId");

-- CreateIndex
CREATE INDEX "ProblemRating_problemId_idx" ON "ProblemRating"("problemId");

-- CreateIndex
CREATE INDEX "Friendship_userBId_status_idx" ON "Friendship"("userBId", "status");

-- CreateIndex
CREATE INDEX "ForumThread_isDeleted_createdAt_idx" ON "ForumThread"("isDeleted", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ForumThread_category_isDeleted_idx" ON "ForumThread"("category", "isDeleted");

-- CreateIndex
CREATE INDEX "ForumReply_threadId_isDeleted_createdAt_idx" ON "ForumReply"("threadId", "isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "HttpTrafficLog_createdAt_idx" ON "HttpTrafficLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "HttpTrafficLog_path_idx" ON "HttpTrafficLog"("path");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionTestResult" ADD CONSTRAINT "SubmissionTestResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionTestResult" ADD CONSTRAINT "SubmissionTestResult_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProblemPoints" ADD CONSTRAINT "UserProblemPoints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProblemPoints" ADD CONSTRAINT "UserProblemPoints_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProblemPoints" ADD CONSTRAINT "UserProblemPoints_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemRating" ADD CONSTRAINT "ProblemRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemRating" ADD CONSTRAINT "ProblemRating_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumThread" ADD CONSTRAINT "ForumThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ForumThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
