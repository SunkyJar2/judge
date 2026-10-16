# Product Requirements Document (PRD) & Architecture Specification

**Project**: Untitled Judge (NextGen Rewrite)  
**Version**: 1.1.0-revised  
**Target Environment**: Linux (Ubuntu 24.04+ / Debian 12+ with cgroups v2 enabled)  
**Target Stack**: SvelteKit 2+ (Svelte 5 Runes) · Bun (v1.2+) · Prisma 8 (PostgreSQL 16+) · Redis 7+ · Judge0 CE (v1.13.1) · Better Auth (v1.7+)  
**Repository Reference**: [Zal2024/judge](https://github.com/Zal2024/judge.git)

---

## 1. Executive Summary & Legacy System Evaluation

### 1.1 Background
The legacy `Zal2024/judge` is an educational online judge built with vanilla Node.js, an embedded SQLite database (`node:sqlite`), and a disposable Podman container sandbox. While it successfully serves classroom programming exercises with zero external npm dependencies, it suffers from critical scalability, security, and maintainability bottlenecks when exposed to multi-user lab sessions or contest conditions.

### 1.2 Evaluation Matrix: What to Keep vs. What to Improve

| Domain | What to Keep (Retained Strengths) | What to Improve (Legacy Deficiencies) | Proposed Modern Solution |
| :--- | :--- | :--- | :--- |
| **Problemset Schema** | Full compatibility with DOMjudge / Kattis packages (`problem.yaml`, `domjudge-problem.ini`, `data/sample/`, `data/secret/`). | Problem discovery relies on synchronous filesystem walks during startup; statement PDFs stored as SQLite BLOBs. | Keep DOMjudge directory convention; store large testcase files and PDFs on content-addressed disk/object storage with SHA-256 caching; metadata managed via Prisma. |
| **ZIP Ingestion** | Ingestion of problem packages via `.zip` upload in Admin UI. | Custom single-threaded ZIP unpacker (`zlib.inflateRawSync`) vulnerable to zip-slip, symlink exploits, and memory exhaustion. | Streaming ZIP parser with strict size quotas, symlink rejection, path canonicalization, and background ingestion workers. |
| **Evaluation Sandbox** | Token-based whitespace normalization (`normalizeOutput`) for standard competitive programming verdicts. | Spawns a new Podman container CLI process per testcase (150ms–400ms overhead per testcase); serial single-worker FIFO queue locks the whole server under load. | **Judge0 CE (v1.13.1)** with `isolate` Linux sandbox (<5ms overhead per testcase), compile-once/run-many execution harnesses, Redis job queues, and multi-core parallel dispatch. |
| **Language Support** | GCC C17, G++ C++17, Python 3. | Hardcoded to only 3 compilers; syntax check for Python requires spawning another container process. | Curated Judge0 profile supporting C17, C++20, Python 3.12, Java 21, Rust 1.80, and Go 1.23 with unified resource multipliers and custom checkers. |
| **Interactive Runner** | In-browser "Playground" test runner against sample cases or custom `stdin`. | Coupled to the same serial execution queue; blocks formal submissions. | Dedicated low-priority Judge0 worker queue with strict per-user concurrency caps for ephemeral playground runs. |
| **Authentication & Security** | Email OTP confirmation; Google Sign-In; Role-based access control. | ~1,200 lines of hand-rolled crypto, raw TCP socket SMTP client, manual cookie parsers, and custom Google X.509 certificate parsers. | **Better Auth (v1.7+)** with Prisma adapter: standardized Argon2id hashing, encrypted OAuth token storage at rest, native OAuth, and Nodemailer SMTP. |
| **Data & Storage** | Rich relations (Submissions, Points, Progress, Friends, Forums, Ratings). | Monolithic single SQLite file storing binary image and PDF BLOBs; lack of formal migrations; raw SQL strings. | **Prisma 8** with PostgreSQL 16; testcase payloads and media stored out-of-band on local volume / S3-compatible storage. |
| **Frontend & DX** | Frutiger Aero / Vista aesthetics; light & dark modes; zero-dependency UI. | 2,900-line monolithic `app.js` with raw imperative DOM manipulation and `innerHTML` string concatenations (XSS hazards). | **SvelteKit 2+ / Svelte 5 (Runes)** with TypeScript, reactive state, Server-Side Rendering (SSR), nonce-based CSP, and isomorphic HTML sanitization. |
| **Realtime Feedback** | Live submission status updates. | Frontend polls `/api/submissions/active` every 1.5 seconds over HTTP. | **Server-Sent Events (SSE)** backed by Redis Pub/Sub for real-time testcase state transitions with initial snapshot replay. |

---

## 2. Product Requirements Document (PRD)

### 2.1 Product Vision & Goals
Deliver a high-throughput, hardened, self-hostable online judge that maintains complete drop-in compatibility with DOMjudge problemsets while delivering an engaging classroom experience (gamification, code runner, forums, and live telemetry).

#### Goals
1. **Sub-second Feedback**: End-to-end evaluation latency under 1 second for standard single-compile test suites via Judge0.
2. **High Concurrency**: Sustain 50+ concurrent submissions and 1,000 active browser connections without dropping requests or starving workers.
3. **Defense-in-Depth Security**: Cryptographically verified webhooks, cgroups v2 sandboxed execution, hardened archive extraction, and strict nonce-based CSP.
4. **DOMjudge Interoperability**: Direct consumption of existing problem packages, including floating-point tolerance and custom checker script support.
5. **Low-Overhead Observability**: Non-blocking telemetry pipeline for live lab proctoring without synchronous database write bottlenecks.

#### Non-Goals
1. Distributed multi-region consensus (single-region / on-premise university deployment focus).
2. Complex multi-stage team contests with physical balloon runners (ICPC contest runner features are secondary to classroom practice).

---

### 2.2 User Personas

| Persona | Role | Primary Needs |
| :--- | :--- | :--- |
| **Student / Coder** | Standard User (`student`) | Rapid evaluation feedback, in-browser scratchpad testing, clear verdict diagnostics, progression tracking, and community discussion. |
| **Instructor / TA** | Content Author & Grader (`teacher`) | Safe problem authoring, batch ZIP ingestion, live contest progress monitoring, plagiarism/code inspection, and rejudging capabilities. |
| **Administrator** | Operator (`admin`) | System health telemetry, traffic surge monitoring, worker queue management, user ban/role controls, and broadcast announcements. |

---

### 2.3 Functional Requirements (FR)

#### FR-1: Problemset & Hardened Package Ingestion
- **FR-1.1 (Filesystem Sync)**: Automatically index problems from a local directory hierarchy following DOMjudge conventions:
  ```text
  <Module>/<Set>/<Code>/
  ├── problem.yaml           (Problem title, validation mode, limits, float_tolerance)
  ├── domjudge-problem.ini   (timelimit = <seconds>, color)
  ├── problem.pdf            (Statement PDF)
  ├── statement.md           (Optional Markdown statement)
  ├── output_validators/     (Optional custom checker script)
  └── data/
      ├── sample/            (*.in and matching *.ans)
      └── secret/            (*.in and matching *.ans)
  ```
- **FR-1.2 (Hardened ZIP Package Import)**: Admin/Teacher interface to upload Kattis/DOMjudge `.zip` archives with strict security validation:
  - Maximum compressed upload size: **100 MB**; maximum uncompressed total size: **500 MB**; maximum file count: **1,000 files**.
  - **Path Canonicalization**: Reject any archive entry containing `..`, leading `/`, or resolving outside the target extraction directory (Zip-Slip prevention).
  - **Symlink Rejection**: Reject any archive containing symbolic links (`S_IFLNK`), hard links, or special device files (`FIFO`, sockets).
- **FR-1.3 (Out-of-Band Testcase Storage)**: Testcase `.in` and `.ans` files are stored on a dedicated read-only volume (or S3 bucket) addressed by their SHA-256 hash (`<sha256>.in`, `<sha256>.ans`). The database stores only file paths, byte sizes, SHA-256 digests, and a truncated 2 KB preview for sample display.
- **FR-1.4 (Database Overrides & Versioning)**: Allow instructors to modify statements, point values, and test cases via the web UI without editing host filesystem files. Modifying testcases increments `Problem.testcaseVersion` and allows triggering a background rejudge of prior submissions.
- **FR-1.5 (Testcase Privacy Enforcement)**:
  - Sample testcases (`data/sample/`) expose truncated input, expected output, and actual output (up to 4 KB) to the user.
  - Secret testcases (`data/secret/`) expose **only** verdict, elapsed time, and memory used. Inputs, expected answers, and execution traces are never transmitted to the client.

#### FR-2: Submission & Judging Pipeline
- **FR-2.1 (Multi-Language Execution & Payload Caps)**:
  - Maximum source code size: **128 KB** per submission.
  - Standard support for:
    - C17 (GCC 14): `-std=c17 -O2 -pipe -lm`
    - C++20 (G++ 14): `-std=c++20 -O2 -pipe`
    - Python 3.12+: `python3 -I -B`
    - Java 21, Rust 1.80+, Go 1.23+
- **FR-2.2 (Compile-Once, Run-Many Evaluation Strategy)**:
  - For compiled languages with $> 3$ testcases, the dispatcher packages the testcases (or mounts the problem's read-only testcase directory inside Judge0 via `additional_files`) so the source code is **compiled once** and executed sequentially/in-parallel against each `.in` file inside the sandbox, eliminating redundant compilation overhead.
  - For small testcase counts ($\le 3$) or interpreted languages, standard Judge0 batch submission (`POST /submissions/batch?base64_encoded=true`) may be used.
- **FR-2.3 (Output Validation & Custom Checkers)**:
  - Grading verification occurs inside the trusted evaluation pipeline:
    - **Default Mode**: Token-based whitespace normalization (`\r\n` $\to$ `\n`, trailing whitespace stripped).
    - **Float Tolerance Mode**: Token-by-token comparison allowing absolute or relative error $\le \epsilon$ (configured in `problem.yaml`).
    - **Custom Checker Mode**: Execution of the problem's `output_validators` script against `(input, expected_output, contestant_output)`.
- **FR-2.4 (Real-Time Progress Streaming via Redis Pub/Sub + SSE)**:
  - When a client connects to `/api/submissions/[id]/stream`, the server immediately sends the current database state of the submission (solving late-join race conditions) and subscribes to the Redis channel `submission:<id>`.
  - State transitions stream in real time:
    $$\text{IN\_QUEUE} \longrightarrow \text{COMPILING} \longrightarrow \text{RUNNING } (k/N) \longrightarrow \text{FINAL VERDICT}$$
- **FR-2.5 (Verdict Determination)**:
  - `AC` (Accepted): Output matches answer under whitespace normalization or validator rules.
  - `WA` (Wrong Answer): Token mismatch or validator rejected.
  - `TLE` (Time Limit Exceeded): Wall-clock or CPU limit reached.
  - `MLE` (Memory Limit Exceeded): Exceeded container memory limit (default 512 MB).
  - `OLE` (Output Limit Exceeded): Stdout/stderr exceeds 8 MB.
  - `RTE` (Runtime Error): Non-zero exit code or segmentation fault.
  - `CE` (Compilation Error): Compiler returned non-zero code. Stderr displayed to the user (truncated to 16 KB).
  - `ERROR` (Internal Error): Platform alarm logged to admin.
- **FR-2.6 (Playground & Custom Input)**:
  - Independent scratchpad allowing code testing against problem samples or arbitrary `stdin` (up to 64 KB) with a 3.0s CPU / 5.0s wall-clock timeout and 256 MB memory limit.
  - Routed to a dedicated lower-priority Judge0 queue with a per-user limit of 1 active concurrent run. Playground runs are not logged as formal submissions.

#### FR-3: Authentication, Security & RBAC (Better Auth)
- **FR-3.1 (Authentication Modes)**:
  - Email + Password with Argon2id password hashing (minimum 64 MB memory cost, 3 iterations).
  - 6-Digit Email OTP confirmation via Nodemailer SMTP (10-minute expiry, max 5 failed attempts before token invalidation).
  - Google OAuth 2.0 integration via Better Auth with encrypted token storage at rest.
- **FR-3.2 (RBAC Roles)**:
  - `student`: Submit code, test in playground, view own submissions, post in forum, manage friends.
  - `teacher`: Ingest ZIP problems, edit problem statements, trigger rejudges, view all student code submissions.
  - `admin`: Configure authentication, manage system announcements, manage user bans/roles, access live traffic telemetry.
- **FR-3.3 (Multi-Tier Rate Limiting)**:
  - Enforced via Redis sliding-window counters:
    - Auth/OTP endpoints: 5 requests / minute per IP.
    - Formal Submissions: 5 submissions / minute per user, max 2 concurrent in-flight submissions.
    - Playground Runs: 10 runs / minute per user, max 1 concurrent run.
    - ZIP Ingestion: 3 uploads / minute per teacher.
- **FR-3.4 (Webhook & Internal Network Security)**:
  - Judge0 CE API listens exclusively on an internal bridge network (`172.x.x.x`) and requires `X-Judge0-Token`.
  - Every webhook `callback_url` generated by SvelteKit includes an HMAC-SHA256 signature query parameter:
    $$\text{sig} = \text{HMAC-SHA256}(\text{WEBHOOK\_SECRET},\, \text{submissionId} \mathbin{\Vert} \text{testcaseId})$$
  - Incoming webhook requests are verified via `crypto.timingSafeEqual` and rejected with `401 Unauthorized` on mismatch.
- **FR-3.5 (Transport, CSP & Content Security)**:
  - Nonce-based Content-Security-Policy (CSP) configured via SvelteKit `kit.csp`.
  - HTTP-only, SameSite=Lax, Secure session cookies.
  - Forum image uploads (max 3 per post, max 2 MB each) are restricted to raster formats (`image/png`, `image/jpeg`, `image/webp`). **SVG uploads are prohibited.** Uploads are re-encoded via `sharp` to strip EXIF data and polyglot payloads.
  - Sanitization of all forum Markdown and descriptions via `marked` + `isomorphic-dompurify`.

#### FR-4: Standings, Scoring & Idempotent Gamification
- **FR-4.1 (Idempotent One-Time Points Credit)**: Points are credited only on the user's first `AC` verdict for a problem using an atomic PostgreSQL transaction:
  ```sql
  INSERT INTO "UserProblemPoints" ("userId", "problemId", "submissionId", "points")
  VALUES ($1, $2, $3, $4)
  ON CONFLICT ("userId", "problemId") DO NOTHING;
  ```
- **FR-4.2 (Module Points Scaling)**:
  $$\text{Points} = \min\left(1000,\, 100 + (\text{Module} - 1) \times 50 + \text{SetIndex} \times 25\right)$$
- **FR-4.3 (Codeforces-Style Tiers)**:
  - **Grandmaster**: $\ge 3000\text{ pts}$
  - **Master**: $\ge 2200\text{ pts}$
  - **Expert**: $\ge 1500\text{ pts}$
  - **Specialist**: $\ge 800\text{ pts}$
  - **Pupil**: $\ge 300\text{ pts}$
  - **Newbie**: $< 300\text{ pts}$
- **FR-4.4 (Scoreboard Performance)**: Real-time leaderboard filterable by Module or **Friends Only**, reading from materialized `User.totalPoints` / `User.solvedCount` fields to eliminate high-load runtime aggregations.

#### FR-5: Community & Discussion Layer
- **FR-5.1 (Discussion Forum)**: Threaded categories (*General*, *Problem Help*, *Language Discussion*, *Study Group*) with rate limits (max 3 threads/hour, 10 replies/hour per student) and soft-delete moderation for teachers/admins.
- **FR-5.2 (Canonical Friendship Graph)**: Bilateral friendship records stored in canonical lexicographical order (`userAId < userBId`) with an explicit `initiatorId` to eliminate duplicate rows and prevent self-friending.
- **FR-5.3 (Problem Ratings)**: 1-to-5 star rating system per problem with aggregate score display, restricted to users who have submitted code for that problem.

#### FR-6: Telemetry & Administration
- **FR-6.1 (Buffered Traffic Telemetry)**: HTTP request metrics (latency, status codes, active paths) recorded in-memory / Redis ring buffers and flushed asynchronously to PostgreSQL in bulk batches every **10 seconds**, preventing request bottlenecks.
- **FR-6.2 (Retention & Pruning)**: Automated daily cron task prunes raw `HttpTrafficLog` entries older than 14 days after rolling up aggregate stats.
- **FR-6.3 (Site Announcements)**: Global broadcast banner configurable by administrators.

---

### 2.4 Non-Functional Requirements (NFR)

- **NFR-1 (Performance)**: First Contentful Paint (FCP) under 400ms; Playground test execution round-trip under 800ms for sub-second testcases.
- **NFR-2 (Concurrency & Backpressure)**: Sustain 50+ concurrent judging jobs via Judge0. When queue depth exceeds 500 pending jobs, return HTTP `503 Service Unavailable` with `Retry-After`.
- **NFR-3 (Sandbox Isolation)**: User submissions run inside `isolate` with cgroups v2 memory limits (`--cg`), `--share-net=false`, maximum 64 processes/threads (`--processes=64`), read-only root filesystems, and 8 MB write limits (`--fsize=8192`).
- **NFR-4 (Data Hygiene)**: Zero database bloat; all binary assets and testcase payloads $> 2\text{ KB}$ are stored out-of-band on disk or S3-compatible storage.

---

## 3. System Architecture & Component Interaction

```
                        ┌────────────────────────────────────────────────────────┐
                        │                   Client Web Browser                   │
                        │      SvelteKit 2 + Svelte 5 Runes (Nonce-Protected)    │
                        └───────────────────────────┬────────────────────────────┘
                                                    │ HTTPS / SSE
                                                    ▼
                        ┌────────────────────────────────────────────────────────┐
                        │               Reverse Proxy (Caddy / Nginx)            │
                        │        TLS Termination · Trusted X-Forwarded-For       │
                        └───────────────────────────┬────────────────────────────┘
                                                    │
                        ┌───────────────────────────▼────────────────────────────┐
                        │                      Bun Runtime                       │
                        │  ┌──────────────────────────────────────────────────┐  │
                        │  │                 SvelteKit Server                 │  │
                        │  │  - Better Auth (Argon2id, Encrypted OAuth, RBAC) │  │
                        │  │  - Hardened ZIP Extractor & Image Re-encoder     │  │
                        │  │  - Submission Dispatcher & Output Validator      │  │
                        │  │  - HMAC Webhook Verifier & Telemetry Buffer      │  │
                        │  └───┬────────────────────┬─────────────────────┬───┘  │
                        └──────┼────────────────────┼─────────────────────┼──────┘
                               │ Prisma 8           │ Pub/Sub &           │ Internal VPC
                               │                    │ Rate Limits         │ + HMAC Webhooks
                               ▼                    ▼                     ▼
                        ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
                        │ PostgreSQL 16│     │   Redis 7+   │     │   Judge0 CE v1.13    │
                        │  - Metadata  │     │  - SSE Bus   │     │  - Priority Queues   │
                        │  - Verdicts  │     │  - Sliding   │     │  - Isolate (cgroups) │
                        │  - Standings │     │    Limiters  │     │  - Read-Only Mounts  │
                        └──────────────┘     └──────────────┘     └──────────────────────┘
```

---

## 4. Prisma 8 Database Schema Specification

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ==========================================
// 1. BETTER AUTH & USER MODELS
// ==========================================

enum Role {
  student
  teacher
  admin
}

model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  role          Role      @default(student)
  banned        Boolean   @default(false)
  banReason     String?
  banExpires    DateTime?
  
  // Materialized leaderboard counters for fast standings queries
  totalPoints   Int       @default(0)
  solvedCount   Int       @default(0)

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  sessions      Session[]
  accounts      Account[]
  submissions   Submission[]
  points        UserProblemPoints[]
  ratings       ProblemRating[]
  progress      UserProgress[]
  threads       ForumThread[]
  replies       ForumReply[]

  friendshipsA  Friendship[] @relation("FriendshipUserA")
  friendshipsB  Friendship[] @relation("FriendshipUserB")

  @@index([totalPoints(sort: Desc), solvedCount(sort: Desc)])
  @@index([email])
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
}

model Account {
  id                    String    @id @default(cuid())
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accountId             String
  providerId            String
  accessToken           String?   @db.Text // Encrypted at rest via Better Auth
  refreshToken          String?   @db.Text // Encrypted at rest via Better Auth
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  idToken               String?   @db.Text
  password              String?   @db.Text // Argon2id hash
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([providerId, accountId])
  @@index([userId])
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  attempts   Int      @default(0)
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
}

// ==========================================
// 2. DOMAIN & JUDGING MODELS
// ==========================================

enum Verdict {
  IN_QUEUE
  COMPILING
  RUNNING
  AC
  WA
  TLE
  MLE
  OLE
  RTE
  CE
  ERROR
}

enum ValidationMode {
  TOKEN_NORMALIZED
  FLOAT_TOLERANCE
  CUSTOM_VALIDATOR
}

enum FriendStatus {
  PENDING
  ACCEPTED
}

model Problem {
  id                  String         @id // E.g., "Modul-1/A/SetA1"
  module              String
  group               String
  code                String
  title               String
  statementMd         String?        @db.Text
  statementPdfPath    String?
  imageUrl            String?
  timeLimit           Float          @default(1.0) // CPU time limit (seconds)
  wallTimeLimit       Float          @default(3.0) // Wall clock limit (seconds)
  memoryLimit         Int            @default(512) // Memory limit (MB)
  points              Int            @default(100)
  validationMode      ValidationMode @default(TOKEN_NORMALIZED)
  floatTolerance      Float?         // E.g., 1e-6
  validatorScriptPath String?
  testcaseVersion     Int            @default(1)
  isCustom            Boolean        @default(false)
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  testcases           TestCase[]
  submissions         Submission[]
  pointsAwarded       UserProblemPoints[]
  ratings             ProblemRating[]
  progress            UserProgress[]

  @@unique([module, code])
  @@index([module, group])
}

model TestCase {
  id                  String   @id @default(cuid())
  problemId           String
  problem             Problem  @relation(fields: [problemId], references: [id], onDelete: Cascade)
  orderIndex          Int
  isSample            Boolean  @default(false)
  
  // Content-addressed disk/storage paths
  inputStoragePath    String
  outputStoragePath   String
  inputSha256         String   @db.VarChar(64)
  outputSha256        String   @db.VarChar(64)
  inputBytes          Int
  outputBytes         Int

  // Previews populated strictly for isSample == true (max 4 KB)
  sampleInputPreview  String?  @db.Text
  sampleOutputPreview String?  @db.Text

  createdAt           DateTime @default(now())

  testResults         SubmissionTestResult[]

  @@unique([problemId, orderIndex])
  @@index([problemId, orderIndex])
}

model Submission {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  problemId       String
  problem         Problem   @relation(fields: [problemId], references: [id], onDelete: Cascade)
  languageId      Int       // Judge0 Language ID
  sourceCode      String    @db.Text // Enforced max 128 KB
  verdict         Verdict   @default(IN_QUEUE)
  passedTests     Int       @default(0)
  totalTests      Int       @default(0)
  maxExecutionMs  Int       @default(0)
  maxMemoryUsedKb Int       @default(0)
  compilerOutput  String?   @db.Text // Truncated at 16 KB
  testcaseVersion Int       @default(1)
  createdAt       DateTime  @default(now())
  completedAt     DateTime?

  testResults     SubmissionTestResult[]
  pointAward      UserProblemPoints?

  @@index([userId, createdAt(sort: Desc)])
  @@index([problemId, verdict])
  @@index([verdict, createdAt])
}

model SubmissionTestResult {
  submissionId        String
  testCaseId          String
  judge0Token         String?    @unique
  verdict             Verdict    @default(IN_QUEUE)
  executionTimeMs     Int        @default(0)
  memoryUsedKb        Int        @default(0)
  
  // Populated strictly for sample testcases; null for secret testcases
  actualOutputPreview String?    @db.Text
  errorSignal         String?

  updatedAt           DateTime   @updatedAt

  submission          Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  testCase            TestCase   @relation(fields: [testCaseId], references: [id], onDelete: Cascade)

  @@id([submissionId, testCaseId])
  @@index([submissionId])
}

model UserProblemPoints {
  userId        String
  problemId     String
  submissionId  String     @unique
  points        Int
  awardedAt     DateTime   @default(now())

  user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  problem       Problem    @relation(fields: [problemId], references: [id], onDelete: Cascade)
  submission    Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)

  @@id([userId, problemId])
  @@index([userId])
}

