const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");
const os = require("node:os");
const net = require("node:net");
const tls = require("node:tls");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const { promisify } = require("node:util");
const { DatabaseSync } = require("node:sqlite");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 4173;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, ".site-data");
const CONTAINER_RUNTIME = process.env.CONTAINER_RUNTIME || "podman";
const JUDGE_SANDBOX_IMAGE = process.env.JUDGE_SANDBOX_IMAGE || "untitled-judge-sandbox:latest";
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "";
const SECURE_COOKIES = process.env.COOKIE_SECURE === "true";
const DEFAULT_FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || "";
const DEFAULT_FIREBASE_AUTH_DOMAIN = process.env.FIREBASE_AUTH_DOMAIN || "";
const DEFAULT_FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";
const DEFAULT_FIREBASE_APP_ID = process.env.FIREBASE_APP_ID || "";
const DEFAULT_SMTP_HOST = process.env.SMTP_HOST || "";
const DEFAULT_SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const DEFAULT_SMTP_USER = process.env.SMTP_USER || "";
const DEFAULT_SMTP_PASS = process.env.SMTP_PASS || "";
const DEFAULT_SMTP_FROM = process.env.SMTP_FROM || "";
const ADMIN_USERNAME = "zal_2008";
const MAX_SOURCE_BYTES = 128 * 1024;
const MAX_REQUEST_BYTES = MAX_SOURCE_BYTES + 4096;
const MAX_ADMIN_REQUEST_BYTES = 16 * 1024 * 1024;
const MAX_ADMIN_PDF_BYTES = 8 * 1024 * 1024;
// Keep output bounded while allowing the largest bundled answer files (about 3.7 MiB).
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_COMPILER_OUTPUT_BYTES = 64 * 1024;
const COMPILER_TIMEOUT_MS = 15_000;
const MAX_QUEUED_SUBMISSIONS = 10;
const MAX_SUBMISSIONS_PER_USER = 2;
const MAX_FORUM_IMAGE_BYTES = 1024 * 1024;
const MAX_FORUM_IMAGES = 3;
const MAX_FORUM_REQUEST_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_REQUEST_BYTES = Math.ceil(MAX_FORUM_IMAGE_BYTES * 4 / 3) + 4096;
const judgeQueue = [];
let judgeWorkerRunning = false;
let activeJudgeUserId = null;
const authAttempts = new Map();
const SESSION_LIFETIME = 12 * 60 * 60 * 1000;
const LOGIN_CHALLENGE_LIFETIME = 10 * 60 * 1000;
const scrypt = promisify(crypto.scrypt);
const COOKIE_NAME = "untitled_judge_session";
const PASSWORD_KEY_LENGTH = 64;
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const EMAIL_PATTERN = /^[^\s@<>"',;:\\]+@[^\s@<>"',;:\\]+\.[^\s@<>"',;:\\]+$/;
const LANGUAGES = {
  c: { id: "c", name: "C17", extension: ".c", command: process.env.CC || "gcc", compileArgs: ["-std=c17", "-O2", "-pipe"] },
  cpp: { id: "cpp", name: "C++17", extension: ".cpp", command: process.env.CXX || "g++", compileArgs: ["-std=c++17", "-O2", "-pipe"] },
  python: { id: "python", name: "Python 3", extension: ".py", command: process.env.PYTHON || "python", runArgs: ["-I"] },
};
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".webp": "image/webp",
  ".ans": "text/plain; charset=utf-8",
  ".in": "text/plain; charset=utf-8",
};

