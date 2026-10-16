import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/server/prisma';
import { storeInCAS, initStorageDirs } from '../src/lib/server/storage/cas';
import { ValidationMode } from '@prisma/client';

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';

  // Check if DATABASE_URL is valid and not a placeholder
  if (
    !dbUrl ||
    dbUrl.includes('postgres_password_replace_me') ||
    dbUrl.includes('postgres_super_secure_password_replace_me') ||
    dbUrl.includes('localhost:5433')
  ) {
    console.log('ℹ️ [DB Setup] No remote production DATABASE_URL detected. Skipping auto-migration during build.');
    return;
  }

  console.log('🚀 [DB Setup] Synchronizing database schema with target database...');
  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      stdio: 'inherit',
      env: { ...process.env }
    });
    console.log('✅ [DB Setup] Database schema is up to date.');
  } catch (err: any) {
    console.error('❌ [DB Setup] prisma db push failed:', err.message);
    throw err;
  }

  // Check if database needs initial seeding
  try {
    const problemCount = await prisma.problem.count();
    console.log(`📊 [DB Setup] Current problem count: ${problemCount}`);

    if (problemCount === 0) {
      console.log('🌱 [DB Setup] Empty database detected. Seeding 49 contest problems from prisma/seed.json...');
      await initStorageDirs();

      const seedPath = path.resolve('prisma/seed.json');
      if (await fs.stat(seedPath).catch(() => null)) {
        const raw = await fs.readFile(seedPath, 'utf-8');
        const problems = JSON.parse(raw);

        let seeded = 0;
        for (const prob of problems) {
          const processedTests = [];
          let order = 0;

          for (const tc of prob.testcases) {
            const inCAS = await storeInCAS(tc.input, 'in');
            const outCAS = await storeInCAS(tc.output, 'ans');

            processedTests.push({
              orderIndex: order++,
              isSample: tc.isSample,
              inputStoragePath: inCAS.storagePath,
              outputStoragePath: outCAS.storagePath,
              inputSha256: inCAS.sha256,
              outputSha256: outCAS.sha256,
              inputBytes: inCAS.sizeBytes,
              outputBytes: outCAS.sizeBytes,
              sampleInputPreview: tc.isSample ? tc.input.slice(0, 500) : null,
              sampleOutputPreview: tc.isSample ? tc.output.slice(0, 500) : null
            });
          }

          await prisma.$transaction(async (tx) => {
            await tx.problem.upsert({
              where: { id: prob.id },
              update: {
                title: prob.title,
                module: prob.module,
                group: prob.group,
                code: prob.code,
                statementMd: prob.statementMd,
                statementPdfPath: prob.pdfPath || null,
                timeLimit: prob.timeLimit || 1.0,
                wallTimeLimit: prob.wallTimeLimit || 3.0,
                memoryLimit: prob.memoryLimit || 512,
                points: prob.points || 100,
                validationMode: ValidationMode.TOKEN_NORMALIZED
              },
              create: {
                id: prob.id,
                title: prob.title,
                module: prob.module,
                group: prob.group,
                code: prob.code,
                statementMd: prob.statementMd,
                statementPdfPath: prob.pdfPath || null,
                timeLimit: prob.timeLimit || 1.0,
                wallTimeLimit: prob.wallTimeLimit || 3.0,
                memoryLimit: prob.memoryLimit || 512,
                points: prob.points || 100,
                validationMode: ValidationMode.TOKEN_NORMALIZED,
                testcaseVersion: 1
              }
            });

            await tx.testCase.deleteMany({ where: { problemId: prob.id } });

            if (processedTests.length > 0) {
              await tx.testCase.createMany({
                data: processedTests.map((t: any) => ({ ...t, problemId: prob.id }))
              });
            }
          });

          seeded++;
        }
        console.log(`🎉 [DB Setup] Successfully seeded ${seeded} problems & testcases!`);
      }
    }
  } catch (err: any) {
    console.warn('⚠️ [DB Setup] Notice during seed check:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Notice during db-setup:', err);
  process.exit(0);
});

