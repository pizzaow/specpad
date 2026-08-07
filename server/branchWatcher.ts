/**
 * Watches the target branch for movement (CE-3).
 *
 * `git ls-remote` asks the remote for one ref and transfers no objects, so polling it
 * is cheap enough to do on a timer without a webhook — which matters, because a
 * self-hosted deployment may not be reachable from the git host at all.
 *
 * The timer lives outside: `check()` is a plain async call, so the interesting
 * behaviour (first observation is not a change; a failed poll is not a change) is
 * testable without waiting on wall-clock time.
 */
import type { GitRunner } from './git';

export const DEFAULT_WATCH_INTERVAL_MS = 20_000;

export class BranchWatcher {
  private lastSha: string | null = null;

  constructor(
    private readonly runner: GitRunner,
    private readonly repoDir: string,
    private readonly branch: string,
    private readonly remote = 'origin',
  ) {}

  get currentSha(): string | null {
    return this.lastSha;
  }

  /**
   * Poll the remote. Returns the new SHA when the branch has moved since the last
   * successful observation, or null.
   *
   * The first observation only records the SHA: a server that has just started has not
   * witnessed a change, and announcing one would tell every open editor to reload for
   * no reason.
   */
  async check(): Promise<string | null> {
    const result = await this.runner(
      ['ls-remote', '--exit-code', this.remote, `refs/heads/${this.branch}`],
      this.repoDir,
    );
    if (result.code !== 0) return null; // an unreachable remote is not a change

    const sha = result.stdout.trim().split(/\s+/)[0];
    if (!/^[0-9a-f]{40}$/.test(sha ?? '')) return null;

    const previous = this.lastSha;
    this.lastSha = sha;
    return previous !== null && previous !== sha ? sha : null;
  }
}
