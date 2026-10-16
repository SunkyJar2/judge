import { ValidationMode } from '@prisma/client';

export interface ValidationResult {
  accepted: boolean;
  message?: string;
}

/**
 * Normalizes newlines and whitespace:
 * - Converts \r\n to \n
 * - Trims trailing whitespace on each line
 * - Trims trailing empty lines
 */
export function normalizeWhitespace(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

/**
 * Splits content into whitespace-delimited tokens.
 */
export function tokenize(content: string): string[] {
  return content.trim().split(/\s+/).filter(Boolean);
}

/**
 * Checks if a string can be parsed as a valid finite number.
 */
function isNumeric(str: string): boolean {
  if (!str.trim()) return false;
  const num = Number(str);
  return !isNaN(num) && isFinite(num);
}

/**
 * Compares two tokens with floating-point tolerance (absolute or relative).
 */
export function compareWithTolerance(actualStr: string, expectedStr: string, epsilon: number): boolean {
  if (actualStr === expectedStr) return true;

  if (isNumeric(actualStr) && isNumeric(expectedStr)) {
    const a = parseFloat(actualStr);
    const b = parseFloat(expectedStr);

    if (isNaN(a) || isNaN(b)) return false;
    const diff = Math.abs(a - b);

    // Absolute error check
    if (diff <= epsilon) return true;

    // Relative error check: |a - b| / max(|b|, 1e-9) <= epsilon
    const denom = Math.max(Math.abs(b), 1e-9);
    if (diff / denom <= epsilon) return true;

    return false;
  }

  // Non-numeric tokens must match verbatim
  return actualStr === expectedStr;
}

/**
 * Validates output against expected answer according to Problem's ValidationMode.
 */
export function validateOutput(
  expected: string,
  actual: string,
  mode: ValidationMode = ValidationMode.TOKEN_NORMALIZED,
  tolerance?: number | null
): ValidationResult {
  // 1. Fast path: exact match
  if (expected === actual) {
    return { accepted: true };
  }

  // 2. Whitespace normalization
  const normExpected = normalizeWhitespace(expected);
  const normActual = normalizeWhitespace(actual);
  if (normExpected === normActual) {
    return { accepted: true };
  }

  // 3. Token-based or Float-tolerance comparison
  const expTokens = tokenize(normExpected);
  const actTokens = tokenize(normActual);

  if (expTokens.length !== actTokens.length) {
    return {
      accepted: false,
      message: `Token count mismatch: expected ${expTokens.length}, got ${actTokens.length}`
    };
  }

  const eps = tolerance && tolerance > 0 ? tolerance : 1e-6;

  for (let i = 0; i < expTokens.length; i++) {
    const expToken = expTokens[i];
    const actToken = actTokens[i];

    if (mode === ValidationMode.FLOAT_TOLERANCE) {
      if (!compareWithTolerance(actToken, expToken, eps)) {
        return {
          accepted: false,
          message: `Token #${i + 1} mismatch: expected "${expToken}", got "${actToken}" (tolerance ${eps})`
        };
      }
    } else {
      // Default: TOKEN_NORMALIZED
      if (expToken !== actToken) {
        return {
          accepted: false,
          message: `Token #${i + 1} mismatch: expected "${expToken}", got "${actToken}"`
        };
      }
    }
  }

  return { accepted: true };
}