model UserProgress {
  userId     String
  problemId  String
  state      String   // "todo" | "attempted" | "solved"
  updatedAt  DateTime @updatedAt

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  problem    Problem  @relation(fields: [problemId], references: [id], onDelete: Cascade)

  @@id([userId, problemId])
}

model ProblemRating {
  userId     String
  problemId  String
  rating     Int      // 1 to 5
  updatedAt  DateTime @updatedAt

  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  problem    Problem  @relation(fields: [problemId], references: [id], onDelete: Cascade)

  @@id([userId, problemId])
  @@index([problemId])
}

// Canonical Friendship: userAId is always lexicographically smaller than userBId
model Friendship {
  userAId     String
  userBId     String
  initiatorId String
  status      FriendStatus @default(PENDING)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  userA       User         @relation("FriendshipUserA", fields: [userAId], references: [id], onDelete: Cascade)
  userB       User         @relation("FriendshipUserB", fields: [userBId], references: [id], onDelete: Cascade)

  @@id([userAId, userBId])
  @@index([userBId, status])
}

model ForumThread {
  id         Int          @id @default(autoincrement())
  userId     String
  user       User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  category   String
  title      String       @db.VarChar(200)
  body       String       @db.Text
  imageUrls  String[]     @default([])
  isDeleted  Boolean      @default(false)
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt

  replies    ForumReply[]

  @@index([isDeleted, createdAt(sort: Desc)])
  @@index([category, isDeleted])
}

