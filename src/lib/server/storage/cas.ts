import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface StoredCASFile {
  sha256: string;
  storagePath: string;
  sizeBytes: number;
}

const STORAGE_ROOT = process.env.STORAGE_DIR || './storage';
const TESTCASES_DIR = path.resolve(STORAGE_ROOT, 'testcases');

/**
 * Ensures the target storage directories exist.
 */
export async function initStorageDirs(): Promise<void> {
  await fs.mkdir(TESTCASES_DIR, { recursive: true });
  await fs.mkdir(path.resolve(STORAGE_ROOT, 'statements'), { recursive: true });
  await fs.mkdir(path.resolve(STORAGE_ROOT, 'media'), { recursive: true });
}

/**
 * Computes the SHA-256 hex digest of a Buffer or string.
 */
export function computeSha256(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Stores arbitrary content into Content-Addressed Storage (CAS).
 * Deduplicates identical files automatically based on SHA-256.
 *
 * @param content Buffer or string to persist
 * @param extension File extension without dot, e.g. 'in' or 'ans'
 * @returns Metadata including hash, relative/absolute storage path, and size
 */
export async function storeInCAS(
  content: Buffer | string,
  extension: 'in' | 'ans' | 'bin' | 'txt'
): Promise<StoredCASFile> {
  await initStorageDirs();

  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  const sha256 = computeSha256(buffer);
  const filename = `${sha256}.${extension}`;
  const targetPath = path.join(TESTCASES_DIR, filename);

  try {
    // Check if the file already exists (deduplication)
    await fs.access(targetPath);
  } catch {
    // File does not exist, write it
    const tempPath = `${targetPath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
    await fs.writeFile(tempPath, buffer);
    await fs.rename(tempPath, targetPath);
  }

  return {
    sha256,
    storagePath: targetPath,
    sizeBytes: buffer.length
  };
}

/**
 * Reads a CAS file as a UTF-8 string.
 */
export async function readCASString(storagePath: string): Promise<string> {
  return await fs.readFile(storagePath, 'utf-8');
}

/**
 * Reads a CAS file as a raw Buffer.
 */
export async function readCASBuffer(storagePath: string): Promise<Buffer> {
  return await fs.readFile(storagePath);
}

/**
 * Generates a truncated preview (max 4 KB) for sample testcases.
 */
export function generateSamplePreview(content: Buffer | string, maxBytes = 4096): string {
  const str = typeof content === 'string' ? content : content.toString('utf-8');
  if (Buffer.byteLength(str, 'utf-8') <= maxBytes) {
    return str;
  }
  // Truncate to maxBytes safely
  const buf = Buffer.from(str, 'utf-8');
  return buf.subarray(0, maxBytes).toString('utf-8') + '\n... [truncated]';
}

