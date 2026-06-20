// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('visual system is token-based', () => {
  const less = read('../specpad.less');

  it('defines design tokens on :root and a block per theme', () => {
    expect(less).toMatch(/:root\s*\{[\s\S]*--accent:/);
    expect(less).toContain("[data-theme='editorial']");
    expect(less).toContain("[data-theme='blueprint']");
  });

  it('styles components from var(--token), not hard-coded colors', () => {
    expect(less).toMatch(/background:\s*var\(--surface\)/);
    expect(less).toMatch(/color:\s*var\(--text\)/);
  });
});

describe('index.html applies the saved theme before paint', () => {
  const html = read('../../index.html');
  it('has a boot script keyed to the same storage key', () => {
    expect(html).toContain('specpad.theme');
    expect(html).toContain('data-theme');
  });
});