fs.mkdirSync(DATA_DIR, { recursive: true });
const database = new DatabaseSync(path.join(DATA_DIR, "untitled-judge.db"));
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    username_key TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    avatar_mime_type TEXT,
    avatar_data BLOB,
    email TEXT,
    email_key TEXT,
    firebase_uid TEXT
  );
  CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS login_challenges (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    email TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('code', 'firebase_link')),
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS forum_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS forum_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS forum_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER REFERENCES forum_threads(id) ON DELETE CASCADE,
    reply_id INTEGER REFERENCES forum_replies(id) ON DELETE CASCADE,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/gif', 'image/webp')),
    image_data BLOB NOT NULL,
    created_at TEXT NOT NULL,
    CHECK ((thread_id IS NOT NULL AND reply_id IS NULL) OR (thread_id IS NULL AND reply_id IS NOT NULL))
  );
  CREATE TABLE IF NOT EXISTS user_progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('todo', 'solved')),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, problem_id)
  );
  CREATE TABLE IF NOT EXISTS friendships (
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (requester_id, addressee_id),
    CHECK (requester_id != addressee_id)
  );
  CREATE TABLE IF NOT EXISTS problem_ratings (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    updated_at TEXT NOT NULL,
    updated_by INTEGER,
    PRIMARY KEY (user_id, problem_id)
  );
  CREATE TABLE IF NOT EXISTS admin_problems (
    id TEXT PRIMARY KEY,
    module TEXT NOT NULL,
    group_name TEXT NOT NULL DEFAULT 'Classroom',
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    statement TEXT NOT NULL,
    testcases_json TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 100,
    statement_pdf BLOB,
    image_mime_type TEXT,
    image_data BLOB,
    created_at TEXT NOT NULL,
    UNIQUE (module, code)
  );
  CREATE TABLE IF NOT EXISTS problem_overrides (
    problem_id TEXT PRIMARY KEY,
    module TEXT,
    code TEXT,
    title TEXT,
    group_name TEXT,
    points INTEGER,
    statement_text TEXT,
    testcases_json TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS site_admins (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    granted_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id TEXT NOT NULL,
    language TEXT NOT NULL,
    verdict TEXT NOT NULL,
    passed INTEGER NOT NULL,
    total INTEGER NOT NULL,
    elapsed_ms INTEGER NOT NULL,
    tests_json TEXT NOT NULL,
    message TEXT NOT NULL,
    compiler_output TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS forum_threads_created_at ON forum_threads(created_at DESC);
  CREATE INDEX IF NOT EXISTS forum_replies_thread_id ON forum_replies(thread_id, created_at);
  CREATE INDEX IF NOT EXISTS forum_images_thread_id ON forum_images(thread_id);
  CREATE INDEX IF NOT EXISTS forum_images_reply_id ON forum_images(reply_id);
  CREATE INDEX IF NOT EXISTS submissions_user_created_at ON submissions(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS friendships_addressee_status ON friendships(addressee_id, status);
  CREATE INDEX IF NOT EXISTS friendships_requester_status ON friendships(requester_id, status);
  CREATE INDEX IF NOT EXISTS auth_sessions_expires_at ON auth_sessions(expires_at);
  CREATE INDEX IF NOT EXISTS login_challenges_expires_at ON login_challenges(expires_at);
  CREATE INDEX IF NOT EXISTS problem_ratings_problem_id ON problem_ratings(problem_id);
`);
const userColumns = new Set(database.prepare("PRAGMA table_info(users)").all().map((column) => column.name));
if (!userColumns.has("avatar_mime_type")) database.exec("ALTER TABLE users ADD COLUMN avatar_mime_type TEXT");
if (!userColumns.has("avatar_data")) database.exec("ALTER TABLE users ADD COLUMN avatar_data BLOB");
if (!userColumns.has("email")) database.exec("ALTER TABLE users ADD COLUMN email TEXT");
if (!userColumns.has("email_key")) database.exec("ALTER TABLE users ADD COLUMN email_key TEXT");
if (!userColumns.has("firebase_uid")) database.exec("ALTER TABLE users ADD COLUMN firebase_uid TEXT");
database.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users(email_key) WHERE email_key IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;
`);
if (!database.prepare("PRAGMA table_info(admin_problems)").all().some((column) => column.name === "points")) {
  database.exec("ALTER TABLE admin_problems ADD COLUMN points INTEGER NOT NULL DEFAULT 100");
}
const adminProblemColumns = new Set(database.prepare("PRAGMA table_info(admin_problems)").all().map((column) => column.name));
if (!adminProblemColumns.has("group_name")) database.exec("ALTER TABLE admin_problems ADD COLUMN group_name TEXT NOT NULL DEFAULT 'Classroom'");
if (!adminProblemColumns.has("statement_pdf")) database.exec("ALTER TABLE admin_problems ADD COLUMN statement_pdf BLOB");
if (!adminProblemColumns.has("image_mime_type")) database.exec("ALTER TABLE admin_problems ADD COLUMN image_mime_type TEXT");
if (!adminProblemColumns.has("image_data")) database.exec("ALTER TABLE admin_problems ADD COLUMN image_data BLOB");
database.exec(`
  CREATE TABLE IF NOT EXISTS user_problem_points (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id TEXT NOT NULL,
    points INTEGER NOT NULL,
    submission_id INTEGER NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
    awarded_at TEXT NOT NULL,
    PRIMARY KEY (user_id, problem_id)
  );
  CREATE INDEX IF NOT EXISTS user_problem_points_user_id ON user_problem_points(user_id);
`);
database.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(Date.now());
database.prepare("DELETE FROM login_challenges WHERE expires_at <= ?").run(Date.now());
database.prepare(`
  INSERT OR IGNORE INTO site_admins (user_id, granted_at)
  SELECT id, ? FROM users WHERE username_key = ?
`).run(new Date().toISOString(), ADMIN_USERNAME);
const sessionCleanupTimer = setInterval(() => {
  const now = Date.now();
  database.prepare("DELETE FROM auth_sessions WHERE expires_at <= ?").run(now);
  database.prepare("DELETE FROM login_challenges WHERE expires_at <= ?").run(now);
}, 15 * 60 * 1000);
sessionCleanupTimer.unref();

function unquoteYaml(value) {
  const text = value.trim();
  if (text.startsWith("'") && text.endsWith("'")) {
    return text.slice(1, -1).replace(/''/g, "'");
  }
  if (text.startsWith('"') && text.endsWith('"')) {
    try {
      return JSON.parse(text);
    } catch {
      return text.slice(1, -1);
    }
  }
  return text;
}

function answerNameForInput(name) {
  return name.replace(/\(\d+\)(?=\.in$)/i, "").replace(/\.in$/i, ".ans");
}

function archiveProblemPoints(module, group) {
  const moduleNumber = module.match(/^Modul\s+(\d+)$/i);
  if (!moduleNumber) return module === "FP" ? 300 : 100;
  const groupLetter = group.match(/^([A-Z])/i);
  const setIndex = groupLetter ? Math.max(0, groupLetter[1].toUpperCase().charCodeAt(0) - 65) : 0;
  return Math.min(1000, 100 + (Number(moduleNumber[1]) - 1) * 50 + setIndex * 25);
}

function collectProblems(directory = ROOT, results = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const folder = path.join(directory, entry.name);
    const metadataPath = path.join(folder, "problem.yaml");

    if (fs.existsSync(metadataPath)) {
      const metadata = fs.readFileSync(metadataPath, "utf8");
      const nameLine = metadata.match(/^name:\s*(.*?)\s*$/m);
      const relativePath = path.relative(ROOT, folder).split(path.sep).join("/");
      const sampleFolder = path.join(folder, "data", "sample");
      const samples = fs.existsSync(sampleFolder)
        ? fs.readdirSync(sampleFolder).filter((name) =>
          /\.in$/i.test(name) && fs.existsSync(path.join(sampleFolder, answerNameForInput(name)))
        ).length
        : 0;
      const hasStatement = fs.existsSync(path.join(folder, "problem.pdf"));
      const testcaseCount = hasStatement ? listTestCases(folder).length : 0;

      results.push({
        id: relativePath,
        code: path.basename(folder),
        module: relativePath.startsWith("FP/") ? "FP" : relativePath.split("/")[0],
        group: relativePath.startsWith("FP/") ? "Practice" : relativePath.split("/")[1],
        title: nameLine ? unquoteYaml(nameLine[1]) : path.basename(folder),
        statement: hasStatement,
        sampleCount: samples,
        testcaseCount,
        points: hasStatement ? archiveProblemPoints(
          relativePath.startsWith("FP/") ? "FP" : relativePath.split("/")[0],
          relativePath.startsWith("FP/") ? "Practice" : relativePath.split("/")[1]
        ) : 0,
      });
    }

    collectProblems(folder, results);
  }
  return results;
}

function collectAdditionalPdfProblems() {
  const archiveFolder = path.join(ROOT, "DP P1 all");
  if (!fs.existsSync(archiveFolder)) return [];
  return fs.readdirSync(archiveFolder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.pdf$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((entry, index) => {
      const filename = entry.name;
      const relativePath = path.relative(ROOT, path.join(archiveFolder, filename)).split(path.sep).join("/");
      const testcaseFolder = path.join(archiveFolder, path.basename(filename, path.extname(filename)));
      const sampleFolder = path.join(testcaseFolder, "data", "sample");
      const samples = fs.existsSync(sampleFolder)
        ? fs.readdirSync(sampleFolder).filter((name) =>
          /\.in$/i.test(name) && fs.existsSync(path.join(sampleFolder, answerNameForInput(name)))
        ).length
        : 0;
      const testcaseCount = listTestCases(testcaseFolder).length;
      return {
        id: relativePath,
        code: `DP1-${String(index + 1).padStart(2, "0")}`,
        module: "DP P1 all",
        group: "PDF Archive",
        title: path.basename(filename, path.extname(filename)).replace(/^prob-/i, "").replace(/_/g, " ").replace(/\s+/g, " ").trim(),
        statement: true,
        sampleCount: samples,
        testcaseCount,
        points: testcaseCount ? 100 : 0,
        archivePdf: relativePath,
        testcaseFolder,
      };
    });
}

function listTestCases(problemFolder) {
  const dataFolder = path.join(problemFolder, "data");
  if (!fs.existsSync(dataFolder)) return [];
  const cases = [];
  for (const group of fs.readdirSync(dataFolder, { withFileTypes: true })) {
    if (!group.isDirectory()) continue;
    const groupFolder = path.join(dataFolder, group.name);
    for (const name of fs.readdirSync(groupFolder)) {
      if (!/\.in$/i.test(name)) continue;
      const answerName = answerNameForInput(name);
      const input = path.join(groupFolder, name);
      const answer = path.join(groupFolder, answerName);
      if (fs.existsSync(answer) && fs.statSync(input).isFile() && fs.statSync(answer).isFile()) {
        cases.push({ input, answer });
      }
    }
  }
  return cases.sort((a, b) => a.input.localeCompare(b.input, undefined, { numeric: true }));
}

function testcaseFolderForProblem(problem) {
  if (problem.testcaseFolder) return problem.testcaseFolder;
  return path.join(ROOT, ...problem.id.split("/"));
}

let problems = loadProblems().sort((a, b) =>
  a.module.localeCompare(b.module, undefined, { numeric: true }) ||
  a.id.localeCompare(b.id, undefined, { numeric: true })
);

const unawardedAcceptedSubmissions = database.prepare(`
  SELECT s.id, s.user_id, s.problem_id, s.created_at
  FROM submissions s
  WHERE s.verdict = 'AC'
    AND NOT EXISTS (
      SELECT 1 FROM user_problem_points p
      WHERE p.user_id = s.user_id AND p.problem_id = s.problem_id
    )
  ORDER BY s.id
`).all();
const insertProblemPoints = database.prepare(`
  INSERT OR IGNORE INTO user_problem_points (user_id, problem_id, points, submission_id, awarded_at)
  VALUES (?, ?, ?, ?, ?)
`);
for (const submission of unawardedAcceptedSubmissions) {
  const problem = problems.find((item) => item.id === submission.problem_id);
  insertProblemPoints.run(submission.user_id, submission.problem_id, problem?.points ?? 100, submission.id, submission.created_at);
}
database.exec(`
  INSERT INTO user_progress (user_id, problem_id, state, updated_at)
  SELECT user_id, problem_id, 'solved', MAX(created_at)
  FROM submissions
  WHERE verdict = 'AC'
  GROUP BY user_id, problem_id
  ON CONFLICT(user_id, problem_id) DO UPDATE SET
    state = 'solved', updated_at = excluded.updated_at
`);

function loadProblems() {
  const archive = [...collectProblems(), ...collectAdditionalPdfProblems()];
  const customProblems = database.prepare(
      `SELECT id, module, group_name, code, title, statement, testcases_json, points,
        (statement_pdf IS NOT NULL) AS has_pdf,
        (image_mime_type IS NOT NULL) AS has_image
       FROM admin_problems`
  ).all().map((row) => ({
    id: row.id,
    code: row.code,
    module: row.module,
    group: row.group_name,
    title: row.title,
    statement: Boolean(row.has_pdf),
    statementText: row.statement,
    testcaseCount: JSON.parse(row.testcases_json).length,
    points: row.points,
    imageUrl: row.has_image ? `/api/admin-problem-assets/image/${encodeURIComponent(row.id)}` : null,
    custom: true,
  }));
  const overrides = new Map(database.prepare(`
    SELECT problem_id, module, code, title, group_name, points, statement_text, testcases_json
    FROM problem_overrides
  `).all().map((row) => [row.problem_id, row]));
  const overriddenArchive = archive.map((problem) => {
    const override = overrides.get(problem.id);
    if (!override) return problem;
    const testcases = override.testcases_json ? JSON.parse(override.testcases_json) : null;
    return {
      ...problem,
      module: override.module ?? problem.module,
      code: override.code ?? problem.code,
      title: override.title ?? problem.title,
      group: override.group_name ?? problem.group,
      points: override.points ?? problem.points,
      statementText: override.statement_text ?? null,
      testcaseCount: testcases ? testcases.length : problem.testcaseCount,
      sampleCount: testcases ? testcases.filter((testCase) => testCase.sample).length : problem.sampleCount,
      testcaseOverride: Boolean(testcases),
    };
  });
  return [...overriddenArchive, ...customProblems];
}

function isAdmin(user) {
  return Boolean(user && database.prepare("SELECT 1 FROM site_admins WHERE user_id = ?").get(user.id));
}

function publicProblem(problem, user = null) {
  const { statementText, testcaseFolder, ...publicFields } = problem;
  const rating = database.prepare(
    "SELECT AVG(rating) AS average, COUNT(*) AS count FROM problem_ratings WHERE problem_id = ?"
  ).get(problem.id);
  const ownRating = user
    ? database.prepare("SELECT rating FROM problem_ratings WHERE user_id = ? AND problem_id = ?").get(user.id, problem.id)
    : null;
  return {
    ...publicFields,
    points: problem.points,
    imageUrl: problem.imageUrl || null,
    ratingAverage: rating.count ? Number(rating.average) : null,
    ratingCount: rating.count,
    myRating: ownRating?.rating ?? null,
  };
}

function validateProblemCases(testcases, allowEmpty = false) {
  if (!Array.isArray(testcases) || testcases.length < (allowEmpty ? 0 : 1) || testcases.length > 100) {
    return `Add between ${allowEmpty ? "0" : "1"} and 100 testcase pairs.`;
  }
  let totalBytes = 0;
  for (const testCase of testcases) {
    if (!testCase || typeof testCase !== "object" || Array.isArray(testCase) ||
        typeof testCase.input !== "string" || typeof testCase.output !== "string" ||
        (testCase.sample !== undefined && typeof testCase.sample !== "boolean")) {
      return "Each testcase needs input and output text, with an optional true/false sample flag.";
    }
    const inputBytes = Buffer.byteLength(testCase.input, "utf8");
    const outputBytes = Buffer.byteLength(testCase.output, "utf8");
    if (inputBytes > 256 * 1024 || outputBytes > 256 * 1024) {
      return "Each testcase input and output must be 256 KB or smaller.";
    }
    totalBytes += inputBytes + outputBytes;
  }
  if (totalBytes > 2 * 1024 * 1024) return "All testcase pairs together must be 2 MB or smaller.";
  return "";
}

function validateAdminProblemUploads(body) {
  let statementPdf = null;
  if (body.statementPdf !== undefined && body.statementPdf !== null) {
    const upload = body.statementPdf;
    const maxBase64Bytes = Math.ceil(MAX_ADMIN_PDF_BYTES * 4 / 3) + 4;
    if (!upload || typeof upload !== "object" || upload.type !== "application/pdf" ||
        typeof upload.data !== "string" || upload.data.length > maxBase64Bytes ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(upload.data)) {
      throw Object.assign(new Error("The statement upload must be a PDF no larger than 8 MB."), { statusCode: 400 });
    }
    statementPdf = Buffer.from(upload.data, "base64");
    if (!statementPdf.length || statementPdf.length > MAX_ADMIN_PDF_BYTES ||
        statementPdf.toString("base64") !== upload.data ||
        statementPdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw Object.assign(new Error("The statement upload is not a valid PDF file or exceeds 8 MB."), { statusCode: 400 });
    }
  }

  let image = null;
  if (body.image !== undefined && body.image !== null) {
    try {
      [image] = validateForumImages([body.image]);
    } catch {
      throw Object.assign(new Error("The optional image must be a PNG, JPEG, GIF, or WebP file no larger than 1 MB."), { statusCode: 400 });
    }
  }
  return { statementPdf, image };
}

function send(response, status, body, contentType = "application/json; charset=utf-8") {
  response.writeHead(status, { "Content-Type": contentType, "X-Content-Type-Options": "nosniff" });
  response.end(body);
}

function jsonError(response, status, message) {
  send(response, status, JSON.stringify({ error: message }));
}

function setSessionCookie(response, token, maxAge) {
  const secure = SECURE_COOKIES ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`);
}

function getCookie(request, name) {
  const cookie = request.headers.cookie || "";
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return "";
}

function getSessionUser(request, response) {
  const token = getCookie(request, COOKIE_NAME);
  if (!TOKEN_PATTERN.test(token)) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const session = database.prepare(
    "SELECT user_id, expires_at FROM auth_sessions WHERE token_hash = ?"
  ).get(tokenHash);
  if (!session || session.expires_at <= Date.now()) {
    if (session) database.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }
  const user = database.prepare("SELECT id, username FROM users WHERE id = ?").get(session.user_id);
  if (!user) {
    database.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }
  const expiresAt = Date.now() + SESSION_LIFETIME;
  database.prepare("UPDATE auth_sessions SET expires_at = ? WHERE token_hash = ?").run(expiresAt, tokenHash);
  setSessionCookie(response, token, Math.ceil(SESSION_LIFETIME / 1000));
  return user;
}

function currentUser(request, response) {
  return getSessionUser(request, response);
}

function createSession(response, user) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = Date.now() + SESSION_LIFETIME;
  database.prepare(
    "INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
  ).run(tokenHash, user.id, expiresAt, new Date().toISOString());
  setSessionCookie(response, token, Math.ceil(SESSION_LIFETIME / 1000));
}

function clearSession(request, response) {
  const token = getCookie(request, COOKIE_NAME);
  if (TOKEN_PATTERN.test(token)) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    database.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(tokenHash);
  }
  setSessionCookie(response, "", 0);
}

function authClientAddress(request) {
  const socketAddress = request.socket.remoteAddress || "unknown";
  const isLoopback = socketAddress === "127.0.0.1" || socketAddress === "::1" || socketAddress.startsWith("::ffff:127.");
  if (!isLoopback) return socketAddress;

  // Caddy is the only proxy in front of this loopback-only app. It appends the
  // connecting client address to X-Forwarded-For, so trust only its final IP.
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string") {
    const forwardedAddress = forwardedFor.split(",").map((part) => part.trim()).at(-1);
    if (forwardedAddress && net.isIP(forwardedAddress)) return forwardedAddress;
  }
  return socketAddress;
}

function authRateLimit(request, response, usernameKey) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const limits = [
    { key: `ip:${authClientAddress(request)}`, max: 60 },
    { key: `username:${/^[A-Za-z0-9_]{3,24}$/.test(usernameKey) ? usernameKey : "<invalid>"}`, max: 12 },
  ];
  if (authAttempts.size > 10_000) {
    for (const [key, attempts] of authAttempts) {
      if (attempts.expiresAt <= now) authAttempts.delete(key);
    }
  }
  const buckets = limits.map(({ key, max }) => {
    let attempts = authAttempts.get(key);
    if (!attempts || attempts.expiresAt <= now) {
      while (authAttempts.size >= 10_000) {
        authAttempts.delete(authAttempts.keys().next().value);
      }
      attempts = { count: 0, expiresAt: now + windowMs };
      authAttempts.set(key, attempts);
    }
    return { attempts, max };
  });
  const blocked = buckets.find(({ attempts, max }) => attempts.count >= max);
  if (blocked) {
    response.setHeader("Retry-After", String(Math.ceil((blocked.attempts.expiresAt - now) / 1000)));
    jsonError(response, 429, "Too many account requests. Please try again in 15 minutes.");
    return true;
  }
  for (const { attempts } of buckets) attempts.count += 1;
  return false;
}

async function hashPassword(password, salt) {
  return scrypt(password, salt, PASSWORD_KEY_LENGTH, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function validEmail(email) {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  return trimmed.length >= 5 && trimmed.length <= 254 &&
    EMAIL_PATTERN.test(trimmed) && !/[\r\n]/.test(trimmed);
}

function maskEmail(email) {
  if (typeof email !== "string" || !email.includes("@")) return "";
  const [local, domain] = email.split("@");
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, Math.min(5, local.length - visible.length)))}@${domain}`;
}

function getAuthSettings() {
  const rows = database.prepare("SELECT key, value FROM site_settings").all();
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const firebaseApiKey = (stored.firebaseApiKey ?? DEFAULT_FIREBASE_API_KEY).trim();
  const firebaseAuthDomain = (stored.firebaseAuthDomain ?? DEFAULT_FIREBASE_AUTH_DOMAIN).trim();
  const firebaseProjectId = (stored.firebaseProjectId ?? DEFAULT_FIREBASE_PROJECT_ID).trim();
  const firebaseAppId = (stored.firebaseAppId ?? DEFAULT_FIREBASE_APP_ID).trim();
  const smtpHost = (stored.smtpHost ?? DEFAULT_SMTP_HOST).trim();
  const smtpPort = Number(stored.smtpPort ?? DEFAULT_SMTP_PORT) || 465;
  const smtpUser = (stored.smtpUser ?? DEFAULT_SMTP_USER).trim();
  const smtpPass = stored.smtpPass ?? DEFAULT_SMTP_PASS;
  const smtpFrom = (stored.smtpFrom ?? DEFAULT_SMTP_FROM).trim() || smtpUser;
  const requireEmailConfirmation = stored.requireEmailConfirmation !== "false";
  const firebaseEnabled = Boolean(firebaseApiKey && firebaseAuthDomain && firebaseProjectId);
  const smtpEnabled = Boolean(smtpHost && smtpUser && smtpPass);
  return {
    firebaseApiKey,
    firebaseAuthDomain,
    firebaseProjectId,
    firebaseAppId,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom,
    requireEmailConfirmation,
    firebaseEnabled,
    smtpEnabled,
  };
}

function saveAuthSettings(updates) {
  const now = new Date().toISOString();
  const upsert = database.prepare(`
    INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    upsert.run(key, String(value), now);
  }
}

function publicAuthConfig() {
  const settings = getAuthSettings();
  const emailMode = !settings.requireEmailConfirmation
    ? "off"
    : settings.smtpEnabled
      ? "code"
      : settings.firebaseEnabled
        ? "firebase"
        : "unconfigured";
  return {
    firebase: {
      enabled: settings.firebaseEnabled,
      apiKey: settings.firebaseApiKey,
      authDomain: settings.firebaseAuthDomain,
      projectId: settings.firebaseProjectId,
      appId: settings.firebaseAppId,
    },
    emailConfirmation: {
      enabled: emailMode !== "off" && emailMode !== "unconfigured",
      mode: emailMode,
    },
  };
}

let cachedGoogleCerts = { certs: null, expiresAt: 0 };

function httpsJsonRequest(urlString, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlString);
    const req = https.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: options.method || "GET",
      headers: options.headers || {},
      timeout: 8000,
    }, (res) => {
      const chunks = [];
      let total = 0;
      res.on("data", (chunk) => {
        total += chunk.length;
        if (total > 256 * 1024) {
          req.destroy(new Error("Upstream response too large."));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        try {
          resolve({ status: res.statusCode || 0, headers: res.headers, data: JSON.parse(text) });
        } catch {
          reject(new Error("Invalid JSON response from authentication provider."));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Authentication verification timed out.")));
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function getGooglePublicCerts() {
  if (cachedGoogleCerts.certs && cachedGoogleCerts.expiresAt > Date.now()) {
    return cachedGoogleCerts.certs;
  }
  const response = await httpsJsonRequest(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
  );
  if (response.status !== 200 || !response.data || typeof response.data !== "object") {
    throw new Error("Could not load Google public certificates for Firebase verification.");
  }
  const cacheControl = String(response.headers["cache-control"] || "");
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSeconds = maxAgeMatch ? Math.min(86400, Math.max(60, Number(maxAgeMatch[1]))) : 3600;
  cachedGoogleCerts = {
    certs: response.data,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  };
  return cachedGoogleCerts.certs;
}

async function verifyFirebaseIdToken(idToken, settings) {
  if (!settings.firebaseEnabled) {
    throw Object.assign(new Error("Firebase authentication is not configured on this server yet."), { statusCode: 503 });
  }
  if (typeof idToken !== "string" || idToken.length < 50 || idToken.length > 16384) {
    throw Object.assign(new Error("Invalid Firebase ID token."), { statusCode: 401 });
  }
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw Object.assign(new Error("Malformed Firebase ID token."), { statusCode: 401 });
  }
  let header;
  let claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw Object.assign(new Error("Malformed Firebase ID token payload."), { statusCode: 401 });
  }
  if (!header || header.alg !== "RS256" || typeof header.kid !== "string") {
    throw Object.assign(new Error("Unsupported Firebase token signature algorithm."), { statusCode: 401 });
  }
  const expectedIssuer = `https://securetoken.google.com/${settings.firebaseProjectId}`;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!claims || claims.aud !== settings.firebaseProjectId || claims.iss !== expectedIssuer ||
      typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 128 ||
      typeof claims.exp !== "number" || claims.exp <= nowSeconds - 30 ||
      typeof claims.iat !== "number" || claims.iat > nowSeconds + 60) {
    throw Object.assign(new Error("Firebase ID token claims do not match this project or have expired."), { statusCode: 401 });
  }
  const certs = await getGooglePublicCerts();
  const certPem = certs[header.kid];
  if (typeof certPem !== "string") {
    throw Object.assign(new Error("Unknown signing key for Firebase ID token."), { statusCode: 401 });
  }
  const publicKey = new crypto.X509Certificate(certPem).publicKey;
  const signedData = Buffer.from(`${parts[0]}.${parts[1]}`, "utf8");
  const signature = Buffer.from(parts[2], "base64url");
  if (!crypto.verify("RSA-SHA256", signedData, publicKey, signature)) {
    throw Object.assign(new Error("Invalid Firebase ID token signature."), { statusCode: 401 });
  }
  return {
    uid: claims.sub,
    email: typeof claims.email === "string" ? claims.email.trim() : "",
    emailVerified: Boolean(claims.email_verified),
    name: typeof claims.name === "string" ? claims.name.trim() : "",
  };
}

function sendSmtpEmail({ host, port, user, pass, from, to, subject, text }) {
  return new Promise((resolve, reject) => {
    if (!validEmail(to) || !validEmail(from)) {
      reject(new Error("Invalid sender or recipient email address."));
      return;
    }
    let socket;
    let settled = false;
    let buffer = "";
    let currentLines = [];
    let waitingHandler = null;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      try {
        socket?.destroy();
      } catch {}
      if (err) reject(err);
      else resolve();
    };

    const readResponse = () => new Promise((res, rej) => {
      waitingHandler = { res, rej };
    });

    const onData = (chunk) => {
      buffer += chunk.toString("utf8");
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
        buffer = buffer.slice(newlineIndex + 1);
        currentLines.push(line);
        if (/^\d{3} /.test(line) || (line.length === 3 && /^\d{3}$/.test(line))) {
          const code = Number(line.slice(0, 3));
          const message = currentLines.join("\n");
          currentLines = [];
          if (waitingHandler) {
            const { res, rej } = waitingHandler;
            waitingHandler = null;
            if (code >= 400) rej(new Error(`SMTP error (${code}): ${message}`));
            else res({ code, message });
          }
        }
      }
    };

    const attachSocket = (activeSocket) => {
      socket = activeSocket;
      socket.setTimeout(10_000, () => finish(new Error("SMTP connection timed out.")));
      socket.on("error", (err) => finish(err));
      socket.on("close", () => {
        if (!settled) finish(new Error("SMTP connection closed unexpectedly."));
      });
      socket.on("data", onData);
    };

    const sendLine = (line) => {
      socket.write(`${line}\r\n`);
    };

    const runProtocol = async () => {
      try {
        await readResponse();
        sendLine("EHLO untitled-judge.local");
        const ehlo = await readResponse();
        if (port !== 465 && !(socket instanceof tls.TLSSocket)) {
          if (!/STARTTLS/i.test(ehlo.message)) {
            throw new Error("SMTP server does not support STARTTLS on this port.");
          }
          sendLine("STARTTLS");
          await readResponse();
          socket.removeAllListeners("data");
          socket.removeAllListeners("error");
          socket.removeAllListeners("close");
          socket = await new Promise((res, rej) => {
            const tlsSocket = tls.connect({ socket, servername: host }, () => res(tlsSocket));
            tlsSocket.once("error", rej);
          });
          attachSocket(socket);
          sendLine("EHLO untitled-judge.local");
          await readResponse();
        }
        sendLine("AUTH LOGIN");
        await readResponse();
        sendLine(Buffer.from(user, "utf8").toString("base64"));
        await readResponse();
        sendLine(Buffer.from(pass, "utf8").toString("base64"));
        await readResponse();
        sendLine(`MAIL FROM:<${from}>`);
        await readResponse();
        sendLine(`RCPT TO:<${to}>`);
        await readResponse();
        sendLine("DATA");
        await readResponse();
        const safeSubject = String(subject).replace(/[\r\n]+/g, " ").trim();
        const safeBody = String(text)
          .replace(/\r?\n/g, "\r\n")
          .replace(/^\./gm, "..");
        const message = [
          `From: "Untitled Judge Web" <${from}>`,
          `To: <${to}>`,
          `Subject: ${safeSubject}`,
          `Date: ${new Date().toUTCString()}`,
          "MIME-Version: 1.0",
          "Content-Type: text/plain; charset=utf-8",
          "",
          safeBody,
          ".",
        ].join("\r\n");
        sendLine(message);
        await readResponse();
        sendLine("QUIT");
        finish();
      } catch (err) {
        finish(err);
      }
    };

    const initialSocket = port === 465
      ? tls.connect({ host, port, servername: host })
      : net.connect({ host, port });
    attachSocket(initialSocket);
    void runProtocol();
  });
}

