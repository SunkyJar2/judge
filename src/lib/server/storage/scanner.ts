import { promises as fs } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { ValidationMode } from '@prisma/client';
import { storeInCAS, generateSamplePreview, type StoredCASFile } from './cas';

export interface ParsedTestCase {
  orderIndex: number;
  isSample: boolean;
  name: string;
  inputCAS: StoredCASFile;
  outputCAS: StoredCASFile;
  sampleInputPreview: string | null;
  sampleOutputPreview: string | null;
}

export interface ParsedProblemMetadata {
  id: string; // e.g. "Modul-1/A/SetA1"
  module: string;
  group: string;
  code: string;
  title: string;
  statementMd: string | null;
  statementPdfPath: string | null;
  timeLimit: number; // Seconds
  wallTimeLimit: number; // Seconds
  memoryLimit: number; // MB
  points: number;
  validationMode: ValidationMode;
  floatTolerance: number | null;
  validatorScriptPath: string | null;
  testcases: ParsedTestCase[];
}

/**
 * Calculates standard module points:
 * Points = min(1000, 100 + (Module - 1) * 50 + GroupIndex * 25)
 */
export function calculateDefaultPoints(moduleStr: string, groupStr: string): number {
  const modMatch = moduleStr.match(/\d+/);
  const modNum = modMatch ? Math.max(1, parseInt(modMatch[0], 10)) : 1;

  // Derive group index from letter (A=0, B=1, etc.) or number
  let groupIndex = 0;
  if (/^[A-Za-z]$/.test(groupStr)) {
    groupIndex = groupStr.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
  } else {
    const groupMatch = groupStr.match(/\d+/);
    if (groupMatch) {
      groupIndex = Math.max(0, parseInt(groupMatch[0], 10) - 1);
    }
  }

  const calculated = 100 + (modNum - 1) * 50 + groupIndex * 25;
  return Math.min(1000, calculated);
}

/**
 * Parses a simple INI file (key=value, ignoring comments and quotes).
 */
export function parseIni(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#') || line.startsWith('[')) {
      continue;
    }
    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1) {
      const key = line.substring(0, eqIdx).trim();
      let value = line.substring(eqIdx + 1).trim();
      if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
        value = value.substring(1, value.length - 1);
      }
      result[key] = value;
    }
  }
  return result;
}

/**
 * Scans a testcase directory (e.g. data/sample or data/secret) and pairs .in and .ans files.
 */
async function scanTestcaseDir(
  dirPath: string,
  isSample: boolean,
  startIndex: number
): Promise<{ testcases: ParsedTestCase[]; nextIndex: number }> {
  const testcases: ParsedTestCase[] = [];
  let currentIndex = startIndex;

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const inFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith('.in'))
      .map((e) => e.name.substring(0, e.name.length - 3))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    for (const baseName of inFiles) {
      const inPath = path.join(dirPath, `${baseName}.in`);
      const ansPath = path.join(dirPath, `${baseName}.ans`);

      // Verify matching .ans file exists
      try {
        await fs.access(ansPath);
      } catch {
        // Skip orphaned .in file without matching .ans
        continue;
      }

      const inBuffer = await fs.readFile(inPath);
      const ansBuffer = await fs.readFile(ansPath);

      const inputCAS = await storeInCAS(inBuffer, 'in');
      const outputCAS = await storeInCAS(ansBuffer, 'ans');

      testcases.push({
        orderIndex: currentIndex++,
        isSample,
        name: baseName,
        inputCAS,
        outputCAS,
        sampleInputPreview: isSample ? generateSamplePreview(inBuffer) : null,
        sampleOutputPreview: isSample ? generateSamplePreview(ansBuffer) : null
      });
    }
  } catch {
    // Directory might not exist (e.g. no sample testcases), return empty
  }

  return { testcases, nextIndex: currentIndex };
}

/**
 * Scans and parses an unzipped or filesystem DOMjudge problem directory.
 */
