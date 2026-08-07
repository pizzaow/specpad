// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * SRV-5: the server enforces the shared contract by *importing* it, never by
 * re-implementing it. Three halves of one product — skill, editor, server — cannot be
 * kept honest by good intentions, so this is the same idea as
 * `skill/__tests__/parity.test.ts`: fail the build when they start to drift.
 */

const dir = fileURLToPath(new URL('..', import.meta.url));
const sources = readdirSync(dir)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => ({ file: f, text: readFileSync(new URL(`../${f}`, import.meta.url), 'utf8') }));

const source = (file: string) => sources.find((s) => s.file === file)!.text;

describe('the server imports the contract rather than restating it', () => {
  it('runs the shared validator and governance check', () => {
    expect(source('commitGate.ts')).toMatch(
      /import\s*\{[^}]*\bvalidate\b[^}]*\bcheckGovernance\b[^}]*\}\s*from\s*'\.\.\/src\/shared'/s,
    );
  });

  it('resolves conflicts with the shared three-way merge', () => {
    expect(source('workingCopy.ts')).toMatch(/import\s*\{[^}]*\bmergeDocs\b[^}]*\}\s*from\s*'\.\.\/src\/shared'/s);
  });

  it('derives the pending diff with the shared item diff, not a second implementation', () => {
    expect(source('workingCopy.ts')).toMatch(/import\s*\{[^}]*\bdiffItems\b[^}]*\}\s*from\s*'\.\.\/src\/shared'/s);
  });

  it('derives the editor version path from the shared launcher helper', () => {
    expect(source('config.ts')).toMatch(/import\s*\{[^}]*\beditorVersionPath\b[^}]*\}\s*from\s*'\.\.\/src\/shared'/s);
  });

  it('reads the active-job marker through the shared helper', () => {
    expect(source('workingCopy.ts')).toMatch(/import\s*\{[^}]*\bactiveJobIds\b[^}]*\}\s*from\s*'\.\.\/src\/shared'/s);
  });

  it('classifies document filenames with the shared convention', () => {
    expect(source('workingCopy.ts')).toMatch(/classifyDocFilename[^;]*from\s*'\.\.\/src\/transports\/types'/s);
  });
});

describe('the server defines no second copy of a contract rule', () => {
  const forbidden = [
    ['validate', /(?:export\s+)?(?:async\s+)?function\s+validate\s*\(/],
    ['checkGovernance', /(?:export\s+)?(?:async\s+)?function\s+checkGovernance\s*\(/],
    ['mergeDocs', /(?:export\s+)?(?:async\s+)?function\s+mergeDocs\s*\(/],
    ['mergeItems', /(?:export\s+)?(?:async\s+)?function\s+mergeItems\s*\(/],
    ['diffItems', /(?:export\s+)?(?:async\s+)?function\s+diffItems\s*\(/],
  ] as const;

  it.each(forbidden)('does not declare its own %s', (name, pattern) => {
    const offenders = sources.filter((s) => pattern.test(s.text)).map((s) => s.file);
    expect(offenders, `${name} must come from src/shared`).toEqual([]);
  });

  it('never hardcodes a governance rule id it could import', () => {
    // The rule ids live in GOVERNANCE_RULES; a literal here means a divergent copy.
    const literals = sources.filter((s) => /'(?:traceability|referential-integrity|missing-expected)'/.test(s.text));
    expect(literals.map((s) => s.file)).toEqual([]);
  });
});