model ForumReply {
  id         Int          @id @default(autoincrement())
  threadId   Int
  thread     ForumThread  @relation(fields: [threadId], references: [id], onDelete: Cascade)
  userId     String
  user       User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  body       String       @db.Text
  imageUrls  String[]     @default([])
  isDeleted  Boolean      @default(false)
  createdAt  DateTime     @default(now())

  @@index([threadId, isDeleted, createdAt])
}

model SiteAnnouncement {
  id         Int      @id @default(1)
  text       String   @db.VarChar(500)
  enabled    Boolean  @default(false)
  updatedAt  DateTime @updatedAt
}

model HttpTrafficLog {
  id         BigInt   @id @default(autoincrement())
  method     String   @db.VarChar(10)
  path       String   @db.VarChar(255)
  statusCode Int
  elapsedMs  Int
  ipAddress  String   @db.VarChar(45)
  userId     String?
  createdAt  DateTime @default(now())

  @@index([createdAt(sort: Desc)])
  @@index([path])
}
```

---

## 5. Hardened Judge0 API Integration Contract

### 5.1 Language Mapping Matrix
| Language | Standard | Judge0 Language ID | Execution Command / Flags |
| :--- | :--- | :--- | :--- |
| **C** | C17 (GCC 14) | `103` (or `50` in CE) | `-std=c17 -O2 -pipe -lm` |
| **C++** | C++20 (G++ 14) | `105` (or `54` in CE) | `-std=c++20 -O2 -pipe` |
| **Python** | Python 3.12+ | `92` (or `71` in CE) | `python3 -I -B` |
| **Java** | OpenJDK 21 | `91` (or `62` in CE) | Standard OpenJDK runner |
| **Rust** | Rust 1.80+ | `73` | `rustc -O` |
| **Go** | Go 1.23+ | `95` (or `60` in CE) | `go build` |

### 5.2 Sandbox Execution Protocol
Submissions are dispatched to Judge0 with rigorous security limits and signed webhook callback URLs:

```http
POST /submissions/batch?base64_encoded=true
Content-Type: application/json
X-Judge0-Token: <INTERNAL_SHARED_SECRET>

