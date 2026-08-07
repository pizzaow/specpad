// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { Repository, worktreeName } from '../repository';
import { Git, execGitRunner } from '../git';
import { validateConfig } from '../config';
import type { ServerConfig } from '../config';
import type { Principal } from '../auth';
import type { SrsDoc, VtpDoc } from '../../src/shared';

/**
 * The git pipeline against a real repository (SRV-3, CMT-1, CMT-5, CMT-6, MRG-5).
 *
 * Everything else in the server is a pure function with a fast unit test. This is the
 * part that actually touches someone's repository, so it is the part worth proving with
 * real git: sparse checkouts that cannot see application source, two users who cannot
 * see each other's drafts, a rebase that merges two people's edits structurally, and a
 * conflict that leaves the branch untouched rather than forcing anything.
 */

function sh(cmd: string, args: string[], cwd: string): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd }, (error, stdout) =>
      resolve({ code: error ? 1 : 0, stdout: stdout ?? '' }),
    );
  });
}

const gitAvailable = (await sh('git', ['--version'], os.tmpdir())).code === 0;

const srs: SrsDoc = {
  schemaVersion: '1.0',
  type: 'srs',
  name: 'acme',
  title: 'Requirements',
  items: [
    { id: 'r_1', code: 'REQ-1', text: 'The system shall store records.', tags: ['data'] },
    { id: 'r_2', code: 'REQ-2', text: 'The system shall retain records for 7 years.' },
  ],
};

const vtp: VtpDoc = {
  schemaVersion: '1.0',
  type: 'vtp',
  name: 'acme',
  title: 'Tests',
  items: [
    { id: 't_1', text: 'Confirm records are stored.', verifies: ['r_1'], expected: 'Stored.' },
    { id: 't_2', text: 'Confirm retention.', verifies: ['r_2'], expected: 'Retained 7 years.' },
  ],
};

const jobs = {
  schemaVersion: '1.0',
  type: 'jobs',
  name: 'acme',
  jobs: [{ id: 'j_1', code: 'JOB-1', title: 'Clarify retention', status: 'open' }],
};

const jobMarker = { schemaVersion: '1.0', type: 'job', jobs: ['j_1'] };

const json = (doc: unknown) => JSON.stringify(doc, null, 2) + '\n';

const jane: Principal = {
  id: 'jane',
  displayName: 'Jane Smith',
  email: 'jane@corp.example',
  groups: [],
};
const kim: Principal = {
  id: 'kim',
  displayName: 'Kim Patel',
  email: 'kim@corp.example',
  groups: [],
};

let root = '';
let originDir = '';
let config: ServerConfig;

async function seedOrigin(): Promise<void> {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'specpad-it-'));
  originDir = path.join(root, 'origin.git');
  await sh('git', ['init', '--bare', '-b', 'main', originDir], root);

  const seed = path.join(root, 'seed');
  await sh('git', ['clone', originDir, seed], root);
  await sh('git', ['config', 'user.name', 'Seed'], seed);
  await sh('git', ['config', 'user.email', 'seed@example.com'], seed);

  await fs.mkdir(path.join(seed, 'docs', 'specpad'), { recursive: true });
  await fs.mkdir(path.join(seed, 'src'), { recursive: true });
  const spec = (name: string) => path.join(seed, 'docs', 'specpad', name);
  await fs.writeFile(spec('acme.srs.json'), json(srs));
  await fs.writeFile(spec('acme.vtp.json'), json(vtp));
  await fs.writeFile(spec('acme.jobs.json'), json(jobs));
  await fs.writeFile(spec('acme.job.json'), json(jobMarker));
  await fs.writeFile(
    spec('acme.proj.json'),
    json({ schemaVersion: '1.0', type: 'project', name: 'acme', title: 'Acme', documents: [] }),
  );
  // Application source, which the server must never be able to see or write.
  await fs.writeFile(path.join(seed, 'src', 'index.ts'), 'export const secret = 42;\n');

  await sh('git', ['add', '-A'], seed);
  await sh('git', ['commit', '-m', 'Seed the project'], seed);
  await sh('git', ['push', 'origin', 'main'], seed);
}

/** Read a file from the branch tip in the origin repository. */
async function originFile(file: string): Promise<string | null> {
  return new Git(execGitRunner(), originDir).showFile('main', `docs/specpad/${file}`);
}

async function originLog(): Promise<string> {
  const { stdout } = await sh('git', ['log', '--format=%an <%ae>%n%B%n---', 'main'], originDir);
  return stdout;
}

beforeEach(async () => {
  await seedOrigin();
  const { config: c, errors } = validateConfig({
    repo: { url: originDir, branch: 'main', paths: ['docs/specpad'] },
    auth: { provider: 'dev', roles: {} },
    commit: { requireActiveJob: true, requireGovernanceClean: 'block', pushRetries: 3 },
    workDir: path.join(root, 'srv'),
    bind: '127.0.0.1',
  });
  if (!c) throw new Error(`bad test config: ${errors.join(', ')}`);
  config = c;
});

afterEach(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true }).catch(() => undefined);
});

