// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { editorUrl, DEFAULT_EDITOR_BASE } from '../../src/shared';

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../specpad/${rel}`, import.meta.url)), 'utf8');

const template = read('templates/index.html');
const skill = read('SKILL.md');

// EDR-4: the launcher must be able to point at a self-hosted server. The template is
// substituted by the skill, so what we can assert is that the placeholders are there,
// that nothing is hardcoded past them, and that the skill says how to fill them in.

describe('launcher template', () => {
  it('carries a placeholder for the editor base URL', () => {
    expect(template).toContain('EDITOR_BASE_URL');
  });

  it('hardcodes no editor host, so a self-hosted deployment is not sent to the public one', () => {
    expect(template).not.toContain('specpad.com');
  });

  it('substitutes the base in both the redirect and the no-JavaScript fallback', () => {
    // Two places, and a launcher that redirects correctly but links wrongly is worse
    // than one that is consistently wrong: the fallback is what a blocked-script user sees.
    const occurrences = template.match(/EDITOR_BASE_URL/g) ?? [];
    expect(occurrences.length).toBe(2);
    expect(template).toMatch(/href="EDITOR_BASE_URL\/v01\//);
  });

  it('still pins the version path, which is derived from the contract not the deployment', () => {
    expect(template).toContain('/v01/');
    expect(editorUrl(DEFAULT_EDITOR_BASE)).toBe('https://specpad.com/v01/');
  });

  it('keeps the project-name placeholder', () => {
    expect(template).toContain('PROJECT_NAME');
  });

  // MPT-10: one server can host several repositories' projects, so a launcher has to
  // be able to say which one it belongs to.
  it('carries a placeholder for the server project id, and passes it on when set', () => {
    expect(template).toContain('EDITOR_PROJECT_ID');
    expect(template).toMatch(/PROJECT_ID \?\s*'&project=' \+ encodeURIComponent\(PROJECT_ID\)/);
  });

  it('names no project when the index configures none, so a single-project server is untouched', () => {
    // The id is only appended when non-empty — an empty substitution must not produce
    // "&project=", which a server would read as a request for a project called "".
    expect(template).toMatch(/PROJECT_ID \? '&project=/);
  });
});

describe('SKILL.md launcher instructions', () => {
  it('tells the skill to replace every occurrence, and where the value comes from', () => {
    expect(skill).toContain('EDITOR_BASE_URL');
    expect(skill).toMatch(/editorBaseUrl/);
    expect(skill).toMatch(/https:\/\/specpad\.com/);
  });

  it('says to regenerate the launcher when the base changes', () => {
    expect(skill).toMatch(/regenerate the launcher/i);
  });

  it('tells the skill where the server project id comes from (MPT-10)', () => {
    expect(skill).toContain('EDITOR_PROJECT_ID');
    expect(skill).toMatch(/editorProjectId/);
  });
});
