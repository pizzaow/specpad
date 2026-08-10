/**
 * The projects a server hosts, and the per-project runtime each one needs (MPT-1).
 *
 * Everything that was a single object when the server hosted one repository — the
 * clone, the presence registry, the event bus, the branch watcher — becomes one per
 * project. That is deliberate rather than incidental: presence and the upstream-moved
 * signal are only meaningful within a project, and a broadcast that crossed projects
 * would wake people about a branch they are not editing (MPT-8).
 */
import { Repository, projectWorkDir } from './repository';
import { PresenceRegistry } from './presence';
import { EventBus } from './events';
import { BranchWatcher } from './branchWatcher';
import { execGitRunner } from './git';
import type { GitRunner } from './git';
import type { ProjectConfig, ServerConfig, WorkingCopyConfig } from './config';

export interface ProjectRuntime {
  project: ProjectConfig;
  repository: Repository;
  presence: PresenceRegistry;
  events: EventBus;
  watcher: BranchWatcher;
}

export class ProjectRegistry {
  private readonly runtimes = new Map<string, ProjectRuntime>();
  readonly workingCopies: WorkingCopyConfig;

  constructor(config: ServerConfig, runner: GitRunner = execGitRunner()) {
    this.workingCopies = config.workingCopies;
    for (const project of config.projects) {
      const repository = new Repository(
        project,
        projectWorkDir(config.workDir, project.id),
        runner,
      );
      this.runtimes.set(project.id, {
        project,
        repository,
        presence: new PresenceRegistry(),
        events: new EventBus(),
        watcher: new BranchWatcher(runner, repository.repoDir, project.repo.branch),
      });
    }
  }

  get(id: string): ProjectRuntime | null {
    return this.runtimes.get(id) ?? null;
  }

  list(): ProjectRuntime[] {
    return [...this.runtimes.values()];
  }

  /** The only project, when there is exactly one — see `parseApiPath` (MPT-3). */
  sole(): ProjectRuntime | null {
    return this.runtimes.size === 1 ? this.list()[0] : null;
  }

  /**
   * Clone or fetch every project at startup. One unreachable repository must not stop
   * the others from being served, so failures are collected and reported rather than
   * thrown — a six-project server whose fourth repository is down still serves five.
   */
  async ensureClones(): Promise<{ id: string; error: Error }[]> {
    const failures: { id: string; error: Error }[] = [];
    for (const runtime of this.list()) {
      try {
        await runtime.repository.ensureClone();
      } catch (err) {
        failures.push({
          id: runtime.project.id,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }
    return failures;
  }

  /** Expire stale presence claims and poll for upstream movement, per project (MPT-8). */
  async tick(now: number): Promise<void> {
    for (const { project, presence, events, watcher } of this.list()) {
      if (presence.sweep(now)) events.broadcast('presence', presence.list(now));
      const moved = await watcher.check().catch(() => null);
      if (moved) events.broadcast('upstream', { sha: moved, branch: project.repo.branch });
    }
  }

  /**
   * Remove working copies idle past the configured timeout, across every project
   * (WCL-1). Returns the number removed so the caller can log it.
   */
  async reapIdle(now: number): Promise<number> {
    let reaped = 0;
    for (const { repository } of this.list()) {
      reaped += await repository.reapIdle(now, this.workingCopies.idleTimeout).catch(() => 0);
    }
    return reaped;
  }

  closeAll(): void {
    for (const { events } of this.list()) events.closeAll();
  }
}