describe.skipIf(!gitAvailable)('Repository — provisioning (SRV-3, CMT-1)', () => {
  it('sparse-checks-out only the allowlisted paths, so source is physically absent', async () => {
    const repository = new Repository(config);
    await repository.ensureClone();
    const wc = await repository.workingCopyFor(jane);

    const dir = path.join(config.workDir, 'work', worktreeName(jane.id));
    const spec = await fs.stat(path.join(dir, 'docs', 'specpad')).catch(() => null);
    const src = await fs.stat(path.join(dir, 'src')).catch(() => null);

    expect(spec?.isDirectory()).toBe(true);
    expect(src).toBeNull();
    expect(await wc.projectName()).toBe('acme');
  });

  it('gives each user their own working copy, invisible to the other', async () => {
    const repository = new Repository(config);
    await repository.ensureClone();
    const janeCopy = await repository.workingCopyFor(jane);
    const kimCopy = await repository.workingCopyFor(kim);

    await janeCopy.writeDoc({ ...srs, title: "Jane's draft" });

    expect((await janeCopy.readJson(['acme.srs.json']) as SrsDoc).title).toBe("Jane's draft");
    expect((await kimCopy.readJson(['acme.srs.json']) as SrsDoc).title).toBe('Requirements');
    expect((await kimCopy.status()).dirty).toBe(false);
  });

  it('does not name a worktree directory after the raw principal id', async () => {
    // Identity strings come from an external provider and must never reach a path.
    expect(worktreeName('../../etc/passwd')).toMatch(/^[0-9a-f]{16}$/);
    expect(worktreeName('jane')).not.toContain('jane');
  });
});

describe.skipIf(!gitAvailable)('Repository — status and the pending diff (CMT-2, CMT-7)', () => {
  it('reports an autosaved edit as pending, without committing it', async () => {
    const repository = new Repository(config);
    await repository.ensureClone();
    const wc = await repository.workingCopyFor(jane);

    const edited = {
      ...srs,
      items: [
        { ...srs.items[0], text: 'The system shall store records durably.' },
        srs.items[1],
        { id: 'r_3', code: 'REQ-3', text: 'A new requirement.' },
      ],
    };
    await wc.writeDoc(edited);

    const status = await wc.status();
    expect(status.dirty).toBe(true);
    expect(status.changed).toEqual(['docs/specpad/acme.srs.json']);
    // Nothing reached the repository.
    expect(await originLog()).not.toContain('REQ-3');

    const diff = await wc.pendingDiff();
    expect(diff).toEqual([
      {
        path: 'docs/specpad/acme.srs.json',
        kind: 'register',
        added: ['REQ-3'],
        modified: ['REQ-1'],
        removed: [],
      },
    ]);
  });
});

describe.skipIf(!gitAvailable)('Repository — publishing (CMT-3, CMT-5, AUTH-6)', () => {
  it('commits as the human, with a Job trailer, and pushes to the branch', async () => {
    const repository = new Repository(config);
    await repository.ensureClone();
    const wc = await repository.workingCopyFor(jane);

    await wc.writeDoc({
      ...srs,
      items: [srs.items[0], { ...srs.items[1], text: 'The system shall retain records for 10 years.' }],
    });
    const outcome = await wc.publish(jane, 'Clarify the retention period');

    expect(outcome.ok).toBe(true);
    expect(outcome.commit).toMatch(/^[0-9a-f]{40}$/);

    const log = await originLog();
    expect(log).toContain('Jane Smith <jane@corp.example>');
    expect(log).toContain('Clarify the retention period');
    expect(log).toContain('Job: j_1');

    const published = JSON.parse((await originFile('acme.srs.json'))!) as SrsDoc;
    expect(published.items[1].text).toBe('The system shall retain records for 10 years.');
  });

  it('refuses to publish a change that breaks governance, and pushes nothing', async () => {
    const repository = new Repository(config);
    await repository.ensureClone();
    const wc = await repository.workingCopyFor(jane);

    // An unverified requirement: no VTP test references r_9.
    await wc.writeDoc({ ...srs, items: [...srs.items, { id: 'r_9', code: 'REQ-9', text: 'Unverified.' }] });
    const outcome = await wc.publish(jane, 'Add a requirement');

    expect(outcome.ok).toBe(false);
    expect(outcome.gate?.blocked.join('\n')).toMatch(/traceability/);
    expect(await originLog()).not.toContain('Add a requirement');
  });

  it('refuses to publish with no active job when policy requires one', async () => {
    const repository = new Repository(config);
    await repository.ensureClone();
    const wc = await repository.workingCopyFor(jane);

    await wc.writeText(['acme.job.json'], json({ schemaVersion: '1.0', type: 'job', jobs: [] }));
    await wc.writeDoc({ ...srs, title: 'Retitled' });
    const outcome = await wc.publish(jane, 'Retitle');

    expect(outcome.ok).toBe(false);
    expect(outcome.gate?.blocked.join('\n')).toMatch(/No active job/);
  });

  it('says there is nothing to commit rather than making an empty commit', async () => {
    const repository = new Repository(config);
    await repository.ensureClone();
    const wc = await repository.workingCopyFor(jane);

    const outcome = await wc.publish(jane, 'Nothing');

    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(/nothing to commit/i);
  });
});

