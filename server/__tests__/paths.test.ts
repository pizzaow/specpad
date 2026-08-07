import { describe, it, expect } from 'vitest';
import { resolveInProject, isWithin, isAllowlisted, offendingPaths, PathError } from '../paths';

// SRV-2: the server holds push access to a real repository. Every one of these is a
// security test, not a tidiness test.

const ROOT = 'docs/specpad';

describe('resolveInProject — permitted paths', () => {
  it('resolves a plain filename under the project root', () => {
    expect(resolveInProject(ROOT, ['acme.srs.json'])).toBe('docs/specpad/acme.srs.json');
  });

  it('resolves nested segments', () => {
    expect(resolveInProject(ROOT, ['.specpad', 'baseline', 'acme.srs.json'])).toBe(
      'docs/specpad/.specpad/baseline/acme.srs.json',
    );
  });

  it('accepts a slash-joined string as well as segments', () => {
    expect(resolveInProject(ROOT, 'diagrams/context.svg')).toBe(
      'docs/specpad/diagrams/context.svg',
    );
  });

  it('tolerates a trailing slash on the root and redundant "." segments', () => {
    expect(resolveInProject('docs/specpad/', ['.', 'acme.srs.json'])).toBe(
      'docs/specpad/acme.srs.json',
    );
  });
});

describe('resolveInProject — refused paths', () => {
  it('refuses parent traversal in any position', () => {
    expect(() => resolveInProject(ROOT, ['..', '..', 'src', 'index.tsx'])).toThrow(PathError);
    expect(() => resolveInProject(ROOT, ['a', '..', '..', '..', 'etc', 'passwd'])).toThrow(
      PathError,
    );
    expect(() => resolveInProject(ROOT, '../../src/index.tsx')).toThrow(/escapes the project root/);
  });

  it('refuses traversal expressed with backslashes', () => {
    expect(() => resolveInProject(ROOT, '..\\..\\src\\index.tsx')).toThrow(PathError);
  });

  it('refuses an absolute path', () => {
    expect(() => resolveInProject(ROOT, '/etc/passwd')).toThrow(PathError);
    expect(() => resolveInProject(ROOT, 'C:/Windows/system32')).toThrow(
      /Absolute paths are not permitted/,
    );
  });

  it('refuses a null byte', () => {
    expect(() => resolveInProject(ROOT, 'acme.srs.json\0.png')).toThrow(/null byte/);
  });

  it('refuses an empty path', () => {
    expect(() => resolveInProject(ROOT, [])).toThrow(/Path is empty/);
    expect(() => resolveInProject(ROOT, '')).toThrow(/Path is empty/);
    expect(() => resolveInProject(ROOT, '///')).toThrow(/Path is empty/);
  });

  it('does not let a lookalike sibling directory pass as the project root', () => {
    // "docs/specpad-secrets" starts with the root string but is not inside it.
    expect(isWithin(ROOT, 'docs/specpad-secrets/keys.json')).toBe(false);
  });
});

describe('isWithin', () => {
  it('accepts the root itself and anything under it', () => {
    expect(isWithin(ROOT, 'docs/specpad')).toBe(true);
    expect(isWithin(ROOT, 'docs/specpad/acme.srs.json')).toBe(true);
    expect(isWithin('docs/specpad/', 'docs/specpad/a/b.json')).toBe(true);
  });

  it('rejects anything outside', () => {
    expect(isWithin(ROOT, 'src/index.tsx')).toBe(false);
    expect(isWithin(ROOT, 'docs/other/a.json')).toBe(false);
    expect(isWithin(ROOT, 'docs')).toBe(false);
  });
});

describe('allowlist checks on a staged diff', () => {
  const allowlist = ['docs/specpad', 'docs/extra'];

  it('accepts paths inside any allowlisted root', () => {
    expect(isAllowlisted(allowlist, 'docs/specpad/acme.srs.json')).toBe(true);
    expect(isAllowlisted(allowlist, 'docs/extra/notes.md')).toBe(true);
  });

  it('names every staged path that falls outside the allowlist', () => {
    const staged = [
      'docs/specpad/acme.srs.json',
      'src/index.tsx',
      'package.json',
      'docs/extra/notes.md',
    ];

    expect(offendingPaths(allowlist, staged)).toEqual(['src/index.tsx', 'package.json']);
  });

  it('reports nothing for a clean diff', () => {
    expect(offendingPaths(allowlist, ['docs/specpad/acme.vtp.json'])).toEqual([]);
  });
});
