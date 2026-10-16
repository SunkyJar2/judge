import { describe, it, expect } from 'bun:test';
import AdmZip from 'adm-zip';
import { safelyExtractZip, ZipSecurityError, importProblemZip } from '#lib/server/storage/zip-importer';
import { prisma } from '#lib/server/prisma';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

describe('Problem Ingestion & CAS Storage', () => {
  it('rejects Zip-Slip attacks with path traversal', async () => {
    const maliciousZip = new AdmZip();
    maliciousZip.addFile('dummy.txt', Buffer.from('malicious content'));
    maliciousZip.getEntries()[0].entryName = '../../../etc/passwd';
    const zipBuffer = maliciousZip.toBuffer();

    const targetDir = path.join(os.tmpdir(), `test-zip-slip-${randomUUID()}`);
    expect(safelyExtractZip(zipBuffer, targetDir)).rejects.toThrow(ZipSecurityError);
  });

  it('safely extracts and imports a valid DOMjudge problem package', async () => {
    const validZip = new AdmZip();
    validZip.addFile(
      'problem.yaml',
      Buffer.from(
        'name: "Two Sum Problem"\nlimits:\n  time: 1.5\n  memory: 256\nvalidation: default\n'
      )
    );
    validZip.addFile(
      'domjudge-problem.ini',
      Buffer.from('timelimit = 1.5\nname = "Two Sum Problem"\n')
    );
    validZip.addFile(
      'statement.md',
      Buffer.from('# Two Sum\nGiven an array of integers, return indices of the two numbers such that they add up to a specific target.')
    );
    validZip.addFile('data/sample/sample1.in', Buffer.from('2 7 11 15\n9\n'));
    validZip.addFile('data/sample/sample1.ans', Buffer.from('0 1\n'));
    validZip.addFile('data/secret/secret1.in', Buffer.from('3 2 4\n6\n'));
    validZip.addFile('data/secret/secret1.ans', Buffer.from('1 2\n'));

    const zipBuffer = validZip.toBuffer();

    const result = await importProblemZip(zipBuffer, {
      moduleOverride: 'Modul-1',
      groupOverride: 'A',
      codeOverride: 'TwoSum'
    });

    expect(result.success).toBe(true);
    expect(result.problem.id).toBe('Modul-1/A/TwoSum');
    expect(result.problem.title).toBe('Two Sum Problem');
    expect(result.problem.timeLimit).toBe(1.5);
    expect(result.problem.memoryLimit).toBe(256);
    expect(result.testcaseCount).toBe(2);
    expect(result.sampleCount).toBe(1);

    // Verify database record
    const dbProblem = await prisma.problem.findUnique({
      where: { id: 'Modul-1/A/TwoSum' },
      include: { testcases: true }
    });

    expect(dbProblem).not.toBeNull();
    expect(dbProblem?.testcases.length).toBe(2);

    const sample = dbProblem?.testcases.find((t) => t.isSample);
    const secret = dbProblem?.testcases.find((t) => !t.isSample);

    expect(sample).toBeDefined();
    expect(sample?.sampleInputPreview).toContain('2 7 11 15');
    expect(sample?.sampleOutputPreview).toContain('0 1');

    expect(secret).toBeDefined();
    expect(secret?.sampleInputPreview).toBeNull();
    expect(secret?.sampleOutputPreview).toBeNull();
  });
});