async function sendLoginCodeEmail(settings, toEmail, username, code) {
  await sendSmtpEmail({
    host: settings.smtpHost,
    port: settings.smtpPort,
    user: settings.smtpUser,
    pass: settings.smtpPass,
    from: settings.smtpFrom || settings.smtpUser,
    to: toEmail,
    subject: `Untitled Judge login confirmation code: ${code}`,
    text: [
      `Hello ${username},`,
      "",
      "Someone is signing in to your Untitled Judge Web account.",
      "Enter this 6-digit confirmation code to finish logging in:",
      "",
      `    ${code}`,
      "",
      "This code expires in 10 minutes. If you did not try to log in, please change your password.",
    ].join("\n"),
  });
}

function suggestAvailableUsername(rawText) {
  let base = String(rawText || "")
    .replace(/@.*$/, "")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (base.length < 3) base = `${base || "user"}_judge`.slice(0, 24);
  if (base.length > 20) base = base.slice(0, 20);
  const checkStmt = database.prepare("SELECT 1 FROM users WHERE username_key = ?");
  let candidate = base;
  let suffix = 1;
  while (candidate.toLocaleLowerCase("en-US") === ADMIN_USERNAME ||
         checkStmt.get(candidate.toLocaleLowerCase("en-US"))) {
    candidate = `${base.slice(0, 18)}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function validForumText(text, maxLength) {
  return typeof text === "string" && text.trim().length > 0 &&
    text.trim().length <= maxLength && Buffer.byteLength(text, "utf8") <= maxLength * 4;
}

function validateForumImages(images) {
  if (images === undefined) return [];
  if (!Array.isArray(images) || images.length > MAX_FORUM_IMAGES) {
    throw Object.assign(new Error(`Attach no more than ${MAX_FORUM_IMAGES} images.`), { statusCode: 400 });
  }
  const acceptedTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
  return images.map((image) => {
    if (!image || typeof image !== "object" || !acceptedTypes.has(image.type) ||
        typeof image.data !== "string" || image.data.length > Math.ceil(MAX_FORUM_IMAGE_BYTES * 4 / 3) + 4 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image.data)) {
      throw Object.assign(new Error("Each attachment must be a PNG, JPEG, GIF, or WebP image no larger than 1 MB."), { statusCode: 400 });
    }
    const data = Buffer.from(image.data, "base64");
    if (data.length > MAX_FORUM_IMAGE_BYTES || data.toString("base64") !== image.data) {
      throw Object.assign(new Error("Each attachment must be a PNG, JPEG, GIF, or WebP image no larger than 1 MB."), { statusCode: 400 });
    }
    const isPng = image.type === "image/png" && data.length >= 8 &&
      data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = image.type === "image/jpeg" && data.length >= 3 &&
      data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
    const isGif = image.type === "image/gif" && data.length >= 6 &&
      ["GIF87a", "GIF89a"].includes(data.subarray(0, 6).toString("ascii"));
    const isWebp = image.type === "image/webp" && data.length >= 12 &&
      data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
    if (!isPng && !isJpeg && !isGif && !isWebp) {
      throw Object.assign(new Error("An attachment's file contents do not match its supported image type."), { statusCode: 400 });
    }
    return { type: image.type, data };
  });
}

function insertForumImages(images, column, postId) {
  if (!["thread_id", "reply_id"].includes(column)) throw new Error("Unsupported forum image owner.");
  const insertImage = database.prepare(
    `INSERT INTO forum_images (${column}, mime_type, image_data, created_at) VALUES (?, ?, ?, ?)`
  );
  const createdAt = new Date().toISOString();
  images.forEach((image) => insertImage.run(postId, image.type, image.data, createdAt));
}

function listForumImages(column, postId) {
  if (!["thread_id", "reply_id"].includes(column)) throw new Error("Unsupported forum image owner.");
  return database.prepare(`SELECT id, mime_type FROM forum_images WHERE ${column} = ? ORDER BY id`).all(postId)
    .map((image) => ({ id: image.id, type: image.mime_type, url: `/api/forum/images/${image.id}` }));
}

function getFriendshipStatus(viewerId, profileId) {
  if (viewerId === profileId) return "self";
  const outgoing = database.prepare(
    "SELECT status FROM friendships WHERE requester_id = ? AND addressee_id = ?"
  ).get(viewerId, profileId);
  const incoming = database.prepare(
    "SELECT status FROM friendships WHERE requester_id = ? AND addressee_id = ?"
  ).get(profileId, viewerId);
  if (outgoing?.status === "accepted" || incoming?.status === "accepted") return "friends";
  if (outgoing?.status === "pending") return "request_sent";
  if (incoming?.status === "pending") return "request_received";
  return "none";
}

function getFriendCount(userId) {
  return database.prepare(`
    SELECT COUNT(*) AS count FROM friendships
    WHERE status = 'accepted' AND (requester_id = ? OR addressee_id = ?)
  `).get(userId, userId).count;
}

function getFriendOverview(userId) {
  const friends = database.prepare(`
    SELECT u.id, u.username, u.avatar_mime_type IS NOT NULL AS has_avatar
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
    WHERE f.status = 'accepted' AND (f.requester_id = ? OR f.addressee_id = ?)
    ORDER BY u.username COLLATE NOCASE
  `).all(userId, userId, userId).map((friend) => ({
    id: friend.id,
    username: friend.username,
    avatarUrl: friend.has_avatar ? `/api/users/${friend.id}/avatar` : null,
  }));
  const pending = database.prepare(`
    SELECT f.requester_id AS id, u.username, 'incoming' AS direction, u.avatar_mime_type IS NOT NULL AS has_avatar
    FROM friendships f JOIN users u ON u.id = f.requester_id
    WHERE f.addressee_id = ? AND f.status = 'pending'
    UNION ALL
    SELECT f.addressee_id AS id, u.username, 'outgoing' AS direction, u.avatar_mime_type IS NOT NULL AS has_avatar
    FROM friendships f JOIN users u ON u.id = f.addressee_id
    WHERE f.requester_id = ? AND f.status = 'pending'
    ORDER BY username COLLATE NOCASE
  `).all(userId, userId).map((request) => ({
    id: request.id,
    username: request.username,
    direction: request.direction,
    avatarUrl: request.has_avatar ? `/api/users/${request.id}/avatar` : null,
  }));
  return { friends, requests: pending };
}

function persistSubmission(user, problem, language, result) {
  const tests = Array.isArray(result.tests) ? result.tests : [];
  const firstFailure = tests.find((test) => test.verdict !== "AC");
  const verdict = tests.length ? firstFailure?.verdict || "AC" :
    result.error?.toLowerCase().includes("compilation") ? "CE" : "ERROR";
  const elapsedMs = tests.reduce((sum, test) => sum + test.elapsedMs, 0);
  const createdAt = new Date().toISOString();
  const inserted = database.prepare(`
    INSERT INTO submissions (user_id, problem_id, language, verdict, passed, total, elapsed_ms, tests_json, message, compiler_output, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(user.id, problem.id, language, verdict, result.passed ?? 0, tests.length || problem.testcaseCount,
    elapsedMs, JSON.stringify(tests), result.error || "", (result.compilerOutput || "").slice(0, 8000), createdAt);
  let pointsEarned = 0;
  if (verdict === "AC") {
    const awarded = database.prepare(`
      INSERT OR IGNORE INTO user_problem_points (user_id, problem_id, points, submission_id, awarded_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, problem.id, problem.points, Number(inserted.lastInsertRowid), createdAt);
    if (awarded.changes) pointsEarned = problem.points;
    database.prepare(`
      INSERT INTO user_progress (user_id, problem_id, state, updated_at) VALUES (?, ?, 'solved', ?)
      ON CONFLICT(user_id, problem_id) DO UPDATE SET state = 'solved', updated_at = excluded.updated_at
    `).run(user.id, problem.id, createdAt);
  }
  return { verdict, passed: result.passed ?? 0, total: tests.length || problem.testcaseCount, elapsedMs, tests, message: result.error || "", compilerOutput: (result.compilerOutput || "").slice(0, 8000), pointsEarned, createdAt };
}

function publicThreadSummary(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    author: row.author,
    authorId: row.author_id,
    createdAt: row.created_at,
    replyCount: row.reply_count,
    lastReplyAt: row.last_reply_at || row.created_at,
  };
}

function getForumThreads(category = "all", admin = false) {
  const filter = category === "all" ? "" : "WHERE t.category = ?";
  const statement = database.prepare(`
    SELECT t.id, t.title, t.category, u.id AS author_id, u.username AS author, t.created_at,
      COUNT(r.id) AS reply_count, MAX(r.created_at) AS last_reply_at
    FROM forum_threads t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN forum_replies r ON r.thread_id = t.id
    ${filter}
    GROUP BY t.id
    ORDER BY COALESCE(MAX(r.created_at), t.created_at) DESC, t.id DESC
    LIMIT 100
  `);
  return (category === "all" ? statement.all() : statement.all(category)).map((row) => ({
    ...publicThreadSummary(row),
    canDelete: admin,
  }));
}

function userProgressMap(userId) {
  return Object.fromEntries(database.prepare(
    "SELECT problem_id, state FROM user_progress WHERE user_id = ?"
  ).all(userId).map((row) => [row.problem_id, row.state]));
}

async function handleUserApi(request, response, url) {
  const pathname = url.pathname;
  const isPost = request.method === "POST";
  const isDelete = request.method === "DELETE";
  const isWriteRoute = (isPost && [
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/login/verify",
    "/api/auth/firebase",
    "/api/auth/logout",
    "/api/progress",
    "/api/ratings",
    "/api/friends",
    "/api/account/avatar",
    "/api/account/email",
    "/api/admin/problems",
    "/api/admin/problems/update",
    "/api/admin/auth-settings",
    "/api/forum/threads",
  ].includes(pathname) || (isPost && /^\/api\/forum\/threads\/\d+\/replies$/.test(pathname))) ||
    (isDelete && (/^\/api\/forum\/(?:threads|replies)\/\d+$/.test(pathname) ||
      pathname === "/api/account/avatar"));

  const adminProblemAssetRoute = pathname.match(/^\/api\/admin-problem-assets\/(pdf|image)\/(.+)$/);
  if (adminProblemAssetRoute && (request.method === "GET" || request.method === "HEAD")) {
    let problemId;
    try {
      problemId = decodeURIComponent(adminProblemAssetRoute[2]);
    } catch {
      jsonError(response, 400, "Invalid problem asset ID.");
      return true;
    }
    const asset = adminProblemAssetRoute[1] === "pdf"
      ? database.prepare("SELECT statement_pdf AS data FROM admin_problems WHERE id = ?").get(problemId)
      : database.prepare("SELECT image_mime_type AS content_type, image_data AS data FROM admin_problems WHERE id = ?").get(problemId);
    if (!asset?.data) {
      jsonError(response, 404, "Problem asset not found.");
      return true;
    }
    const contentType = adminProblemAssetRoute[1] === "pdf" ? "application/pdf" : asset.content_type;
    response.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": asset.data.byteLength,
      "Content-Disposition": adminProblemAssetRoute[1] === "pdf" ? 'inline; filename="statement.pdf"' : "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600",
    });
    response.end(request.method === "HEAD" ? undefined : Buffer.from(asset.data));
    return true;
  }

  if (pathname === "/api/admin/auth-settings" && request.method === "GET") {
    const user = currentUser(request, response);
    if (!user || !isAdmin(user)) {
      jsonError(response, user ? 403 : 401, "Only the administrator can view authentication settings.");
      return true;
    }
    const settings = getAuthSettings();
    send(response, 200, JSON.stringify({
      firebaseApiKey: settings.firebaseApiKey,
      firebaseAuthDomain: settings.firebaseAuthDomain,
      firebaseProjectId: settings.firebaseProjectId,
      firebaseAppId: settings.firebaseAppId,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpUser: settings.smtpUser,
      smtpFrom: settings.smtpFrom,
      hasSmtpPass: Boolean(settings.smtpPass),
      requireEmailConfirmation: settings.requireEmailConfirmation,
      firebaseEnabled: settings.firebaseEnabled,
      smtpEnabled: settings.smtpEnabled,
    }));
    return true;
  }

  if (pathname === "/api/admin/problems" && request.method === "GET") {
    const user = currentUser(request, response);
    if (!user || !isAdmin(user)) {
      jsonError(response, user ? 403 : 401, "Only the administrator can edit problems.");
      return true;
    }
    const summaries = problems.map((problem) => ({
      id: problem.id,
      module: problem.module,
      group: problem.group,
      code: problem.code,
      title: problem.title,
      points: problem.points,
      testcaseCount: problem.testcaseCount,
    }));
    send(response, 200, JSON.stringify(summaries));
    return true;
  }

  const adminProblemEditRoute = pathname.match(/^\/api\/admin\/problems\/(.+)$/);
  if (adminProblemEditRoute && request.method === "GET") {
    const user = currentUser(request, response);
    if (!user || !isAdmin(user)) {
      jsonError(response, user ? 403 : 401, "Only the administrator can edit problems.");
      return true;
    }
    let problemId;
    try {
      problemId = decodeURIComponent(adminProblemEditRoute[1]);
    } catch {
      jsonError(response, 400, "Invalid problem ID.");
      return true;
    }
    const problem = problems.find((item) => item.id === problemId);
    if (!problem) {
      jsonError(response, 404, "Problem not found.");
      return true;
    }
    const override = database.prepare(
      "SELECT testcases_json, statement_text FROM problem_overrides WHERE problem_id = ?"
    ).get(problemId);
    const custom = problem.custom
      ? database.prepare("SELECT testcases_json, statement FROM admin_problems WHERE id = ?").get(problemId)
      : null;
    const testcases = custom
      ? JSON.parse(custom.testcases_json)
      : override?.testcases_json
        ? JSON.parse(override.testcases_json)
        : listTestCases(testcaseFolderForProblem(problem)).map((testCase) => ({
          input: fs.readFileSync(testCase.input, "utf8"),
          output: fs.readFileSync(testCase.answer, "utf8"),
          sample: testCase.input.includes(`${path.sep}sample${path.sep}`),
        }));
    send(response, 200, JSON.stringify({
      id: problem.id,
      module: problem.module,
      group: problem.group,
      code: problem.code,
      title: problem.title,
      points: problem.points,
      statement: custom?.statement ?? override?.statement_text ?? problem.statementText ?? "",
      testcases,
    }));
    return true;
  }

  if (pathname === "/api/auth/me" && request.method === "GET") {
    const user = currentUser(request, response);
    const authConfig = publicAuthConfig();
    if (!user) {
      send(response, 200, JSON.stringify({ user: null, progress: {}, authConfig }));
      return true;
    }
    send(response, 200, JSON.stringify({
      user: { id: user.id, username: user.username, isAdmin: isAdmin(user) },
      progress: userProgressMap(user.id),
      authConfig,
    }));
    return true;
  }

  const avatarRoute = pathname.match(/^\/api\/users\/(\d+)\/avatar$/);
  if (avatarRoute && (request.method === "GET" || request.method === "HEAD")) {
    const userId = Number(avatarRoute[1]);
    const avatar = Number.isSafeInteger(userId) && userId > 0
      ? database.prepare("SELECT avatar_mime_type AS content_type, avatar_data AS data FROM users WHERE id = ?").get(userId)
      : null;
    if (!avatar?.data || !avatar.content_type) {
      jsonError(response, 404, "Profile picture not found.");
      return true;
    }
    response.writeHead(200, {
      "Content-Type": avatar.content_type,
      "Content-Length": avatar.data.byteLength,
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : Buffer.from(avatar.data));
    return true;
  }

  if (pathname === "/api/friends" && request.method === "GET") {
    const user = currentUser(request, response);
    if (!user) {
      jsonError(response, 401, "Log in to view your friends.");
      return true;
    }
    send(response, 200, JSON.stringify(getFriendOverview(user.id)));
    return true;
  }

  const publicProfileRoute = pathname.match(/^\/api\/users\/(\d+)$/);
  if (publicProfileRoute && request.method === "GET") {
    const userId = Number(publicProfileRoute[1]);
    const profile = Number.isSafeInteger(userId) && userId > 0
      ? database.prepare("SELECT id, username, created_at FROM users WHERE id = ?").get(userId)
      : null;
    if (!profile) {
      jsonError(response, 404, "User profile not found.");
      return true;
    }
    const viewer = currentUser(request, response);
    const avatar = database.prepare("SELECT avatar_mime_type FROM users WHERE id = ?").get(userId);
    const solvedProblemIds = new Set(database.prepare(
      "SELECT problem_id FROM user_problem_points WHERE user_id = ?"
    ).all(userId).map((row) => row.problem_id));
    const collections = new Map();
    for (const problem of problems) {
      const collectionName = `${problem.module} / ${problem.group}`;
      const collection = collections.get(collectionName) || { name: collectionName, solved: 0, total: 0 };
      collection.total += 1;
      if (solvedProblemIds.has(problem.id)) collection.solved += 1;
      collections.set(collectionName, collection);
    }
    const stats = database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM user_problem_points WHERE user_id = ?) AS solved_count,
        (SELECT COUNT(*) FROM submissions WHERE user_id = ?) AS submission_count,
        (SELECT COALESCE(SUM(points), 0) FROM user_problem_points WHERE user_id = ?) AS points,
        (SELECT COUNT(*) FROM forum_threads WHERE user_id = ?) +
          (SELECT COUNT(*) FROM forum_replies WHERE user_id = ?) AS forum_post_count
    `).get(userId, userId, userId, userId, userId);
    const history = database.prepare(`
      SELECT s.id, s.problem_id, s.language, s.verdict, s.passed, s.total, s.elapsed_ms, s.created_at,
        COALESCE(p.points, 0) AS points_earned
      FROM submissions s
      LEFT JOIN user_problem_points p ON p.submission_id = s.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT 100
    `).all(userId).map((submission) => {
      const problem = problems.find((item) => item.id === submission.problem_id);
      return {
        id: submission.id,
        problemId: submission.problem_id,
        code: problem?.code || submission.problem_id,
        title: problem?.title || submission.problem_id,
        language: submission.language,
        verdict: submission.verdict,
        passed: submission.passed,
        total: submission.total,
        elapsedMs: submission.elapsed_ms,
        pointsEarned: submission.points_earned,
        createdAt: submission.created_at,
      };
    });
    send(response, 200, JSON.stringify({
      id: profile.id,
      username: profile.username,
      createdAt: profile.created_at,
      isAdmin: isAdmin({ id: profile.id }),
      avatarUrl: avatar.avatar_mime_type ? `/api/users/${profile.id}/avatar` : null,
      friendCount: getFriendCount(profile.id),
      friendship: viewer ? getFriendshipStatus(viewer.id, profile.id) : "guest",
      ...stats,
      collections: [...collections.values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      ),
      submissions: history,
    }));
    return true;
  }

  if (pathname === "/api/account" && request.method === "GET") {
    const user = currentUser(request, response);
    if (!user) {
      jsonError(response, 401, "Log in to view your account information.");
      return true;
    }
    const details = database.prepare(`
    SELECT u.username, u.email, u.firebase_uid, u.created_at, u.avatar_mime_type,
      (SELECT COUNT(*) FROM user_progress p WHERE p.user_id = u.id AND p.state = 'solved') AS solved_count,
      (SELECT COUNT(*) FROM submissions s WHERE s.user_id = u.id) AS submission_count,
      (SELECT COUNT(*) FROM forum_threads t WHERE t.user_id = u.id) +
        (SELECT COUNT(*) FROM forum_replies r WHERE r.user_id = u.id) AS forum_post_count
    FROM users u WHERE u.id = ?
    `).get(user.id);
    send(response, 200, JSON.stringify({
      username: details.username,
      email: details.email || null,
      hasGoogle: Boolean(details.firebase_uid),
      created_at: details.created_at,
      solved_count: details.solved_count,
      submission_count: details.submission_count,
      forum_post_count: details.forum_post_count,
      avatarUrl: details.avatar_mime_type ? `/api/users/${user.id}/avatar` : null,
      isAdmin: isAdmin(user),
    }));
    return true;
  }

  if (isWriteRoute && !isSameOriginRequest(request)) {
    jsonError(response, 403, "Cross-origin requests are not allowed.");
    return true;
  }

  if (isDelete) {
    const user = currentUser(request, response);
    if (!user) {
      jsonError(response, 401, "Log in to perform this action.");
      return true;
    }
    if (pathname === "/api/account/avatar") {
      database.prepare("UPDATE users SET avatar_mime_type = NULL, avatar_data = NULL WHERE id = ?").run(user.id);
      send(response, 200, JSON.stringify({ ok: true }));
      return true;
    }
    if (!isAdmin(user)) {
      jsonError(response, 403, "Only the administrator can remove forum posts.");
      return true;
    }
    const postRoute = pathname.match(/^\/api\/forum\/(threads|replies)\/(\d+)$/);
    const postId = Number(postRoute?.[2]);
    if (!postRoute || !Number.isSafeInteger(postId) || postId < 1) {
      jsonError(response, 404, "Forum post not found.");
      return true;
    }
    const table = postRoute[1] === "threads" ? "forum_threads" : "forum_replies";
    const deleted = database.prepare(`DELETE FROM ${table} WHERE id = ?`).run(postId);
    if (!deleted.changes) {
      jsonError(response, 404, "Forum post not found.");
      return true;
    }
    send(response, 200, JSON.stringify({ ok: true }));
    return true;
  }

  if (isPost && (pathname.startsWith("/api/auth/") || pathname === "/api/progress" ||
    pathname === "/api/ratings" || pathname === "/api/friends" ||
    pathname === "/api/account/avatar" || pathname === "/api/account/email" ||
    pathname === "/api/admin/problems" || pathname === "/api/admin/problems/update" ||
    pathname === "/api/admin/auth-settings" ||
    pathname === "/api/forum/threads" || /^\/api\/forum\/threads\/\d+\/replies$/.test(pathname))) {
    if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json") {
      jsonError(response, 415, "Send request data as application/json.");
      return true;
    }
    const maxBytes = pathname === "/api/admin/problems" || pathname === "/api/admin/problems/update"
      ? MAX_ADMIN_REQUEST_BYTES
      : pathname === "/api/account/avatar"
        ? MAX_AVATAR_REQUEST_BYTES
      : pathname.startsWith("/api/forum/")
        ? MAX_FORUM_REQUEST_BYTES
      : 1024 * 1024;
    let body;
    try {
      body = await readJsonBody(request, maxBytes);
    } catch (error) {
      jsonError(response, error.statusCode || 400, error.message);
      return true;
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      jsonError(response, 400, "Request data must be a JSON object.");
      return true;
    }

    if (pathname === "/api/auth/register" || pathname === "/api/auth/login" ||
        pathname === "/api/auth/login/verify" || pathname === "/api/auth/firebase") {
      const rateKey = typeof body.username === "string"
        ? body.username.toLocaleLowerCase("en-US")
        : typeof body.challengeToken === "string"
          ? body.challengeToken.slice(0, 16)
          : "firebase";
      if (authRateLimit(request, response, rateKey)) return true;
    }

    if (pathname === "/api/auth/register") {
      if (typeof body.username !== "string" || !/^[A-Za-z0-9_]{3,24}$/.test(body.username)) {
        jsonError(response, 400, "Username must be 3 to 24 letters, numbers, or underscores.");
        return true;
      }
      if (!validEmail(body.email)) {
        jsonError(response, 400, "Enter a valid email address for login confirmation.");
        return true;
      }
      if (typeof body.password !== "string" || body.password.length < 10 || body.password.length > 128 ||
          Buffer.byteLength(body.password, "utf8") > 512) {
        jsonError(response, 400, "Password must be 10 to 128 characters.");
        return true;
      }
      const username = body.username;
      const usernameKey = username.toLocaleLowerCase("en-US");
      const email = body.email.trim();
      const emailKey = email.toLocaleLowerCase("en-US");
      if (usernameKey === ADMIN_USERNAME) {
        jsonError(response, 409, "That username is reserved for the site administrator.");
        return true;
      }
      if (database.prepare("SELECT 1 FROM users WHERE email_key = ?").get(emailKey)) {
        jsonError(response, 409, "An account with that email address already exists.");
        return true;
      }
      const salt = crypto.randomBytes(16);
      const passwordHash = await hashPassword(body.password, salt);
      try {
        const inserted = database.prepare(
          "INSERT INTO users (username, username_key, email, email_key, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(username, usernameKey, email, emailKey, salt.toString("hex"), passwordHash.toString("hex"), new Date().toISOString());
        const user = { id: Number(inserted.lastInsertRowid), username };
        createSession(response, user);
        send(response, 201, JSON.stringify({
          user: { id: user.id, username, isAdmin: isAdmin(user) },
          progress: {},
          authConfig: publicAuthConfig(),
        }));
      } catch (error) {
        if (error.errcode === 2067 || error.code === "SQLITE_CONSTRAINT_UNIQUE") {
          jsonError(response, 409, "That username or email is already taken.");
        } else {
          throw error;
        }
      }
      return true;
    }

    if (pathname === "/api/auth/login") {
      if (typeof body.username !== "string" || typeof body.password !== "string" ||
          body.username.length > 254 || body.password.length > 128) {
        jsonError(response, 401, "Incorrect username or password.");
        return true;
      }
      const identifierKey = body.username.trim().toLocaleLowerCase("en-US");
      const storedUser = database.prepare(
        "SELECT id, username, email, password_salt, password_hash FROM users WHERE username_key = ? OR email_key = ?"
      ).get(identifierKey, identifierKey);
      const salt = storedUser ? Buffer.from(storedUser.password_salt, "hex") : Buffer.alloc(16);
      const expected = storedUser ? Buffer.from(storedUser.password_hash, "hex") : Buffer.alloc(PASSWORD_KEY_LENGTH);
      const actual = await hashPassword(body.password, salt);
      if (!crypto.timingSafeEqual(actual, expected) || !storedUser) {
        jsonError(response, 401, "Incorrect username or password.");
        return true;
      }

      const settings = getAuthSettings();
      if (storedUser.email && settings.requireEmailConfirmation) {
        if (settings.smtpEnabled) {
          const code = String(crypto.randomInt(100000, 1000000));
          const challengeToken = crypto.randomBytes(32).toString("hex");
          const tokenHash = crypto.createHash("sha256").update(challengeToken).digest("hex");
          const codeHash = crypto.createHash("sha256").update(code).digest("hex");
          const expiresAt = Date.now() + LOGIN_CHALLENGE_LIFETIME;
          try {
            await sendLoginCodeEmail(settings, storedUser.email, storedUser.username, code);
          } catch (error) {
            console.error("Failed to send login confirmation email:", error);
            jsonError(response, 502, "Could not send the login confirmation email. Check the server SMTP settings.");
            return true;
          }
          database.prepare("DELETE FROM login_challenges WHERE user_id = ?").run(storedUser.id);
          database.prepare(`
            INSERT INTO login_challenges (token_hash, user_id, code_hash, email, method, attempts, expires_at, created_at)
            VALUES (?, ?, ?, ?, 'code', 0, ?, ?)
          `).run(tokenHash, storedUser.id, codeHash, storedUser.email, expiresAt, new Date().toISOString());
          send(response, 200, JSON.stringify({
            confirmationRequired: true,
            method: "code",
            challengeToken,
            maskedEmail: maskEmail(storedUser.email),
          }));
          return true;
        }
        if (settings.firebaseEnabled) {
          const challengeToken = crypto.randomBytes(32).toString("hex");
          const tokenHash = crypto.createHash("sha256").update(challengeToken).digest("hex");
          const expiresAt = Date.now() + LOGIN_CHALLENGE_LIFETIME;
          database.prepare("DELETE FROM login_challenges WHERE user_id = ?").run(storedUser.id);
          database.prepare(`
            INSERT INTO login_challenges (token_hash, user_id, code_hash, email, method, attempts, expires_at, created_at)
            VALUES (?, ?, '', ?, 'firebase_link', 0, ?, ?)
          `).run(tokenHash, storedUser.id, storedUser.email, expiresAt, new Date().toISOString());
          send(response, 200, JSON.stringify({
            confirmationRequired: true,
            method: "firebase",
            challengeToken,
            email: storedUser.email,
            maskedEmail: maskEmail(storedUser.email),
          }));
          return true;
        }
      }

      const user = { id: storedUser.id, username: storedUser.username };
      createSession(response, user);
      send(response, 200, JSON.stringify({
        user: { id: user.id, username: user.username, isAdmin: isAdmin(user) },
        progress: userProgressMap(user.id),
        authConfig: publicAuthConfig(),
      }));
      return true;
    }

    if (pathname === "/api/auth/login/verify") {
      if (typeof body.challengeToken !== "string" || !TOKEN_PATTERN.test(body.challengeToken)) {
        jsonError(response, 400, "Invalid or expired login confirmation session. Please log in again.");
        return true;
      }
      const tokenHash = crypto.createHash("sha256").update(body.challengeToken).digest("hex");
      const challenge = database.prepare(
        "SELECT token_hash, user_id, code_hash, email, method, attempts, expires_at FROM login_challenges WHERE token_hash = ?"
      ).get(tokenHash);
      if (!challenge || challenge.expires_at <= Date.now()) {
        if (challenge) database.prepare("DELETE FROM login_challenges WHERE token_hash = ?").run(tokenHash);
        jsonError(response, 401, "That login confirmation code has expired. Please log in again.");
        return true;
      }
      if (challenge.attempts >= 5) {
        database.prepare("DELETE FROM login_challenges WHERE token_hash = ?").run(tokenHash);
        jsonError(response, 429, "Too many incorrect confirmation attempts. Please log in again.");
        return true;
      }

      if (challenge.method === "code") {
        const code = typeof body.code === "string" ? body.code.trim() : "";
        if (!/^\d{6}$/.test(code)) {
          jsonError(response, 400, "Enter the 6-digit confirmation code from your email.");
          return true;
        }
        const actualHash = Buffer.from(crypto.createHash("sha256").update(code).digest("hex"), "hex");
        const expectedHash = Buffer.from(challenge.code_hash, "hex");
        if (actualHash.length !== expectedHash.length || !crypto.timingSafeEqual(actualHash, expectedHash)) {
          database.prepare("UPDATE login_challenges SET attempts = attempts + 1 WHERE token_hash = ?").run(tokenHash);
          jsonError(response, 401, "Incorrect confirmation code.");
          return true;
        }
      } else if (challenge.method === "firebase_link") {
        const settings = getAuthSettings();
        let verified;
        try {
          verified = await verifyFirebaseIdToken(body.firebaseIdToken, settings);
        } catch (error) {
          database.prepare("UPDATE login_challenges SET attempts = attempts + 1 WHERE token_hash = ?").run(tokenHash);
          jsonError(response, error.statusCode || 401, error.message);
          return true;
        }
        if (!verified.emailVerified || verified.email.toLocaleLowerCase("en-US") !== challenge.email.toLocaleLowerCase("en-US")) {
          database.prepare("UPDATE login_challenges SET attempts = attempts + 1 WHERE token_hash = ?").run(tokenHash);
          jsonError(response, 401, "The confirmed Firebase email does not match this account.");
          return true;
        }
      }

      database.prepare("DELETE FROM login_challenges WHERE token_hash = ?").run(tokenHash);
      const storedUser = database.prepare("SELECT id, username FROM users WHERE id = ?").get(challenge.user_id);
      if (!storedUser) {
        jsonError(response, 404, "Account no longer exists.");
        return true;
      }
      createSession(response, storedUser);
      send(response, 200, JSON.stringify({
        user: { id: storedUser.id, username: storedUser.username, isAdmin: isAdmin(storedUser) },
        progress: userProgressMap(storedUser.id),
        authConfig: publicAuthConfig(),
      }));
      return true;
    }

    if (pathname === "/api/auth/firebase") {
      const settings = getAuthSettings();
      let verified;
      try {
        verified = await verifyFirebaseIdToken(body.idToken, settings);
      } catch (error) {
        jsonError(response, error.statusCode || 401, error.message);
        return true;
      }
      const emailKey = verified.email ? verified.email.toLocaleLowerCase("en-US") : null;
      let existingUser = database.prepare("SELECT id, username, email, firebase_uid FROM users WHERE firebase_uid = ?").get(verified.uid);
      if (!existingUser && emailKey && verified.emailVerified) {
        existingUser = database.prepare("SELECT id, username, email, firebase_uid FROM users WHERE email_key = ?").get(emailKey);
        if (existingUser && !existingUser.firebase_uid) {
          database.prepare("UPDATE users SET firebase_uid = ? WHERE id = ?").run(verified.uid, existingUser.id);
        }
      }
      if (existingUser) {
        if (!existingUser.email && verified.email && emailKey) {
          try {
            database.prepare("UPDATE users SET email = ?, email_key = ? WHERE id = ?")
              .run(verified.email, emailKey, existingUser.id);
          } catch {}
        }
        createSession(response, existingUser);
        send(response, 200, JSON.stringify({
          user: { id: existingUser.id, username: existingUser.username, isAdmin: isAdmin(existingUser) },
          progress: userProgressMap(existingUser.id),
          authConfig: publicAuthConfig(),
        }));
        return true;
      }

      const requestedUsername = typeof body.username === "string" ? body.username.trim() : "";
      if (!requestedUsername) {
        send(response, 200, JSON.stringify({
          needsUsername: true,
          suggestedUsername: suggestAvailableUsername(verified.name || verified.email),
          email: verified.email || null,
        }));
        return true;
      }
      if (!/^[A-Za-z0-9_]{3,24}$/.test(requestedUsername)) {
        jsonError(response, 400, "Username must be 3 to 24 letters, numbers, or underscores.");
        return true;
      }
      const usernameKey = requestedUsername.toLocaleLowerCase("en-US");
      if (usernameKey === ADMIN_USERNAME) {
        jsonError(response, 409, "That username is reserved for the site administrator.");
        return true;
      }
      const salt = crypto.randomBytes(16);
      const randomPasswordHash = await hashPassword(crypto.randomBytes(32).toString("hex"), salt);
      try {
        const inserted = database.prepare(`
          INSERT INTO users (username, username_key, email, email_key, firebase_uid, password_salt, password_hash, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          requestedUsername,
          usernameKey,
          verified.email || null,
          emailKey,
          verified.uid,
          salt.toString("hex"),
          randomPasswordHash.toString("hex"),
          new Date().toISOString()
        );
        const user = { id: Number(inserted.lastInsertRowid), username: requestedUsername };
        createSession(response, user);
        send(response, 201, JSON.stringify({
          user: { id: user.id, username: user.username, isAdmin: isAdmin(user) },
          progress: {},
          authConfig: publicAuthConfig(),
        }));
      } catch (error) {
        if (error.errcode === 2067 || error.code === "SQLITE_CONSTRAINT_UNIQUE") {
          jsonError(response, 409, "That username or email is already linked to another account.");
        } else {
          throw error;
        }
      }
      return true;
    }

    if (pathname === "/api/auth/logout") {
      clearSession(request, response);
      send(response, 200, JSON.stringify({ user: null }));
      return true;
    }

    const user = currentUser(request, response);
    if (!user) {
      jsonError(response, 401, "Log in to perform this action.");
      return true;
    }

    if (pathname === "/api/account/email") {
      if (body.idToken) {
        const settings = getAuthSettings();
        let verified;
        try {
          verified = await verifyFirebaseIdToken(body.idToken, settings);
        } catch (error) {
          jsonError(response, error.statusCode || 401, error.message);
          return true;
        }
        const emailKey = verified.email ? verified.email.toLocaleLowerCase("en-US") : null;
        try {
          database.prepare("UPDATE users SET firebase_uid = ?, email = COALESCE(?, email), email_key = COALESCE(?, email_key) WHERE id = ?")
            .run(verified.uid, verified.email || null, emailKey, user.id);
        } catch (error) {
          if (error.errcode === 2067 || error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            jsonError(response, 409, "That Google account or email is already linked to another user.");
            return true;
          }
          throw error;
        }
        send(response, 200, JSON.stringify({ ok: true, email: verified.email || null, hasGoogle: true }));
        return true;
      }
      if (!validEmail(body.email)) {
        jsonError(response, 400, "Enter a valid email address.");
        return true;
      }
      const email = body.email.trim();
      const emailKey = email.toLocaleLowerCase("en-US");
      try {
        database.prepare("UPDATE users SET email = ?, email_key = ? WHERE id = ?").run(email, emailKey, user.id);
      } catch (error) {
        if (error.errcode === 2067 || error.code === "SQLITE_CONSTRAINT_UNIQUE") {
          jsonError(response, 409, "That email address is already used by another account.");
          return true;
        }
        throw error;
      }
      send(response, 200, JSON.stringify({ ok: true, email }));
      return true;
    }

    if (pathname === "/api/admin/auth-settings") {
      if (!isAdmin(user)) {
        jsonError(response, 403, "Only the administrator can update authentication settings.");
        return true;
      }
      const updates = {
        firebaseApiKey: typeof body.firebaseApiKey === "string" ? body.firebaseApiKey.trim() : "",
        firebaseAuthDomain: typeof body.firebaseAuthDomain === "string" ? body.firebaseAuthDomain.trim() : "",
        firebaseProjectId: typeof body.firebaseProjectId === "string" ? body.firebaseProjectId.trim() : "",
        firebaseAppId: typeof body.firebaseAppId === "string" ? body.firebaseAppId.trim() : "",
        smtpHost: typeof body.smtpHost === "string" ? body.smtpHost.trim() : "",
        smtpPort: String(Number(body.smtpPort) || 465),
        smtpUser: typeof body.smtpUser === "string" ? body.smtpUser.trim() : "",
        smtpFrom: typeof body.smtpFrom === "string" ? body.smtpFrom.trim() : "",
        requireEmailConfirmation: body.requireEmailConfirmation === false ? "false" : "true",
      };
      if (typeof body.smtpPass === "string" && body.smtpPass.length > 0) {
        updates.smtpPass = body.smtpPass;
      } else if (body.clearSmtpPass === true) {
        updates.smtpPass = "";
      }
      saveAuthSettings(updates);
      const saved = getAuthSettings();
      if (typeof body.testEmail === "string" && body.testEmail.trim()) {
        if (!saved.smtpEnabled) {
          jsonError(response, 400, "Settings saved, but SMTP host, username, and password are required to send a test email.");
          return true;
        }
        try {
          await sendLoginCodeEmail(saved, body.testEmail.trim(), user.username, "123456");
        } catch (error) {
          jsonError(response, 502, `Settings saved, but test email failed: ${error.message}`);
          return true;
        }
      }
      send(response, 200, JSON.stringify({
        ok: true,
        authConfig: publicAuthConfig(),
      }));
      return true;
    }

    if (pathname === "/api/account/avatar") {
      let image;
      try {
        [image] = validateForumImages([body]);
      } catch (error) {
        jsonError(response, error.statusCode || 400, error.message);
        return true;
      }
      database.prepare("UPDATE users SET avatar_mime_type = ?, avatar_data = ? WHERE id = ?")
        .run(image.type, image.data, user.id);
      send(response, 200, JSON.stringify({ ok: true, avatarUrl: `/api/users/${user.id}/avatar` }));
      return true;
    }

    if (pathname === "/api/friends") {
      if (!Number.isSafeInteger(body.userId) || body.userId < 1 ||
          !["request", "accept", "decline", "cancel", "remove"].includes(body.action)) {
        jsonError(response, 400, "Choose a valid user and friend action.");
        return true;
      }
      if (body.userId === user.id) {
        jsonError(response, 400, "You cannot send a friend request to yourself.");
        return true;
      }
      const target = database.prepare("SELECT id FROM users WHERE id = ?").get(body.userId);
      if (!target) {
        jsonError(response, 404, "That account could not be found.");
        return true;
      }
      const now = new Date().toISOString();
      if (body.action === "request") {
        const status = getFriendshipStatus(user.id, body.userId);
        if (status === "friends") {
          jsonError(response, 409, "You are already friends.");
          return true;
        }
        if (status === "request_sent") {
          jsonError(response, 409, "You already sent this person a friend request.");
          return true;
        }
        if (status === "request_received") {
          jsonError(response, 409, "This person already sent you a request. Accept it from your account page.");
          return true;
        }
        database.prepare(`
          INSERT INTO friendships (requester_id, addressee_id, status, created_at, updated_at)
          VALUES (?, ?, 'pending', ?, ?)
        `).run(user.id, body.userId, now, now);
      } else if (body.action === "accept") {
        const updated = database.prepare(`
          UPDATE friendships SET status = 'accepted', updated_at = ?
          WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'
        `).run(now, body.userId, user.id);
        if (!updated.changes) {
          jsonError(response, 409, "That incoming friend request is no longer available.");
          return true;
        }
      } else if (body.action === "decline") {
        const deleted = database.prepare(`
          DELETE FROM friendships
          WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'
        `).run(body.userId, user.id);
        if (!deleted.changes) {
          jsonError(response, 409, "That incoming friend request is no longer available.");
          return true;
        }
      } else if (body.action === "cancel") {
        const deleted = database.prepare(`
          DELETE FROM friendships
          WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'
        `).run(user.id, body.userId);
        if (!deleted.changes) {
          jsonError(response, 409, "That outgoing friend request is no longer available.");
          return true;
        }
      } else {
        const deleted = database.prepare(`
          DELETE FROM friendships
          WHERE status = 'accepted'
            AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
        `).run(user.id, body.userId, body.userId, user.id);
        if (!deleted.changes) {
          jsonError(response, 409, "You are no longer friends with that account.");
          return true;
        }
      }
      send(response, 200, JSON.stringify({ ok: true, friendship: getFriendshipStatus(user.id, body.userId) }));
      return true;
    }

    if (pathname === "/api/progress") {
      if (typeof body.problemId !== "string" || !problems.some((problem) => problem.id === body.problemId) ||
          ![null, "todo", "solved"].includes(body.state)) {
        jsonError(response, 400, "Choose a valid problem and progress state.");
        return true;
      }
      if (body.state === null) {
        database.prepare("DELETE FROM user_progress WHERE user_id = ? AND problem_id = ?").run(user.id, body.problemId);
      } else {
        database.prepare(`
          INSERT INTO user_progress (user_id, problem_id, state, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(user_id, problem_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at
        `).run(user.id, body.problemId, body.state, new Date().toISOString());
      }
      send(response, 200, JSON.stringify({ ok: true }));
      return true;
    }

    if (pathname === "/api/ratings") {
      if (typeof body.problemId !== "string" || !problems.some((problem) => problem.id === body.problemId) ||
          !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
        jsonError(response, 400, "Choose a valid problem and a rating from 1 to 5.");
        return true;
      }
      database.prepare(`
        INSERT INTO problem_ratings (user_id, problem_id, rating, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, problem_id) DO UPDATE SET rating = excluded.rating, updated_at = excluded.updated_at
      `).run(user.id, body.problemId, body.rating, new Date().toISOString());
      const summary = database.prepare(
        "SELECT AVG(rating) AS average, COUNT(*) AS count FROM problem_ratings WHERE problem_id = ?"
      ).get(body.problemId);
      send(response, 200, JSON.stringify({
        average: Number(summary.average),
        count: summary.count,
        myRating: body.rating,
      }));
      return true;
    }

    if (pathname === "/api/admin/problems/update") {
      if (!isAdmin(user)) {
        jsonError(response, 403, "Only the administrator can edit problems.");
        return true;
      }
      if (typeof body.problemId !== "string" ||
          typeof body.module !== "string" || !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(body.module.trim()) ||
          typeof body.group !== "string" || !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(body.group.trim()) ||
          typeof body.code !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/.test(body.code.trim()) ||
          !validForumText(body.title, 120) ||
          typeof body.statement !== "string" || Buffer.byteLength(body.statement, "utf8") > 80_000 ||
          !Number.isInteger(body.points) || body.points < 0 || body.points > 1000) {
        jsonError(response, 400, "Enter a valid collection, group, problem code, title, statement, and point value from 0 to 1000.");
        return true;
      }
      const problem = problems.find((item) => item.id === body.problemId);
      if (!problem) {
        jsonError(response, 404, "Problem not found.");
        return true;
      }
      const testcaseError = validateProblemCases(body.testcases, true);
      if (testcaseError) {
        jsonError(response, 400, testcaseError);
        return true;
      }
      const module = body.module.trim();
      const group = body.group.trim();
      const code = body.code.trim();
      const title = body.title.trim();
      if (problems.some((item) => item.id !== problem.id &&
          item.module.toLocaleLowerCase("en-US") === module.toLocaleLowerCase("en-US") &&
          item.code.toLocaleLowerCase("en-US") === code.toLocaleLowerCase("en-US"))) {
        jsonError(response, 409, "Another problem in this collection already uses that code.");
        return true;
      }
      const testcases = body.testcases.map((testCase) => ({
        input: testCase.input,
        output: testCase.output,
        sample: testCase.sample === true,
      }));
      const now = new Date().toISOString();
      if (problem.custom) {
        try {
          database.prepare(`
            UPDATE admin_problems
            SET module = ?, group_name = ?, code = ?, title = ?, statement = ?, testcases_json = ?, points = ?
            WHERE id = ?
          `).run(module, group, code, title, body.statement.trim(), JSON.stringify(testcases), body.points, problem.id);
        } catch (error) {
          if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            jsonError(response, 409, "Another problem in this collection already uses that code.");
            return true;
          }
          throw error;
        }
      } else {
        database.prepare(`
          INSERT INTO problem_overrides (
            problem_id, module, code, title, group_name, points, statement_text, testcases_json, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(problem_id) DO UPDATE SET
            module = excluded.module,
            code = excluded.code,
            title = excluded.title,
            group_name = excluded.group_name,
            points = excluded.points,
            statement_text = excluded.statement_text,
            testcases_json = excluded.testcases_json,
            updated_at = excluded.updated_at
        `).run(problem.id, module, code, title, group, body.points,
          body.statement.trim(), JSON.stringify(testcases), now);
      }
      problems = loadProblems().sort((a, b) =>
        a.module.localeCompare(b.module, undefined, { numeric: true }) ||
        a.id.localeCompare(b.id, undefined, { numeric: true })
      );
      send(response, 200, JSON.stringify({ ok: true, id: problem.id }));
      return true;
    }

    if (pathname === "/api/admin/problems") {
      if (!isAdmin(user)) {
        jsonError(response, 403, "Only the administrator can add problems.");
        return true;
      }
      if (typeof body.module !== "string" || !/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(body.module.trim()) ||
          typeof body.code !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/.test(body.code.trim()) ||
          !validForumText(body.title, 120) ||
          (body.statement !== undefined && typeof body.statement !== "string") ||
          (typeof body.statement === "string" && Buffer.byteLength(body.statement, "utf8") > 80_000) ||
          !Number.isInteger(body.points) || body.points < 50 || body.points > 1000) {
        jsonError(response, 400, "Enter a collection, problem code, title, and point value from 50 to 1000.");
        return true;
      }
      let uploads;
      try {
        uploads = validateAdminProblemUploads(body);
      } catch (error) {
        jsonError(response, error.statusCode || 400, error.message);
        return true;
      }
      const statement = typeof body.statement === "string" ? body.statement.trim() : "";
      if (statement && !validForumText(statement, 20_000)) {
        jsonError(response, 400, "The text statement must be no longer than 20,000 characters.");
        return true;
      }
      if (!statement && !uploads.statementPdf) {
        jsonError(response, 400, "Add a text statement or upload a PDF statement.");
        return true;
      }
      const testcaseError = validateProblemCases(body.testcases);
      if (testcaseError) {
        jsonError(response, 400, testcaseError);
        return true;
      }
      const module = body.module.trim();
      const code = body.code.trim();
      const title = body.title.trim();
      const id = `classroom/${module}/${code}`;
      if (problems.some((problem) => problem.id.toLocaleLowerCase("en-US") === id.toLocaleLowerCase("en-US"))) {
        jsonError(response, 409, "A problem with this collection and code already exists.");
        return true;
      }
      const testcases = body.testcases.map((testCase) => ({
        input: testCase.input,
        output: testCase.output,
        sample: testCase.sample === true,
      }));
      database.prepare(`
        INSERT INTO admin_problems (
          id, module, code, title, statement, testcases_json, points, statement_pdf,
          image_mime_type, image_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, module, code, title, statement, JSON.stringify(testcases), body.points,
        uploads.statementPdf, uploads.image?.type || null, uploads.image?.data || null, new Date().toISOString());
      problems = loadProblems().sort((a, b) =>
        a.module.localeCompare(b.module, undefined, { numeric: true }) ||
        a.id.localeCompare(b.id, undefined, { numeric: true })
      );
      send(response, 201, JSON.stringify({ id }));
      return true;
    }

    if (pathname === "/api/forum/threads") {
      const categories = ["General", "Problem Help", "C Programming", "Study Group"];
      if (!categories.includes(body.category) || !validForumText(body.title, 120) || !validForumText(body.body, 8000)) {
        jsonError(response, 400, "Choose a forum category and enter a title (up to 120 characters) and message (up to 8,000 characters).");
        return true;
      }
      let images;
      try {
        images = validateForumImages(body.images);
      } catch (error) {
        jsonError(response, error.statusCode || 400, error.message);
        return true;
      }
      database.exec("BEGIN");
      try {
        const inserted = database.prepare(
          "INSERT INTO forum_threads (user_id, title, category, body, created_at) VALUES (?, ?, ?, ?, ?)"
        ).run(user.id, body.title.trim(), body.category, body.body.trim(), new Date().toISOString());
        const threadId = Number(inserted.lastInsertRowid);
        insertForumImages(images, "thread_id", threadId);
        database.exec("COMMIT");
        send(response, 201, JSON.stringify({ id: threadId }));
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
      return true;
    }

    const replyRoute = pathname.match(/^\/api\/forum\/threads\/(\d+)\/replies$/);
    if (replyRoute) {
      const threadId = Number(replyRoute[1]);
      if (!Number.isSafeInteger(threadId) || !database.prepare("SELECT id FROM forum_threads WHERE id = ?").get(threadId)) {
        jsonError(response, 404, "Forum topic not found.");
        return true;
      }
      if (!validForumText(body.body, 4000)) {
        jsonError(response, 400, "Reply must contain up to 4,000 characters.");
        return true;
      }
      let images;
      try {
        images = validateForumImages(body.images);
      } catch (error) {
        jsonError(response, error.statusCode || 400, error.message);
        return true;
      }
      database.exec("BEGIN");
      try {
        const inserted = database.prepare(
          "INSERT INTO forum_replies (thread_id, user_id, body, created_at) VALUES (?, ?, ?, ?)"
        ).run(threadId, user.id, body.body.trim(), new Date().toISOString());
        insertForumImages(images, "reply_id", Number(inserted.lastInsertRowid));
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
      send(response, 201, JSON.stringify({ ok: true }));
      return true;
    }
  }

  if (pathname === "/api/submissions" && request.method === "GET") {
    const user = currentUser(request, response);
    if (!user) {
      jsonError(response, 401, "Log in to view your submission history.");
      return true;
    }
    const rows = database.prepare(`
      SELECT s.id, s.problem_id, s.language, s.verdict, s.passed, s.total, s.elapsed_ms,
        s.tests_json, s.message, s.compiler_output, s.created_at
      FROM submissions s JOIN users u ON u.id = s.user_id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC, s.id DESC LIMIT 100
    `).all(user.id);
    send(response, 200, JSON.stringify(rows.map((row) => {
      const problem = problems.find((item) => item.id === row.problem_id);
      return {
        id: row.id,
        problemId: row.problem_id,
        code: problem?.code || row.problem_id,
        title: problem?.title || row.problem_id,
        language: row.language,
        verdict: row.verdict,
        passed: row.passed,
        total: row.total,
        elapsedMs: row.elapsed_ms,
        tests: JSON.parse(row.tests_json),
        message: row.message,
        compilerOutput: row.compiler_output,
        createdAt: row.created_at,
      };
    })));
    return true;
  }

  if (pathname === "/api/forum/threads" && request.method === "GET") {
    const category = url.searchParams.get("category") || "all";
    const allowedCategories = ["all", "General", "Problem Help", "C Programming", "Study Group"];
    if (!allowedCategories.includes(category)) {
      jsonError(response, 400, "Unknown forum category.");
      return true;
    }
    const user = currentUser(request, response);
    send(response, 200, JSON.stringify(getForumThreads(category, isAdmin(user))));
    return true;
  }

  const imageRoute = pathname.match(/^\/api\/forum\/images\/(\d+)$/);
  if (imageRoute && request.method === "GET") {
    const imageId = Number(imageRoute[1]);
    const image = Number.isSafeInteger(imageId)
      ? database.prepare("SELECT mime_type, image_data FROM forum_images WHERE id = ?").get(imageId)
      : null;
    if (!image) {
      jsonError(response, 404, "Forum image not found.");
      return true;
    }
    response.writeHead(200, {
      "Content-Type": image.mime_type,
      "Content-Length": image.image_data.byteLength,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    });
    response.end(Buffer.from(image.image_data));
    return true;
  }

  const threadRoute = pathname.match(/^\/api\/forum\/threads\/(\d+)$/);
  if (threadRoute && request.method === "GET") {
    const threadId = Number(threadRoute[1]);
    const viewer = currentUser(request, response);
    const thread = database.prepare(`
      SELECT t.id, t.title, t.category, t.body, t.created_at, u.id AS author_id, u.username AS author
      FROM forum_threads t JOIN users u ON u.id = t.user_id WHERE t.id = ?
    `).get(threadId);
    if (!thread) {
      jsonError(response, 404, "Forum topic not found.");
      return true;
    }
    const replies = database.prepare(`
      SELECT r.id, r.body, r.created_at, u.id AS author_id, u.username AS author
      FROM forum_replies r JOIN users u ON u.id = r.user_id
      WHERE r.thread_id = ? ORDER BY r.created_at, r.id
    `).all(threadId);
    send(response, 200, JSON.stringify({
      id: thread.id,
      title: thread.title,
      category: thread.category,
      body: thread.body,
      author: thread.author,
      authorId: thread.author_id,
      canDelete: isAdmin(viewer),
      createdAt: thread.created_at,
      images: listForumImages("thread_id", threadId),
      replies: replies.map((reply) => ({
        id: reply.id,
        body: reply.body,
        author: reply.author,
        authorId: reply.author_id,
        createdAt: reply.created_at,
        canDelete: isAdmin(viewer),
        images: listForumImages("reply_id", reply.id),
      })),
    }));
    return true;
  }

  if (pathname === "/api/forum/me" && request.method === "GET") {
    const user = currentUser(request, response);
    send(response, 200, JSON.stringify({ user: user ? { username: user.username } : null }));
    return true;
  }

  return false;
}

function readJsonBody(request, maxBytes = MAX_REQUEST_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes && !tooLarge) {
        tooLarge = true;
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
      }
      if (!tooLarge) chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function runProcess(command, args, options) {
  return new Promise((resolve) => {
    let child;
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let stopReason = null;
    let settled = false;
    let timer;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, stdout, stderr, stopReason });
    };

    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        windowsHide: true,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      finish({ spawnError: error.message, exitCode: null });
      return;
    }

    timer = setTimeout(() => {
      stopReason = "TIME LIMIT EXCEEDED";
      child.kill();
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      if (stdout.length + chunk.length > options.maxOutputBytes) {
        stopReason = "OUTPUT LIMIT EXCEEDED";
        child.kill();
        return;
      }
      stdout = Buffer.concat([stdout, chunk]);
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < MAX_COMPILER_OUTPUT_BYTES) {
        stderr = Buffer.concat([stderr, chunk.subarray(0, MAX_COMPILER_OUTPUT_BYTES - stderr.length)]);
      }
    });
    child.on("error", (error) => finish({ spawnError: error.message, exitCode: null }));
    child.on("close", (exitCode, signal) => finish({ exitCode, signal }));
    if (options.input !== undefined) {
      child.stdin.on("error", () => {});
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
  });
}

function sandboxArguments(workFolder, jobLabel, writable, command, args, timeoutMs) {
  const mount = `type=bind,source=${workFolder},target=/work${writable ? "" : ",readonly"}`;
  return [
    "create",
    "--interactive",
    "--label", `untitled-judge.job=${jobLabel}`,
    "--network", "none",
    "--read-only",
    "--memory", "512m",
    "--memory-swap", "512m",
    "--cpus", "1",
    "--pids-limit", "32",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges:true",
    "--user", "65534:65534",
    "--tmpfs", "/tmp:rw,exec,nosuid,nodev,size=128m,mode=1777",
    "--ulimit", "core=0",
    "--ulimit", "nofile=64:64",
    "--ulimit", "fsize=67108864:67108864",
    "--mount", mount,
    JUDGE_SANDBOX_IMAGE,
    "timeout", "--signal=TERM", "--kill-after=1s", `${Math.max(1, Math.ceil(timeoutMs / 1000))}s`,
    command,
    ...args,
  ];
}

async function removeSandbox(containerId) {
  const removal = await runProcess(CONTAINER_RUNTIME, ["rm", "--force", containerId], {
    timeoutMs: 10_000,
    maxOutputBytes: MAX_COMPILER_OUTPUT_BYTES,
  });
  if (removal.spawnError || removal.exitCode !== 0) {
    throw new Error(`Could not remove judge sandbox ${containerId}: ${removal.stderr.toString("utf8") || removal.spawnError || "docker rm failed"}`);
  }
}

async function runSandboxCommand(workFolder, command, args, options) {
  const jobLabel = crypto.randomUUID();
  const created = await runProcess(CONTAINER_RUNTIME, sandboxArguments(
    workFolder,
    jobLabel,
    options.writable === true,
    command,
    args,
    options.timeoutMs,
  ), {
    timeoutMs: options.timeoutMs + 10_000,
    maxOutputBytes: MAX_COMPILER_OUTPUT_BYTES,
  });
  if (created.spawnError) return created;
  if (created.stopReason) return created;
  if (created.exitCode !== 0) {
    return { ...created, spawnError: created.stderr.toString("utf8") || "Could not create the judge sandbox." };
  }

  const containerId = created.stdout.toString("ascii").trim();
  if (!/^[a-f0-9]{12,64}$/i.test(containerId)) {
    return { ...created, spawnError: "The sandbox runtime returned an invalid container ID." };
  }

  let execution;
  try {
    execution = await runProcess(CONTAINER_RUNTIME, ["start", "--attach", "--interactive", containerId], {
      input: options.input,
      timeoutMs: options.timeoutMs + 5000,
      maxOutputBytes: options.maxOutputBytes,
    });
  } finally {
    await removeSandbox(containerId);
  }
  if (execution.exitCode === 124) execution.stopReason = "TIME LIMIT EXCEEDED";
  return execution;
}

function normalizeOutput(text) {
  return text.trim().split(/\s+/).filter(Boolean).join(" ");
}

async function judgeSubmission(problem, source, languageId) {
  const language = LANGUAGES[languageId];
  if (!language) return { error: "Choose C17, C++17, or Python 3.", tests: [] };
  const workFolder = await fs.promises.mkdtemp(path.join(os.tmpdir(), "praktikum-"));
  const results = [];
  try {
    await fs.promises.chmod(workFolder, 0o777);
    const sourceFileName = `solution${language.extension}`;
    const sourcePath = `/work/${sourceFileName}`;
    const hostSourcePath = path.join(workFolder, sourceFileName);
    const executablePath = path.join(workFolder, "solution");
    await fs.promises.writeFile(hostSourcePath, source, "utf8");

    await fs.promises.chmod(hostSourcePath, 0o644);
    let runCommand = "python3";
    let runArgs = ["-I", sourcePath];
    if (language.compileArgs) {
      const compilation = await runSandboxCommand(workFolder, language.command, [
        ...language.compileArgs,
        sourcePath,
        ...(language.id === "c" ? ["-lm"] : []),
        "-o",
        "/work/solution",
      ], {
        timeoutMs: COMPILER_TIMEOUT_MS,
        maxOutputBytes: MAX_COMPILER_OUTPUT_BYTES,
        writable: true,
      });

      if (compilation.spawnError) {
        return { error: `Could not start the isolated compiler (${compilation.spawnError}).`, tests: [] };
      }
      if (compilation.stopReason) {
        return { error: `COMPILATION ${compilation.stopReason.toLowerCase()}.`, compilerOutput: compilation.stderr.toString("utf8"), tests: [] };
      }
      if (compilation.exitCode !== 0) {
        return { error: "Compilation failed.", compilerOutput: compilation.stderr.toString("utf8"), tests: [] };
      }
      const executableStat = await fs.promises.stat(executablePath);
      if ((executableStat.mode & 0o111) === 0) {
        throw new Error("The isolated compiler did not create an executable.");
      }
      await fs.promises.chmod(workFolder, 0o755);
      runCommand = "/work/solution";
      runArgs = [];
    } else if (languageId === "python") {
      const syntaxCheck = await runSandboxCommand(workFolder, "python3", [
        "-I",
        "-c",
        "import ast, pathlib, sys; ast.parse(pathlib.Path(sys.argv[1]).read_text())",
        sourcePath,
      ], { timeoutMs: COMPILER_TIMEOUT_MS, maxOutputBytes: MAX_COMPILER_OUTPUT_BYTES });
      if (syntaxCheck.spawnError) {
        return { error: `Could not start isolated Python 3 (${syntaxCheck.spawnError}).`, tests: [] };
      }
      if (syntaxCheck.stopReason || syntaxCheck.exitCode !== 0) {
        return { error: "Compilation failed.", compilerOutput: syntaxCheck.stderr.toString("utf8"), tests: [] };
      }
    }

    const storedProblem = problem.custom
      ? database.prepare("SELECT testcases_json FROM admin_problems WHERE id = ?").get(problem.id)
      : database.prepare("SELECT testcases_json FROM problem_overrides WHERE problem_id = ?").get(problem.id);
    if (problem.custom && !storedProblem) {
      return { error: "This problem is no longer available.", tests: [] };
    }
    const hasStoredTestcases = Boolean(storedProblem?.testcases_json);
    const testCases = hasStoredTestcases
      ? JSON.parse(storedProblem.testcases_json)
      : listTestCases(testcaseFolderForProblem(problem));
    if (!testCases.length) {
      return { error: "No input/answer testcase pairs were found for this problem.", tests: [] };
    }
    const ini = problem.custom ? "" : path.join(ROOT, ...problem.id.split("/"), "domjudge-problem.ini");
    const iniText = ini && fs.existsSync(ini) ? fs.readFileSync(ini, "utf8") : "";
    const limitMatch = iniText.match(/^\s*timelimit\s*=\s*['"]?([\d.]+)/mi);
    const limitSeconds = limitMatch ? Number(limitMatch[1]) : 1;
    const timeoutMs = Math.max(1000, Math.min(5000, Math.ceil(limitSeconds * 1500 + 500)));

    for (let index = 0; index < testCases.length; index += 1) {
      const testCase = testCases[index];
      const input = problem.custom || hasStoredTestcases
        ? Buffer.from(testCase.input, "utf8")
        : await fs.promises.readFile(testCase.input);
      const expected = problem.custom || hasStoredTestcases
        ? testCase.output
        : await fs.promises.readFile(testCase.answer, "utf8");
      const startedAt = process.hrtime.bigint();
      const execution = await runSandboxCommand(workFolder, runCommand, runArgs, {
        cwd: workFolder,
        input,
        timeoutMs,
        maxOutputBytes: MAX_OUTPUT_BYTES,
      });
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      let verdict = "AC";
      if (execution.spawnError) verdict = "RTE";
      else if (execution.stopReason) verdict = execution.stopReason === "TIME LIMIT EXCEEDED" ? "TLE" : "OLE";
      else if (execution.exitCode !== 0) verdict = "RTE";
      else if (normalizeOutput(execution.stdout.toString("utf8")) !== normalizeOutput(expected)) verdict = "WA";

      results.push({ number: index + 1, verdict, elapsedMs: Math.round(elapsedMs) });
    }

    return { language: language.id, languageName: language.name, tests: results, passed: results.filter((result) => result.verdict === "AC").length };
  } finally {
    await fs.promises.rm(workFolder, { recursive: true, force: true });
  }
}

async function drainJudgeQueue() {
  if (judgeWorkerRunning) return;
  judgeWorkerRunning = true;
  try {
    while (judgeQueue.length) {
      const job = judgeQueue.shift();
      if (job.response.destroyed) continue;
      activeJudgeUserId = job.user.id;
      try {
        const result = await judgeSubmission(job.problem, job.source, job.language);
        const submission = persistSubmission(job.user, job.problem, job.language, result);
        if (!job.response.destroyed) send(job.response, 200, JSON.stringify({ ...result, submission }));
      } catch (error) {
        console.error("Queued judge request failed:", error);
        if (!job.response.destroyed && !job.response.headersSent) {
          jsonError(job.response, 500, "The isolated judge failed unexpectedly. Check the server logs.");
        }
      } finally {
        activeJudgeUserId = null;
      }
    }
  } finally {
    judgeWorkerRunning = false;
    if (judgeQueue.length) void drainJudgeQueue();
  }
}

function enqueueSubmission(user, problem, source, language, response) {
  const outstandingForUser = judgeQueue.filter((job) => job.user.id === user.id).length +
    (activeJudgeUserId === user.id ? 1 : 0);
  if (judgeQueue.length >= MAX_QUEUED_SUBMISSIONS) {
    jsonError(response, 429, "The judge queue is full. Please try again shortly.");
    return;
  }
  if (outstandingForUser >= MAX_SUBMISSIONS_PER_USER) {
    jsonError(response, 429, "You already have submissions waiting in the judge queue.");
    return;
  }
  judgeQueue.push({ user, problem, source, language, response });
  void drainJudgeQueue();
}

function isSameOriginRequest(request) {
  const fetchSite = request.headers["sec-fetch-site"];
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsedOrigin = new URL(origin);
    if (PUBLIC_ORIGIN) return parsedOrigin.origin === PUBLIC_ORIGIN;
    return parsedOrigin.host === request.headers.host &&
      (parsedOrigin.protocol === "http:" || parsedOrigin.protocol === "https:");
  } catch {
    return false;
  }
}

function serveFile(request, response, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(response, 404, "Not found", "text/plain; charset=utf-8");
    return;
  }
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension];
  if (!contentType) {
    send(response, 404, "Not found", "text/plain; charset=utf-8");
    return;
  }
  response.writeHead(200, {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  if (!["GET", "HEAD", "POST", "DELETE"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD, POST, DELETE" });
    response.end();
    return;
  }

  let url;
  try {
    url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  } catch {
    jsonError(response, 400, "Invalid request URL");
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    try {
      if (await handleUserApi(request, response, url)) return;
    } catch (error) {
      console.error("Account, progress, or forum request failed:", error);
      if (!response.headersSent && !response.destroyed) {
        jsonError(response, 500, "The local server encountered an error.");
      }
      return;
    }
    if (response.writableEnded) return;
    if (url.pathname === "/api/run" && request.method === "POST") {
        const user = currentUser(request, response);
        if (!user) {
          jsonError(response, 401, "Create an account or log in before submitting code.");
          return;
        }
        if (!isSameOriginRequest(request)) {
          jsonError(response, 403, "Cross-origin code runs are not allowed.");
          return;
        }
        if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json") {
          jsonError(response, 415, "Send the C source and language as application/json.");
          return;
        }
        let body;
        try {
          body = await readJsonBody(request);
        } catch (error) {
          jsonError(response, error.statusCode || 400, error.message || "Could not read request body.");
          return;
        }
        if (!body || typeof body !== "object" || Array.isArray(body) ||
            typeof body.problemId !== "string" || typeof body.source !== "string" ||
            typeof body.language !== "string" || !LANGUAGES[body.language]) {
          jsonError(response, 400, "A problem, supported language, and source code are required.");
          return;
        }
        if (Buffer.byteLength(body.source, "utf8") > MAX_SOURCE_BYTES) {
          jsonError(response, 413, "Source code must be 128 KB or smaller.");
          return;
        }
        const problem = problems.find((item) => item.id === body.problemId);
        if (!problem) {
          jsonError(response, 404, "Problem not found.");
          return;
        }
        if (!problem.testcaseCount) {
          jsonError(response, 400, "This archive problem has no testcases and is available as a read-only statement.");
          return;
        }
        enqueueSubmission(user, problem, body.source, body.language, response);
        return;
    }
    if (request.method === "POST") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }
  }

  if (request.method === "POST") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  if (url.pathname === "/api/problems") {
    const user = currentUser(request, response);
    send(response, 200, JSON.stringify(problems.map((problem) => publicProblem(problem, user))));
    return;
  }

  if (url.pathname.startsWith("/api/problems/")) {
    let id;
    try {
      id = decodeURIComponent(url.pathname.slice("/api/problems/".length));
    } catch {
      send(response, 400, JSON.stringify({ error: "Invalid problem ID" }));
      return;
    }

    const problem = problems.find((item) => item.id === id);
    if (!problem) {
      send(response, 404, JSON.stringify({ error: "Problem not found" }));
      return;
    }

    let samples;
    let statementText = problem.statementText || null;
    if (problem.custom) {
      const stored = database.prepare(
        "SELECT statement, testcases_json, (statement_pdf IS NOT NULL) AS has_pdf FROM admin_problems WHERE id = ?"
      ).get(problem.id);
      if (!stored) {
        send(response, 404, JSON.stringify({ error: "Problem not found" }));
        return;
      }
      statementText = stored.has_pdf ? (stored.statement || null) : stored.statement;
      samples = JSON.parse(stored.testcases_json)
        .filter((testCase) => testCase.sample)
        .map(({ input, output }) => ({ input, output }));
    } else if (problem.testcaseOverride) {
      const override = database.prepare(
        "SELECT testcases_json, statement_text FROM problem_overrides WHERE problem_id = ?"
      ).get(problem.id);
      const testcases = override?.testcases_json ? JSON.parse(override.testcases_json) : [];
      statementText = override?.statement_text || null;
      samples = testcases
        .filter((testCase) => testCase.sample)
        .map(({ input, output }) => ({ input, output }));
    } else {
      const sampleFolder = path.join(testcaseFolderForProblem(problem), "data", "sample");
      samples = fs.existsSync(sampleFolder)
        ? fs.readdirSync(sampleFolder)
        .filter((name) => /\.in$/i.test(name))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((inputName) => {
          const outputName = answerNameForInput(inputName);
          const inputPath = path.join(sampleFolder, inputName);
          const outputPath = path.join(sampleFolder, outputName);
          return {
            input: fs.readFileSync(inputPath, "utf8"),
            output: fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : null,
          };
        })
        : [];
    }

    const user = currentUser(request, response);
    send(response, 200, JSON.stringify({
      ...publicProblem(problem, user),
      statementText,
      statementUrl: problem.archivePdf
        ? `/files/${encodeURI(problem.archivePdf)}`
        : problem.custom && problem.statement
          ? `/api/admin-problem-assets/pdf/${encodeURIComponent(problem.id)}`
          : problem.statement
            ? `/files/${encodeURI(`${problem.id}/problem.pdf`)}`
            : null,
      samples,
    }));
    return;
  }

  if (url.pathname.startsWith("/files/")) {
    let relativePath;
    try {
      relativePath = decodeURIComponent(url.pathname.slice("/files/".length));
    } catch {
      send(response, 400, "Invalid file path", "text/plain; charset=utf-8");
      return;
    }
    const problem = problems.find((item) =>
      item.archivePdf === relativePath || relativePath === `${item.id}/problem.pdf`
    );
    const targetPath = problem?.archivePdf || (problem ? `${problem.id}/problem.pdf` : "");
    if (!problem || relativePath !== targetPath) {
      send(response, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    const target = path.resolve(ROOT, ...targetPath.split("/"));
    if (!target.startsWith(`${ROOT}${path.sep}`)) {
      send(response, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }
    serveFile(request, response, target);
    return;
  }

  const staticFiles = new Map([
    ["/", "index.html"],
    ["/index.html", "index.html"],
    ["/styles.css", "styles.css"],
    ["/app.js", "app.js"],
  ]);
  for (const iconName of [
    "vista_book_1.ico",
    "vista_console.ico",
    "vista_info.ico",
    "vista_perf_center.ico",
    "vista_messenger.ico",
    "vista_collab.ico",
    "vista_get_started.ico",
    "vista_pc_1.ico",
    "vista_personalization.ico",
  ]) {
    staticFiles.set(`/assets/icons/${iconName}`, path.join("assets", "icons", iconName));
  }
  staticFiles.set("/assets/icons/default-profile.webp", path.join("assets", "icons", "default-profile.webp"));
  const relativeFile = staticFiles.get(url.pathname);
  if (relativeFile) {
    serveFile(request, response, path.join(ROOT, relativeFile));
    return;
  }
  send(response, 404, "Not found", "text/plain; charset=utf-8");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Untitled Judge Web is ready at http://127.0.0.1:${PORT}`);
  console.log(`${problems.length} problems indexed from this folder.`);
});
