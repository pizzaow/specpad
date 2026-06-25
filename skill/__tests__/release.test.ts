// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const skill = readFileSync(new URL('../specpad/SKILL.md', import.meta.url), 'utf8');

// The release-cut procedure is agent behaviour; its verification is that the
// distributable skill documents the rule (same shape as working-loop.test.ts).
describe('skill documents the release-cut job closing itself (REL-4)', () => {
  it('has a Cutting a release procedure', () => {
    expect(skill).toMatch(/Cutting a release/i);
  });

  it('states the release-cut job closes itself as the last step before the tag', () => {
    expect(skill).toMatch(/release-cut job/i);
    expect(skill).toMatch(/close itself|closes itself|closed.*last step|last step before the release/i);
    // closing precedes the tag
    expect(skill).toMatch(/final commit[\s\S]*status.*closed[\s\S]*tag the release/i);
  });

  it('treats an open release-cut job after the release as a process error', () => {
    expect(skill).toMatch(/process error/i);
    expect(skill).toMatch(/never leave it open|never remain open|left \*\*open\*\*|don't defer/i);
  });
});
