// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { execFile, execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The pre-push stale-design check (DES-1).
 *
 * Each design section records the paths it describes. A commit that changes one of
 * those paths while leaving the section alone is reported. Run against a real temporary
 * repository, because the script's whole job is reading git.
 */

const script = fileURLToPath(new URL('../specpad/templates/hooks/stale-design.mjs', import.meta.url));

function sh(cmd: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolve) => execFile(cmd, args, { cwd }, (error) => resolve(error ? 1 : 0)));
}

const gitAvailable = (await sh('git', ['--version'], os.tmpdir())) === 0;

let repo = '';

/** Run the check for a commit; returns its exit code and what it said. */
function check(sha: string): { code: number; output: string } {
  try {
    execFileSync('node', [script, sha, 'docs/specpad'], { cwd: repo, encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, output: '' };
  } catch (err) {
    const e = err as { status: number; stderr: string };
    return { code: e.status, output: e.stderr ?? '' };
  }
}

const sdd = (bodies: Record<string, string>) => ({
  schemaVersion: '1.0',
  type: 'sdd',
  name: 'acme',
  title: 'Detailed Design',
  items: [
    { id: 'h_1', title: 'Units', heading: true },
    { id: 'd_1', code: 'SDD-1', title: 'auth', source: ['src/auth.ts'], body: bodies.d_1 ?? 'Design.' },
    { id: 'd_2', code: 'SDD-2', title: 'server', source: ['server/'], body: bodies.d_2 ?? 'Design.' },
    { id: 'd_3', code: 'SDD-3', title: 'no paths', body: bodies.d_3 ?? 'Design.' },
  ],
});

const commit = async (message: string) => {
  await sh('git', ['add', '-A'], repo);
  await sh('git', ['commit', '-m', message], repo);
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
};

const write = async (file: string, content: string) => {
  const full = path.join(repo, file);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content);
};

let baseline = '';

beforeAll(async () => {
  if (!gitAvailable) return;
  repo = await fs.mkdtemp(path.join(os.tmpdir(), 'specpad-stale-'));
  await sh('git', ['init', '-b', 'main'], repo);
  await sh('git', ['config', 'user.name', 'Test'], repo);
  await sh('git', ['config', 'user.email', 't@example.com'], repo);

  await write('docs/specpad/acme.sdd.json', JSON.stringify(sdd({}), null, 2));
  await write('src/auth.ts', 'export const auth = 1;\n');
  await write('server/api.ts', 'export const api = 1;\n');
  await write('README.md', 'hello\n');
  baseline = await commit('Seed');
}, 60_000);

afterAll(async () => {
  if (repo) await fs.rm(repo, { recursive: true, force: true }).catch(() => undefined);
});

describe.skipIf(!gitAvailable)('stale-design check', () => {
  it('says nothing when the commit touched no claimed path', async () => {
    await write('README.md', 'hello again\n');
    const sha = await commit('Docs only');

    expect(check(sha).code).toBe(0);
  });

  it('names the file and the section when claimed code changed and the design did not', async () => {
    await write('src/auth.ts', 'export const auth = 2;\n');
    const sha = await commit('Change auth');

    const { code, output } = check(sha);
    expect(code).toBe(1);
    expect(output).toContain('src/auth.ts');
    expect(output).toContain('SDD-1 auth');
    expect(output).toContain('design unchanged');
  });

  it('matches a path claimed as a directory', async () => {
    await write('server/api.ts', 'export const api = 2;\n');
    const sha = await commit('Change the server');

    const { code, output } = check(sha);
    expect(code).toBe(1);
    expect(output).toContain('SDD-2 server');
  });

  it('says nothing when the section was updated in the same commit', async () => {
    await write('src/auth.ts', 'export const auth = 3;\n');
    await write('docs/specpad/acme.sdd.json', JSON.stringify(sdd({ d_1: 'Rewritten design.' }), null, 2));
    const sha = await commit('Change auth and its design');

    expect(check(sha).code).toBe(0);
  });

  it('still reports a section whose code changed while a different section was updated', async () => {
    await write('src/auth.ts', 'export const auth = 4;\n');
    await write('docs/specpad/acme.sdd.json', JSON.stringify(sdd({ d_1: 'Rewritten design.', d_3: 'Unrelated edit.' }), null, 2));
    const sha = await commit('Change auth, edit an unrelated section');

    // d_1's body is unchanged from the previous commit, so it is reported.
    const { code, output } = check(sha);
    expect(code).toBe(1);
    expect(output).toContain('SDD-1 auth');
  });

  it('ignores a section that claims no paths', async () => {
    const { output } = check(baseline);
    expect(output).not.toContain('SDD-3');
  });

  it('says nothing for a project with no detailed design', async () => {
    const bare = await fs.mkdtemp(path.join(os.tmpdir(), 'specpad-nosdd-'));
    await sh('git', ['init', '-b', 'main'], bare);
    await sh('git', ['config', 'user.name', 'Test'], bare);
    await sh('git', ['config', 'user.email', 't@example.com'], bare);
    await fs.mkdir(path.join(bare, 'docs/specpad'), { recursive: true });
    await fs.writeFile(path.join(bare, 'docs/specpad/acme.srs.json'), '{}');
    await fs.writeFile(path.join(bare, 'src.ts'), 'x');
    await sh('git', ['add', '-A'], bare);
    await sh('git', ['commit', '-m', 'Seed'], bare);
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: bare, encoding: 'utf8' }).trim();

    let code = 0;
    try {
      execFileSync('node', [script, sha, 'docs/specpad'], { cwd: bare, stdio: 'pipe' });
    } catch (err) {
      code = (err as { status: number }).status;
    }
    await fs.rm(bare, { recursive: true, force: true }).catch(() => undefined);
    expect(code).toBe(0);
  });
});

describe('the hook installs and calls the check', () => {
  it('ships the script alongside the hook and invokes it', async () => {
    const hook = await fs.readFile(
      fileURLToPath(new URL('../specpad/templates/hooks/pre-push', import.meta.url)),
      'utf8',
    );
    expect(hook).toContain('stale-design.mjs');
    // A warning, never a block: only the author can say whether the design changed.
    expect(hook).toMatch(/design may be out of date/);
    expect(hook).toMatch(/warn=1/);
  });
});
