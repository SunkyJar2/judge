import AdmZip from 'adm-zip';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { prisma } from '#lib/server/prisma';
import { parseProblemDirectory, type ParsedProblemMetadata } from './scanner';

const MAX_ZIP_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_FILES = 1000;

export interface IngestionOptions {
  moduleOverride?: string;
  groupOverride?: string;
  codeOverride?: string;
}

export class ZipSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipSecurityError';
  }
}

/**
 * Validates and safely extracts a ZIP archive, defending against Zip-Slip,
 * symlinks, and zip bombs.
 */
export async function safelyExtractZip(
  zipBuffer: Buffer,
  targetDir: string
): Promise<void> {
  if (zipBuffer.length > MAX_ZIP_BYTES) {
    throw new ZipSecurityError(`Archive exceeds maximum allowed size of ${MAX_ZIP_BYTES / (1024 * 1024)} MB`);
  }

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  if (entries.length > MAX_FILES) {
    throw new ZipSecurityError(`Archive contains ${entries.length} files, exceeding limit of ${MAX_FILES}`);
  }

  let totalUncompressed = 0;
  const canonicalTargetDir = path.resolve(targetDir);

  // Phase 1: Security Inspection
  for (const entry of entries) {
    // 1. Check for directory traversal (Zip-Slip)
    const normalizedName = path.normalize(entry.entryName).replace(/^(\.\.(\/|\\|$))+/, '');
    const destinationPath = path.resolve(canonicalTargetDir, normalizedName);

    if (!destinationPath.startsWith(canonicalTargetDir + path.sep) && destinationPath !== canonicalTargetDir) {
      throw new ZipSecurityError(`Zip-Slip detected: illegal entry path "${entry.entryName}"`);
    }

    // 2. Reject absolute paths or paths with '..'
    if (path.isAbsolute(entry.entryName) || entry.entryName.includes('..')) {
      throw new ZipSecurityError(`Illegal path traversal characters in entry "${entry.entryName}"`);
    }

    // 3. Symlink / Hardlink / Special file rejection
    // In POSIX mode flags, 0o120000 indicates a symbolic link
    const unixMode = (entry.attr >>> 16) & 0xffff;
    const isSymlink = (unixMode & 0o170000) === 0o120000;
    if (isSymlink) {
      throw new ZipSecurityError(`Symbolic links are strictly forbidden: "${entry.entryName}"`);
    }

    // 4. Zip-bomb defense (uncompressed size check)
    totalUncompressed += entry.header.size;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw new ZipSecurityError(
        `Total uncompressed size exceeds maximum limit of ${MAX_UNCOMPRESSED_BYTES / (1024 * 1024)} MB`
      );
    }
  }

  // Phase 2: Safe Extraction
  await fs.mkdir(canonicalTargetDir, { recursive: true });

  for (const entry of entries) {
    const destinationPath = path.resolve(canonicalTargetDir, entry.entryName);

    if (entry.isDirectory) {
      await fs.mkdir(destinationPath, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.writeFile(destinationPath, entry.getData());
    }
  }
}

/**
 * Ingests a Kattis/DOMjudge problem ZIP package into Content-Addressed Storage
 * and commits metadata and testcases into PostgreSQL via Prisma transaction.
 */
