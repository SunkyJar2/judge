import { describe, it, expect } from 'bun:test';
import { validateOutput } from '#lib/server/judge/validator';
import { ValidationMode } from '@prisma/client';
import { createJudge0Submission } from '#lib/server/judge/client';
import { generateWebhookSignature, verifyWebhookSignature } from '#lib/server/judge/dispatcher';

describe('Output Validation & Token Normalizer', () => {
  it('correctly normalizes whitespace differences and CRLF', () => {
    const expected = '1 2 3\r\n4 5 6\r\n';
    const actual = '1 2 3 \n4 5 6   \n\n';

    const result = validateOutput(expected, actual, ValidationMode.TOKEN_NORMALIZED);
    expect(result.accepted).toBe(true);
  });

  it('validates floating point tolerance within epsilon', () => {
    const expected = '3.14159265';
    const actual = '3.14159260';

    const resultStrict = validateOutput(expected, actual, ValidationMode.TOKEN_NORMALIZED);
    expect(resultStrict.accepted).toBe(false);

    const resultTolerance = validateOutput(expected, actual, ValidationMode.FLOAT_TOLERANCE, 1e-6);
    expect(resultTolerance.accepted).toBe(true);
  });

  it('rejects values outside floating point tolerance', () => {
    const expected = '3.14159';
    const actual = '3.14169';

    const result = validateOutput(expected, actual, ValidationMode.FLOAT_TOLERANCE, 1e-5);
    expect(result.accepted).toBe(false);
  });
});

describe('HMAC Webhook Signatures', () => {
  it('generates and verifies timing-safe signatures correctly', () => {
    const subId = 'sub-test-123';
    const tcId = 'tc-test-456';
    const sig = generateWebhookSignature(subId, tcId);

    expect(verifyWebhookSignature(subId, tcId, sig)).toBe(true);
    expect(verifyWebhookSignature(subId, tcId, sig + 'tampered')).toBe(false);
    expect(verifyWebhookSignature('wrong-sub', tcId, sig)).toBe(false);
  });
});

describe('Live Judge0 Sandbox Execution', () => {
  it('executes Python 3 code in Judge0 container and returns correct output', async () => {
    const pyCode = 'import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b)';

    const result = await createJudge0Submission(
      {
        source_code: pyCode,
        language_id: 71, // Python 3
        stdin: '40 2\n',
        cpu_time_limit: 2.0,
        memory_limit: 128 * 1024,
      },
      true
    );

    expect(result.status.id).toBe(3); // 3 = Accepted
    expect(result.stdout?.trim()).toBe('42');
  });

  it('detects compile / syntax error correctly', async () => {
    const badCode = 'def invalid_syntax(:';

    const result = await createJudge0Submission(
      {
        source_code: badCode,
        language_id: 71,
        stdin: '',
      },
      true
    );

    // In Python syntax error causes status 11 (NZEC) with stderr
    expect(result.status.id).toBeGreaterThanOrEqual(6);
    expect(result.stderr).toContain('SyntaxError');
  });
});

