/**
 * One project's repository: a bare clone, plus one sparse-checked-out worktree per user.
 *
 * Sparse-checkout is a security control here, not an optimization (SRV-3). With the
 * allowlist as the only cone, the tree a user's session can write to physically cannot
 * contain application source, so a path-handling bug has nothing dangerous to reach.
 *
 * A `Repository` belongs to exactly one project (MPT-4). Its clone and its worktrees
 * live under a directory named for that project, so two projects can never share a
 * working copy even for the same user — separation by construction rather than by a
 * check someone has to remember.
 */
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Git, execGitRunner } from './git';
import type { GitRunner } from './git';
import { WorkingCopy } from './workingCopy';
import type { ProjectConfig } from './config';
import type { Principal } from './auth';

/** Where a project's clone and worktrees live under the server's work directory. */
export function projectWorkDir(workDir: string, projectId: string): string {
  return path.join(workDir, 'projects', projectId);
}

/**
 * A filesystem-safe directory name for a principal. Hashed rather than sanitized: an
 * identity string comes from an external provider and must never reach a path directly.
 */
export function worktreeName(principalId: string): string {
  return createHash('sha256').update(principalId).digest('hex').slice(0, 16);
}

export class Repository {
  private readonly runner: GitRunner;
  private readonly bareDir: string;
  private readonly worktreesDir: string;
  /** Serializes provisioning so two concurrent requests cannot race one worktree. */
  private readonly provisioning = new Map<string, Promise<WorkingCopy>>();

  constructor(
    private readonly project: ProjectConfig,
    private readonly workDir: string,
    runner: GitRunner = execGitRunner(),
  ) {
    this.runner = runner;
    this.bareDir = path.join(workDir, 'repo.git');
    this.worktreesDir = path.join(workDir, 'work');
  }

  get id(): string {
    return this.project.id;
  }

  /** The bare clone's directory, for anything that reads the repo without a worktree. */
  get repoDir(): string {
    return this.bareDir;
  }

  private get bare(): Git {
    return new Git(this.runner, this.bareDir);
  }

  /** Clone on first run, fetch thereafter. */
  async ensureClone(): Promise<void> {
    await fs.mkdir(this.workDir, { recursive: true });
    const exists = await fs
      .access(path.join(this.bareDir, 'HEAD'))
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      const git = new Git(this.runner, this.workDir);
      await git.run('clone', '--bare', this.project.repo.url, this.bareDir);
      // A bare clone has no fetch refspec for remote-tracking refs; add one so
      // `origin/<branch>` resolves the way every later command expects.
      await this.bare.run(
        'config',
        'remote.origin.fetch',
        '+refs/heads/*:refs/remotes/origin/*',
      );
    }
    await this.bare.fetch();
  }

  /** This user's working copy, provisioning it on first use (CMT-1). */
  async workingCopyFor(principal: Principal): Promise<WorkingCopy> {
    const dir = path.join(this.worktreesDir, worktreeName(principal.id));
    const inFlight = this.provisioning.get(dir);
    if (inFlight) return inFlight;

    const task = this.provision(dir);
    this.provisioning.set(dir, task);
    try {
      return await task;
    } finally {
      this.provisioning.delete(dir);
    }
  }

  private async provision(dir: string): Promise<WorkingCopy> {
    const ready = await fs
      .access(path.join(dir, '.git'))
      .then(() => true)
      .catch(() => false);

    if (!ready) {
      await fs.mkdir(this.worktreesDir, { recursive: true });
      const branch = `origin/${this.project.repo.branch}`;
      // --no-checkout first: populate nothing until the sparse cone is set, so the
      // full tree never lands on disk even briefly.
      await this.bare.run('worktree', 'add', '--detach', '--no-checkout', dir, branch);
      const tree = new Git(this.runner, dir);
      await tree.run('sparse-checkout', 'init', '--cone');
      await tree.run('sparse-checkout', 'set', ...this.project.repo.paths);
      await tree.run('checkout', '--detach', branch);
    }

    return new WorkingCopy(new Git(this.runner, dir), this.project, dir);
  }

  /** Remove a user's worktree (session cleanup / reaping idle copies). */
  async release(principal: Principal): Promise<void> {
    const dir = path.join(this.worktreesDir, worktreeName(principal.id));
    await this.bare.tryRun('worktree', 'remove', '--force', dir);
    await this.bare.tryRun('worktree', 'prune');
  }
}