export async function importProblemZip(
  zipBuffer: Buffer,
  options: IngestionOptions = {}
) {
  const tempExtractDir = path.join(os.tmpdir(), `domjudge-import-${randomUUID()}`);

  try {
    // 1. Safely extract archive
    await safelyExtractZip(zipBuffer, tempExtractDir);

    // 2. Detect if problem files are in a root subfolder or directly in the archive
    let problemRoot = tempExtractDir;
    const rootEntries = await fs.readdir(tempExtractDir, { withFileTypes: true });
    const subdirs = rootEntries.filter((e) => e.isDirectory());
    const hasRootMetadata = rootEntries.some(
      (e) => e.name === 'problem.yaml' || e.name === 'domjudge-problem.ini' || e.name === 'data'
    );

    if (!hasRootMetadata && subdirs.length === 1) {
      // Archive was packed with a single root directory (common in Kattis zip files)
      problemRoot = path.join(tempExtractDir, subdirs[0].name);
    }

    // 3. Scan and parse DOMjudge metadata and testcases
    const parsed = await parseProblemDirectory(
      problemRoot,
      options.moduleOverride,
      options.groupOverride,
      options.codeOverride
    );

    // 4. If statement PDF exists, persist it to storage/statements/
    let persistedPdfPath: string | null = null;
    if (parsed.statementPdfPath) {
      const storageRoot = process.env.STORAGE_DIR || './storage';
      const statementsDir = path.resolve(storageRoot, 'statements');
      await fs.mkdir(statementsDir, { recursive: true });

      const safeProblemId = parsed.id.replace(/[^a-zA-Z0-9-_]/g, '_');
      persistedPdfPath = path.join(statementsDir, `${safeProblemId}.pdf`);
      await fs.copyFile(parsed.statementPdfPath, persistedPdfPath);
    }

    // 5. Commit to PostgreSQL inside an atomic Prisma transaction
    const savedProblem = await prisma.$transaction(async (tx) => {
      // Check if problem already exists
      const existing = await tx.problem.findUnique({
        where: { id: parsed.id },
        select: { testcaseVersion: true }
      });

      const nextVersion = existing ? existing.testcaseVersion + 1 : 1;

      // Upsert Problem entity
      const problem = await tx.problem.upsert({
        where: { id: parsed.id },
        update: {
          title: parsed.title,
          statementMd: parsed.statementMd,
          statementPdfPath: persistedPdfPath,
          timeLimit: parsed.timeLimit,
          wallTimeLimit: parsed.wallTimeLimit,
          memoryLimit: parsed.memoryLimit,
          points: parsed.points,
          validationMode: parsed.validationMode,
          floatTolerance: parsed.floatTolerance,
          validatorScriptPath: parsed.validatorScriptPath,
          testcaseVersion: nextVersion,
        },
        create: {
          id: parsed.id,
          module: parsed.module,
          group: parsed.group,
          code: parsed.code,
          title: parsed.title,
          statementMd: parsed.statementMd,
          statementPdfPath: persistedPdfPath,
          timeLimit: parsed.timeLimit,
          wallTimeLimit: parsed.wallTimeLimit,
          memoryLimit: parsed.memoryLimit,
          points: parsed.points,
          validationMode: parsed.validationMode,
          floatTolerance: parsed.floatTolerance,
          validatorScriptPath: parsed.validatorScriptPath,
          testcaseVersion: 1,
        }
      });

      // Replace testcases atomically
      await tx.testCase.deleteMany({
        where: { problemId: problem.id }
      });

      if (parsed.testcases.length > 0) {
        await tx.testCase.createMany({
          data: parsed.testcases.map((tc) => ({
            problemId: problem.id,
            orderIndex: tc.orderIndex,
            isSample: tc.isSample,
            inputStoragePath: tc.inputCAS.storagePath,
            outputStoragePath: tc.outputCAS.storagePath,
            inputSha256: tc.inputCAS.sha256,
            outputSha256: tc.outputCAS.sha256,
            inputBytes: tc.inputCAS.sizeBytes,
            outputBytes: tc.outputCAS.sizeBytes,
            sampleInputPreview: tc.sampleInputPreview,
            sampleOutputPreview: tc.sampleOutputPreview,
          }))
        });
      }

      return problem;
    });

    return {
      success: true,
      problem: savedProblem,
      testcaseCount: parsed.testcases.length,
      sampleCount: parsed.testcases.filter((t) => t.isSample).length
    };
  } finally {
    // 6. Clean up temporary directory
    try {
      await fs.rm(tempExtractDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
}

