/**
 * The git layer — plumbing only, no SpecPad knowledge.
 *
 * Every command runs through an injectable `GitRunner`, so the interesting behaviour
 * (the bounded push retry, the conflict-stage mapping) is unit-testable without a real
 * repository. Nothing here force-pushes, and nothing here decides policy.
 */
import { execFile } from 'node:child_process';

export interface GitResult {
  stdout: string;
  stderr: string;
  code: number;
}

export type GitRunner = (args: string[], cwd: string) => Promise<GitResult>;

export class GitError extends Error {
  constructor(
    message: string,
    readonly result: GitResult,
  ) {
    super(message);
    this.name = 'GitError';
  }
}

/** The real runner: `git` as a child process, never a shell (no injection surface). */
export function execGitRunner(): GitRunner {
  return (args, cwd) =>
    new Promise((resolve) => {
      execFile('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          code: error ? ((error as NodeJS.ErrnoException & { code?: number }).code ?? 1) : 0,
        });
      });
    });
}

export interface CommitIdentity {
  name: string;
  email: string;
}

/** A file left conflicted by a rebase, with all three sides as raw text. */
export interface ConflictedFile {
  path: string;
  /** The common ancestor (index stage 1). */
  base: string | null;
  /** The user's own version (index stage 3 during a rebase — see `conflictedFile`). */
  ours: string | null;
  /** What is already on the branch (index stage 2 during a rebase). */
  theirs: string | null;
}

export class Git {
  constructor(
    private readonly runner: GitRunner,
    readonly cwd: string,
  ) {}

  /** Run a git command, throwing on a non-zero exit. */
  async run(...args: string[]): Promise<string> {
    const result = await this.runner(args, this.cwd);
    if (result.code !== 0) {
      throw new GitError(`git ${args.join(' ')} failed: ${result.stderr.trim()}`, result);
    }
    return result.stdout;
  }

  /** Run a git command, returning the raw result so the caller can inspect failure. */
  async tryRun(...args: string[]): Promise<GitResult> {
    return this.runner(args, this.cwd);
  }

  at(cwd: string): Git {
    return new Git(this.runner, cwd);
  }

  // ---- Reads ----

  /** Repository-relative paths with staged or unstaged changes, plus untracked files. */
  async changedPaths(): Promise<string[]> {
    const out = await this.run('status', '--porcelain=v1', '-z', '--untracked-files=all');
    return out
      .split('\0')
      .filter(Boolean)
      // Porcelain v1 -z: "XY <path>", and a rename adds a second NUL-separated path we
      // do not need here (the new name is what matters and comes first).
      .map((entry) => entry.slice(3))
      .filter(Boolean);
  }

  async currentCommit(): Promise<string> {
    return (await this.run('rev-parse', 'HEAD')).trim();
  }

  /** File content at a ref, or null when the path does not exist there. */
  async showFile(ref: string, path: string): Promise<string | null> {
    const result = await this.tryRun('show', `${ref}:${path}`);
    return result.code === 0 ? result.stdout : null;
  }

  /** Paths left conflicted by a rebase or merge. */
  async conflictedPaths(): Promise<string[]> {
    const out = await this.run('diff', '--name-only', '--diff-filter=U', '-z');
    return out.split('\0').filter(Boolean);
  }

  /**
   * The three sides of a conflicted file, read from the index stages.
   *
   * During a *rebase* git replays your commit onto the upstream branch, so the labels
   * inside the index are inverted relative to how a user thinks about it: stage 2
   * ("ours") is the upstream branch, and stage 3 ("theirs") is the commit being
   * replayed — the user's own work. We return them the way the user means them.
   */
  async conflictedFile(path: string): Promise<ConflictedFile> {
    const [base, upstream, mine] = await Promise.all([
      this.showFile(':1', path),
      this.showFile(':2', path),
      this.showFile(':3', path),
    ]);
    return { path, base, ours: mine, theirs: upstream };
  }

  // ---- Writes ----

  async fetch(remote = 'origin'): Promise<void> {
    await this.run('fetch', '--prune', remote);
  }

  /** Stage the allowlisted paths only — never `git add -A`. */
  async stage(paths: string[]): Promise<void> {
    await this.run('add', '--', ...paths);
  }

  async commit(message: string, author: CommitIdentity): Promise<string> {
    await this.run(
      '-c',
      `user.name=${author.name}`,
      '-c',
      `user.email=${author.email}`,
      'commit',
      '--author',
      `${author.name} <${author.email}>`,
      '-m',
      message,
    );
    return this.currentCommit();
  }

  async rebase(onto: string): Promise<GitResult> {
    return this.tryRun('rebase', onto);
  }

  async rebaseContinue(): Promise<GitResult> {
    // -c core.editor=true: never open an editor in a headless process.
    return this.tryRun('-c', 'core.editor=true', 'rebase', '--continue');
  }

  async rebaseAbort(): Promise<void> {
    await this.tryRun('rebase', '--abort');
  }

  async resetHard(ref: string): Promise<void> {
    await this.run('reset', '--hard', ref);
  }

  /** Discard all working-tree changes under the given paths (CMT-7). */
  async discard(paths: string[]): Promise<void> {
    await this.run('checkout', '--', ...paths);
    await this.run('clean', '-fd', '--', ...paths);
  }

  /**
   * Push, never with force. Returns false when the remote rejected it as non-fast-forward,
   * so the caller can rebase and retry (CMT-6).
   */
  async push(remote: string, branch: string): Promise<boolean> {
    const result = await this.tryRun('push', remote, `HEAD:${branch}`);
    if (result.code === 0) return true;
    if (isNonFastForward(result)) return false;
    throw new GitError(`git push failed: ${result.stderr.trim()}`, result);
  }
}

/** Did the remote reject this push because the branch moved under us? */
export function isNonFastForward(result: GitResult): boolean {
  const text = `${result.stdout}\n${result.stderr}`.toLowerCase();
  return (
    text.includes('non-fast-forward') ||
    text.includes('fetch first') ||
    text.includes('rejected') ||
    text.includes('behind its remote counterpart')
  );
}