export async function parseProblemDirectory(
  problemDir: string,
  moduleOverride?: string,
  groupOverride?: string,
  codeOverride?: string
): Promise<ParsedProblemMetadata> {
  const dirName = path.basename(path.resolve(problemDir));
  const parts = path.resolve(problemDir).split(path.sep);

  const moduleName = moduleOverride || (parts.length >= 3 ? parts[parts.length - 3] : 'DefaultModule');
  const groupName = groupOverride || (parts.length >= 2 ? parts[parts.length - 2] : 'DefaultGroup');
  const problemCode = codeOverride || dirName;
  const problemId = `${moduleName}/${groupName}/${problemCode}`;

  let title = problemCode;
  let timeLimit = 1.0;
  let wallTimeLimit = 3.0;
  let memoryLimit = 512;
  let validationMode: ValidationMode = ValidationMode.TOKEN_NORMALIZED;
  let floatTolerance: number | null = null;
  let validatorScriptPath: string | null = null;
  let statementMd: string | null = null;
  let statementPdfPath: string | null = null;

  // 1. Check domjudge-problem.ini
  const iniPath = path.join(problemDir, 'domjudge-problem.ini');
  try {
    const iniContent = await fs.readFile(iniPath, 'utf-8');
    const iniData = parseIni(iniContent);
    if (iniData['timelimit']) {
      const parsedTime = parseFloat(iniData['timelimit']);
      if (!isNaN(parsedTime) && parsedTime > 0) {
        timeLimit = parsedTime;
        wallTimeLimit = Math.max(3.0, timeLimit * 3.0);
      }
    }
    if (iniData['name']) {
      title = iniData['name'];
    }
  } catch {
    // Optional file
  }

  // 2. Check problem.yaml
  const yamlPath = path.join(problemDir, 'problem.yaml');
  try {
    const yamlContent = await fs.readFile(yamlPath, 'utf-8');
    const parsedYaml = YAML.parse(yamlContent);
    if (parsedYaml) {
      if (parsedYaml.name) title = String(parsedYaml.name);
      if (parsedYaml.title) title = String(parsedYaml.title);

      if (parsedYaml.limits) {
        if (parsedYaml.limits.time) {
          timeLimit = parseFloat(parsedYaml.limits.time);
          wallTimeLimit = Math.max(3.0, timeLimit * 3.0);
        }
        if (parsedYaml.limits.memory) {
          memoryLimit = parseInt(parsedYaml.limits.memory, 10);
        }
      }

      if (parsedYaml.validation) {
        const valType = String(parsedYaml.validation).toLowerCase();
        if (valType === 'custom') {
          validationMode = ValidationMode.CUSTOM_VALIDATOR;
        } else if (valType === 'float') {
          validationMode = ValidationMode.FLOAT_TOLERANCE;
        }
      }

      if (parsedYaml.validator_flags) {
        const flags = String(parsedYaml.validator_flags);
        const tolMatch = flags.match(/(?:float_tolerance|tolerance|eps|float_relative_tolerance)\s+([0-9eE.-]+)/);
        if (tolMatch) {
          floatTolerance = parseFloat(tolMatch[1]);
          validationMode = ValidationMode.FLOAT_TOLERANCE;
        }
      }
    }
  } catch {
    // Optional file
  }

  // 3. Check for statement Markdown
  const mdCandidates = ['statement.md', 'problem.md', 'README.md'];
  for (const candidate of mdCandidates) {
    const p = path.join(problemDir, candidate);
    try {
      statementMd = await fs.readFile(p, 'utf-8');
      break;
    } catch {
      // Continue search
    }
  }

  // 4. Check for statement PDF
  const pdfCandidates = ['problem.pdf', 'statement.pdf'];
  for (const candidate of pdfCandidates) {
    const p = path.join(problemDir, candidate);
    try {
      await fs.access(p);
      statementPdfPath = p;
      break;
    } catch {
      // Continue search
    }
  }

  // 5. Check for custom output validator
  const validatorDir = path.join(problemDir, 'output_validators');
  try {
    const valStats = await fs.stat(validatorDir);
    if (valStats.isDirectory()) {
      validationMode = ValidationMode.CUSTOM_VALIDATOR;
      validatorScriptPath = validatorDir;
    }
  } catch {
    // No custom validator
  }

  // 6. Scan Sample and Secret Test Cases
  const sampleDir = path.join(problemDir, 'data', 'sample');
  const secretDir = path.join(problemDir, 'data', 'secret');

  const { testcases: sampleTestcases, nextIndex } = await scanTestcaseDir(sampleDir, true, 0);
  const { testcases: secretTestcases } = await scanTestcaseDir(secretDir, false, nextIndex);

  const allTestcases = [...sampleTestcases, ...secretTestcases];
  const points = calculateDefaultPoints(moduleName, groupName);

  return {
    id: problemId,
    module: moduleName,
    group: groupName,
    code: problemCode,
    title,
    statementMd,
    statementPdfPath,
    timeLimit,
    wallTimeLimit,
    memoryLimit,
    points,
    validationMode,
    floatTolerance,
    validatorScriptPath,
    testcases: allTestcases
  };
}
