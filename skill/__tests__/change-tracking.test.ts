// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validate } from '../../src/shared/validate';

const skill = readFileSync(new URL('../specpad/SKILL.md', import.meta.url), 'utf8');
const template = readFileSync(
  new URL('../specpad/templates/starter.releases.json', import.meta.url),
  'utf8',
);

describe('skill documents the change-tracking plumbing', () => {
  it('documents the manifest, cache dir, and job marker files', () => {
    expect(skill).toContain('.releases.json');
    expect(skill).toContain('.specpad/');
    expect(skill).toContain('.job.json');
  });

  it('documents the core plumbing operations', () => {
    expect(skill).toMatch(/refresh/i);
    expect(skill).toMatch(/snapshot/i);
    expect(skill).toContain('Job:'); // the commit trailer
  });

  it('states the skill never computes diffs (the editor does)', () => {
    expect(skill.toLowerCase()).toContain('never');
    expect(skill).toMatch(/editor (computes|owns|diffs)/i);
  });
});

describe('starter releases template', () => {
  it('is valid JSON that passes the shared releases schema', () => {
    const doc = JSON.parse(template);
    expect(doc.type).toBe('releases');
    expect(doc.schemaVersion).toBe('1.0');
    expect(validate(doc)).toEqual([]);
  });
});

describe('skill documents requirement hierarchy', () => {
  it('documents the level field and dotted heading codes', () => {
    expect(skill).toMatch(/level/);
    expect(skill).toMatch(/hierarch/i);
    expect(skill).toContain('Data.Range');
  });
});