{
  "submissions": [
    {
      "language_id": 105,
      "source_code": "<Base64 Source>",
      "stdin": "<Base64 Testcase Input>",
      "cpu_time_limit": 1.0,
      "cpu_extra_time": 0.2,
      "wall_time_limit": 3.0,
      "memory_limit": 524288,
      "stack_limit": 131072,
      "max_processes_and_or_threads": 64,
      "enable_per_process_and_thread_time_limit": false,
      "enable_per_process_and_thread_memory_limit": false,
      "max_file_size": 8192,
      "enable_network": false,
      "callback_url": "http://sveltekit-internal:3000/api/webhooks/judge0?subId=clxyz&tcId=tc123&sig=<HMAC_SHA256>"
    }
  ]
}
```

### 5.3 Webhook Verification & State Reconciliation
1. **Signature Verification**: Server computes `HMAC-SHA256(WEBHOOK_SECRET, subId + ":" + tcId)` and compares it against the `sig` query parameter via `crypto.timingSafeEqual`.
2. **Output Evaluation**: The server decodes stdout and compares it against the local testcase answer file (`outputStoragePath`) according to the problem's `ValidationMode`. Raw secret testcase output is discarded immediately.
3. **Atomic Result Upsert**: Update the corresponding `SubmissionTestResult` row.
4. **Final Verdict Calculation**: Once all testcases for the submission are complete, determine the final aggregate verdict. If `AC`, atomically credit points using `ON CONFLICT ("userId", "problemId") DO NOTHING` and increment the user's materialized stats.
5. **Real-time Event Broadcast**: Publish completion state to Redis channel `submission:<submissionId>` for SSE client consumption.

---

## 6. Implementation Architecture

### 6.1 SvelteKit CSP Configuration (`svelte.config.js`)
```javascript
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    csp: {
      mode: 'nonce',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:', 'https:'],
        'connect-src': ['self'],
        'frame-ancestors': ['none'],
        'base-uri': ['self'],
        'form-action': ['self']
      }
    }
  }
};