describe.skipIf(!gitAvailable)('Repository — concurrent editors (CMT-6, MRG-5)', () => {
  it('merges two people editing different requirements, with no conflict', async () => {
    const repository = new Repository(config);
    await repository.ensureClone();
    const janeCopy = await repository.workingCopyFor(jane);
    const kimCopy = await repository.workingCopyFor(kim);

    // Both start from the same base and edit different items.
    await janeCopy.writeDoc({
      ...srs,
      items: [{ ...srs.items[0], text: 'The system shall store records durably.' }, srs.items[1]],
    });
    await kimCopy.writeDoc({
      ...srs,
      items: [srs.items[0], { ...srs.items[1], text: 'The system shall retain records for 10 years.' }],
    });

    expect((await janeCopy.publish(jane, "Jane's edit")).ok).toBe(true);
    // Kim's push is now behind: it must rebase onto Jane's commit and merge structurally.
    const kimOutcome = await kimCopy.publish(kim, "Kim's edit");

    expect(kimOutcome.conflicts ?? []).toEqual([]);
    expect(kimOutcome.ok).toBe(true);

    // Both edits survive — the whole point of merging on stable item ids.
    const published = JSON.parse((await originFile('acme.srs.json'))!) as SrsDoc;
    expect(published.items.find((i) => i.id === 'r_1')!.text).toBe(
      'The system shall store records durably.',
    );
    expect(published.items.find((i) => i.id === 'r_2')!.text).toBe(
      'The system shall retain records for 10 years.',
    );

    const log = await originLog();
    expect(log).toContain("Jane's edit");
    expect(log).toContain("Kim's edit");
    expect(log).toContain('Kim Patel <kim@corp.example>');
  });

  it('reports a conflict when two people rewrite the same field, and pushes nothing', async () => {
    const repository = new Repository(config);
    await repository.ensureClone();
    const janeCopy = await repository.workingCopyFor(jane);
    const kimCopy = await repository.workingCopyFor(kim);

    await janeCopy.writeDoc({
      ...srs,
      items: [srs.items[0], { ...srs.items[1], text: 'Retain records for 10 years.' }],
    });
    await kimCopy.writeDoc({
      ...srs,
      items: [srs.items[0], { ...srs.items[1], text: 'Retain records for 25 years.' }],
    });

    expect((await janeCopy.publish(jane, "Jane's edit")).ok).toBe(true);
    const kimOutcome = await kimCopy.publish(kim, "Kim's edit");

    expect(kimOutcome.ok).toBe(false);
    expect(kimOutcome.conflicts).toEqual([
      expect.objectContaining({ itemId: 'r_2', kind: 'field', field: 'text' }),
    ]);

    // Jane's version still stands; nothing was forced over it.
    const published = JSON.parse((await originFile('acme.srs.json'))!) as SrsDoc;
    expect(published.items.find((i) => i.id === 'r_2')!.text).toBe('Retain records for 10 years.');
    expect(await originLog()).not.toContain("Kim's edit");
  });

  it('never leaves conflict markers in a document, whatever happens', async () => {
    const repository = new Repository(config);
    await repository.ensureClone();
    const janeCopy = await repository.workingCopyFor(jane);
    const kimCopy = await repository.workingCopyFor(kim);

    await janeCopy.writeDoc({
      ...srs,
      items: [srs.items[0], { ...srs.items[1], text: 'Ten years.' }],
    });
    await kimCopy.writeDoc({
      ...srs,
      items: [srs.items[0], { ...srs.items[1], text: 'Twenty-five years.' }],
    });
    await janeCopy.publish(jane, "Jane's edit");
    await kimCopy.publish(kim, "Kim's edit");

    const onBranch = (await originFile('acme.srs.json'))!;
    expect(onBranch).not.toContain('<<<<<<<');
    expect(() => JSON.parse(onBranch)).not.toThrow();

    // Kim's own copy is left usable, not stranded mid-rebase.
    const kimCopyText = await kimCopy.readText(['acme.srs.json']);
    expect(kimCopyText).not.toContain('<<<<<<<');
  });
});

describe.skipIf(!gitAvailable)('Repository — discard (CMT-7)', () => {
  it('reverts one user without touching another', async () => {
    const repository = new Repository(config);
    await repository.ensureClone();
    const janeCopy = await repository.workingCopyFor(jane);
    const kimCopy = await repository.workingCopyFor(kim);

    await janeCopy.writeDoc({ ...srs, title: "Jane's draft" });
    await kimCopy.writeDoc({ ...srs, title: "Kim's draft" });

    await janeCopy.discard();

    expect((await janeCopy.status()).dirty).toBe(false);
    expect((await janeCopy.readJson(['acme.srs.json']) as SrsDoc).title).toBe('Requirements');
    expect((await kimCopy.status()).dirty).toBe(true);
    expect((await kimCopy.readJson(['acme.srs.json']) as SrsDoc).title).toBe("Kim's draft");
  });
});
