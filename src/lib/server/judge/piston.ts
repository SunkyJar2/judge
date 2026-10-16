import { Verdict } from '@prisma/client';

export interface PistonLanguageMapping {
  language: string;
  version: string;
  filename: string;
}

export const PISTON_LANGUAGE_MAP: Record<number, PistonLanguageMapping> = {
  50: { language: 'c', version: '*', filename: 'main.c' },
  54: { language: 'c++', version: '*', filename: 'main.cpp' },
  71: { language: 'python', version: '*', filename: 'main.py' },
  62: { language: 'java', version: '*', filename: 'Main.java' },
  73: { language: 'rust', version: '*', filename: 'main.rs' },
  60: { language: 'go', version: '*', filename: 'main.go' },
  63: { language: 'javascript', version: '*', filename: 'main.js' },
  74: { language: 'typescript', version: '*', filename: 'main.ts' },
};

export interface PistonRawResponse {
  language: string;
  version: string;
  run?: {
    stdout?: string;
    stderr?: string;
    output?: string;
    code?: number;
    signal?: string | null;
  };
  compile?: {
    stdout?: string;
    stderr?: string;
    output?: string;
    code?: number;
    signal?: string | null;
  };
  message?: string;
}

export interface PistonExecutionResult {
  verdict: Verdict;
  stdout: string;
  stderr: string;
  compileOutput: string | null;
  executionTimeMs: number;
  memoryUsedKb: number;
  statusId: number; // 3: AC, 4: WA, 5: TLE, 6: CE, 11: RTE
}

export interface PistonExecuteOptions {
  languageId: number;
  sourceCode: string;
  stdin?: string;
  timeLimitSec?: number;
}

/**
 * Executes code against a Piston API endpoint (public, private, or self-hosted).
 */
export async function executeWithPiston(options: PistonExecuteOptions): Promise<PistonExecutionResult> {
  const rawBaseUrl = process.env.PISTON_URL || 'https://emkc.org/api/v2/piston';
  const apiKey = process.env.PISTON_API_KEY || '';

  // Clean trailing slashes and ensure execute endpoint
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');
  const executeUrl = baseUrl.endsWith('/execute')
    ? baseUrl
    : baseUrl.endsWith('/api/v2')
    ? `${baseUrl}/execute`
    : `${baseUrl}/api/v2/execute`;

  const mapping = PISTON_LANGUAGE_MAP[options.languageId] || {
    language: 'c',
    version: '*',
    filename: 'main.c',
  };

  const timeoutMs = Math.min(10000, Math.max(1000, Math.round((options.timeLimitSec || 2.0) * 1000)));

  const payload = {
    language: mapping.language,
    version: mapping.version,
    files: [
      {
        name: mapping.filename,
        content: options.sourceCode,
      },
    ],
    stdin: options.stdin || '',
    run_timeout: timeoutMs,
    compile_timeout: 10000,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = apiKey;
  }

  const startTime = performance.now();

  try {
    const res = await fetch(executeUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const elapsedMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let errMsg = `Piston API returned HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.message) errMsg = parsed.message;
      } catch {
        // Keep raw text
      }

      return {
        verdict: Verdict.ERROR,
        stdout: '',
        stderr: errMsg,
        compileOutput: errMsg,
        executionTimeMs: elapsedMs,
        memoryUsedKb: 0,
        statusId: 13,
      };
    }

    const data: PistonRawResponse = await res.json();

    // 1. Check Compilation Error
    if (data.compile && data.compile.code !== 0) {
      const compileErr = data.compile.output || data.compile.stderr || 'Compilation failed';
      return {
        verdict: Verdict.CE,
        stdout: '',
        stderr: data.compile.stderr || '',
        compileOutput: compileErr.slice(0, 16384),
        executionTimeMs: elapsedMs,
        memoryUsedKb: 0,
        statusId: 6,
      };
    }

    // 2. Check Execution Output
    const run = data.run || { stdout: '', stderr: '', code: 0, signal: null };

    // Check Time Limit Exceeded (signal SIGKILL or SIGTERM)
    if (run.signal === 'SIGKILL' || run.signal === 'SIGTERM') {
      return {
        verdict: Verdict.TLE,
        stdout: run.stdout || '',
        stderr: 'Time Limit Exceeded',
        compileOutput: null,
        executionTimeMs: timeoutMs,
        memoryUsedKb: 0,
        statusId: 5,
      };
    }

    // Check Runtime Error (non-zero exit code)
    if (run.code && run.code !== 0) {
      return {
        verdict: Verdict.RTE,
        stdout: run.stdout || '',
        stderr: (run.stderr || run.output || `Exited with status ${run.code}`).slice(0, 4096),
        compileOutput: null,
        executionTimeMs: elapsedMs,
        memoryUsedKb: 0,
        statusId: 11,
      };
    }

    return {
      verdict: Verdict.AC, // Preliminary; output validator will check expected vs actual
      stdout: run.stdout || '',
      stderr: run.stderr || '',
      compileOutput: null,
      executionTimeMs: elapsedMs,
      memoryUsedKb: 0,
      statusId: 3,
    };
  } catch (err: any) {
    const elapsedMs = Math.round(performance.now() - startTime);
    return {
      verdict: Verdict.ERROR,
      stdout: '',
      stderr: err?.message || 'Failed to reach Piston execution server',
      compileOutput: err?.message || null,
      executionTimeMs: elapsedMs,
      memoryUsedKb: 0,
      statusId: 13,
    };
  }
}