export default config;
```

### 6.2 Server Auth Configuration (`src/lib/server/auth.ts`)
```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "$lib/server/prisma";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || '"Untitled Judge" <no-reply@judge.org>',
        to: user.email,
        subject: "Your Untitled Judge Login Code",
        text: `Your confirmation code is: ${token}\nVerify: ${url}`,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [
    admin({
      defaultRole: "student",
      adminRole: "admin",
    }),
  ],
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },
});
```

### 6.3 Hardened Server Hook (`src/hooks.server.ts`)
```typescript
import type { Handle } from "@sveltejs/kit";
import { auth } from "$lib/server/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { recordTelemetry } from "$lib/server/telemetry";

export const handle: Handle = async ({ event, resolve }) => {
  const start = performance.now();

  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;

  const authResponse = await svelteKitHandler({ event, resolve, auth });
  if (authResponse) return authResponse;

  const response = await resolve(event);

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Non-blocking in-memory ring buffer telemetry (flushed asynchronously every 10s)
  recordTelemetry({
    method: event.request.method,
    path: event.route.id ?? event.url.pathname,
    statusCode: response.status,
    elapsedMs: Math.round(performance.now() - start),
    ipAddress: event.getClientAddress(),
    userId: event.locals.user?.id ?? null,
  });

  return response;
};
```

---

## 7. Verification & Security Acceptance Criteria

| Category | Verification Test Case | Pass / Fail Metric |
| :--- | :--- | :--- |
| **DOMjudge Package Discovery** | Drop a standard `Modul 1` directory with `problem.yaml` and `data/` test cases into the configured problems folder. | Problem appears in problemset; testcase payloads $> 2\text{ KB}$ are stored on disk via SHA-256 paths rather than PostgreSQL text columns. |
| **Hardened ZIP Ingestion** | Upload a malicious `.zip` containing `../../etc/passwd` paths, a symlink to `/etc/shadow`, and a 2 GB zero-byte decompression bomb. | Upload is immediately aborted with `400 Bad Request`; zero files written outside staging directory; server memory remains stable. |
| **Webhook Forgery Defense** | Send a forged `PUT /api/webhooks/judge0` request with Status ID `3` (`AC`) and an invalid or missing `sig` parameter. | Request rejected with `401 Unauthorized`; submission state and user points remain unchanged. |
| **Evaluation Concurrency & Dedup** | Dispatch 50 simultaneous C++ submissions across 25 student accounts, including simultaneous duplicate `AC` completions for the same user. | All 50 submissions complete in $< 15\text{ seconds}$; `UserProblemPoints` credits each user strictly once without race-condition duplicates or unhandled 500 errors. |
| **Media XSS Prevention** | Attempt to upload an `.svg` file containing `<script>alert(1)</script>` or a `.png` with embedded HTML polyglot metadata to a forum post. | `.svg` is rejected; `.png` is stripped and re-encoded via `sharp`; zero script execution possible. |
| **Sandbox Isolation** | Submit C++ code executing a `:(){ :|:& };:` fork bomb and attempting raw socket connections. | Contained by `--processes=64` and `--share-net=false` cgroups v2 limits; terminates cleanly with `RTE`/`TLE` without impacting concurrent jobs. |