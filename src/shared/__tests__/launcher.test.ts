import { describe, it, expect } from 'vitest';
import { editorUrl, editorVersionPath, DEFAULT_EDITOR_BASE } from '../launcher';

// EDR-4: a self-hosted deployment must open its own editor, and an existing project
// that says nothing must keep working exactly as before.

describe('editorVersionPath', () => {
  it('maps a contract version to its pinned build path', () => {
    expect(editorVersionPath('1.0')).toBe('/v01/');
    expect(editorVersionPath('2.0')).toBe('/v02/');
    expect(editorVersionPath('11.3')).toBe('/v11/');
  });

  it('defaults to the current contract version', () => {
    expect(editorVersionPath()).toBe('/v01/');
  });

  it('refuses a version it cannot derive a path from', () => {
    expect(() => editorVersionPath('next')).toThrow(/schemaVersion/);
  });
});

describe('editorUrl', () => {
  it('falls back to the public hosted editor when the project sets no base', () => {
    expect(editorUrl(undefined)).toBe('https://specpad.com/v01/');
    expect(editorUrl(null)).toBe('https://specpad.com/v01/');
    expect(editorUrl('')).toBe('https://specpad.com/v01/');
    expect(editorUrl('   ')).toBe('https://specpad.com/v01/');
  });

  it('points at a self-hosted server when the project sets one', () => {
    expect(editorUrl('https://specpad.internal.corp')).toBe('https://specpad.internal.corp/v01/');
  });

  it('tolerates a trailing slash on the configured base', () => {
    expect(editorUrl('https://specpad.internal.corp/')).toBe('https://specpad.internal.corp/v01/');
    expect(editorUrl('https://specpad.internal.corp///')).toBe('https://specpad.internal.corp/v01/');
  });

  it('keeps a base that includes a path prefix', () => {
    expect(editorUrl('https://tools.corp/specpad')).toBe('https://tools.corp/specpad/v01/');
  });

  it('always derives the version path rather than trusting the base', () => {
    expect(editorUrl('https://specpad.internal.corp', '2.0')).toBe(
      'https://specpad.internal.corp/v02/',
    );
  });

  it('exposes the default base for the launcher template', () => {
    expect(DEFAULT_EDITOR_BASE).toBe('https://specpad.com');
  });
});
