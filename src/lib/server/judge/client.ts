export interface Judge0SubmissionRequest {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  cpu_extra_time?: number;
  wall_time_limit?: number;
  memory_limit?: number;
  stack_limit?: number;
  max_processes_and_or_threads?: number;
  enable_per_process_and_thread_time_limit?: boolean;
  enable_per_process_and_thread_memory_limit?: boolean;
  max_file_size?: number;
  compiler_options?: string;
  command_line_arguments?: string;
  redirect_stderr_to_stdout?: boolean;
  callback_url?: string;
  additional_files?: string; // base64-encoded zip
}

export interface Judge0SubmissionResponse {
  token: string;
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
  status: {
    id: number;
    description: string;
  };
}

export interface SupportedLanguage {
  id: number;
  name: string;
  monacoLang: string;
  extension: string;
  isCompiled: boolean;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { id: 54, name: 'C++ (GCC 9.2.0)', monacoLang: 'cpp', extension: 'cpp', isCompiled: true },
  { id: 50, name: 'C (GCC 9.2.0)', monacoLang: 'c', extension: 'c', isCompiled: true },
  { id: 71, name: 'Python (3.8.1)', monacoLang: 'python', extension: 'py', isCompiled: false },
  { id: 62, name: 'Java (OpenJDK 13.0.1)', monacoLang: 'java', extension: 'java', isCompiled: true },
  { id: 73, name: 'Rust (1.40.0)', monacoLang: 'rust', extension: 'rs', isCompiled: true },
  { id: 60, name: 'Go (1.13.5)', monacoLang: 'go', extension: 'go', isCompiled: true },
  { id: 63, name: 'JavaScript (Node.js)', monacoLang: 'javascript', extension: 'js', isCompiled: false },
  { id: 74, name: 'TypeScript (3.7.4)', monacoLang: 'typescript', extension: 'ts', isCompiled: false },
];

const JUDGE0_BASE_URL = process.env.JUDGE0_URL || 'http://localhost:2358';
const JUDGE0_TOKEN = process.env.JUDGE0_TOKEN || 'judge0_secret_token_123';

/**
 * Base64 encodes a string or Buffer safely.
 */
export function toBase64(input?: string | Buffer | null): string | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input === 'string') {
    return Buffer.from(input, 'utf-8').toString('base64');
  }
  return input.toString('base64');
}

/**
 * Decodes a Base64 string safely.
 */
export function fromBase64(input?: string | null): string {
  if (!input) return '';
  return Buffer.from(input, 'base64').toString('utf-8');
}

/**
 * Sends a single submission to Judge0.
 * If wait=true, synchronously awaits execution.
 */
export async function createJudge0Submission(
  sub: Judge0SubmissionRequest,
  wait = false
): Promise<Judge0SubmissionResponse> {
  const url = new URL(`${JUDGE0_BASE_URL}/submissions`);
  url.searchParams.set('base64_encoded', 'true');
  if (wait) {
    url.searchParams.set('wait', 'true');
  }

  const payload = {
    enable_per_process_and_thread_time_limit: true,
    enable_per_process_and_thread_memory_limit: true,
    ...sub,
    source_code: toBase64(sub.source_code),
    stdin: toBase64(sub.stdin),
    expected_output: toBase64(sub.expected_output),
  };

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Judge0-Token': JUDGE0_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Judge0 request failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();

  return {
    ...data,
    stdout: fromBase64(data.stdout),
    stderr: fromBase64(data.stderr),
    compile_output: fromBase64(data.compile_output),
  };
}

/**
 * Sends a batch of submissions to Judge0.
 */
export async function createJudge0BatchSubmissions(
  submissions: Judge0SubmissionRequest[]
): Promise<{ token: string }[]> {
  const url = `${JUDGE0_BASE_URL}/submissions/batch?base64_encoded=true`;

  const payload = {
    submissions: submissions.map((sub) => ({
      enable_per_process_and_thread_time_limit: true,
      enable_per_process_and_thread_memory_limit: true,
      ...sub,
      source_code: toBase64(sub.source_code),
      stdin: toBase64(sub.stdin),
      expected_output: toBase64(sub.expected_output),
    })),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Judge0-Token': JUDGE0_TOKEN,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Judge0 batch request failed (${res.status}): ${errorBody}`);
  }

  return await res.json();
}

/**
 * Retrieves the status and output of a submission by its token.
 */
export async function getJudge0Submission(token: string): Promise<Judge0SubmissionResponse> {
  const url = `${JUDGE0_BASE_URL}/submissions/${token}?base64_encoded=true`;

  const res = await fetch(url, {
    headers: {
      'X-Judge0-Token': JUDGE0_TOKEN,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to fetch Judge0 submission (${res.status}): ${errorBody}`);
  }

  const data = await res.json();

  return {
    ...data,
    stdout: fromBase64(data.stdout),
    stderr: fromBase64(data.stderr),
    compile_output: fromBase64(data.compile_output),
  };
}
