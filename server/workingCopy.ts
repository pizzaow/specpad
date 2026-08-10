/**
 * The per-user working copy (CMT-1, CMT-2) and the commit pipeline (CMT-3..CMT-7).
 *
 * Each user gets their own git worktree, sparse-checked-out to the allowlisted paths.
 * That worktree *is* the draft: autosaved edits live there uncommitted, invisible to
 * everyone else, and `git status` on it is the pending-change set the Commit button
 * reports. Nothing is committed until the user asks.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { mergeDocs, activeJobIds, diffItems } from '../src/shared';
import type { ProjectBundle, SpecPadDoc, SrsDoc, VtpDoc, PrdDoc, ProjectDoc, JobDoc, JobsDoc } from '../src/shared';
import { classifyDocFilename, serializeDocument } from '../src/transports/types';
import type { DocumentListItem } from '../src/transports/types';
import { Git } from './git';
import type { MergeConflict } from '../src/shared';
import type { ProjectConfig } from './config';
import type { Principal } from './auth';
import { resolveInProject } from './paths';
import { checkCommit, buildCommitMessage } from './commitGate';
import type { CommitGateResult } from './commitGate';

export interface CommitOutcome {
  ok: boolean;
  /** The new commit's SHA, when the push succeeded. */
  commit?: string;
  /** Why the commit was refused, if it was. */
  gate?: CommitGateResult;
  /** Conflicts a human must settle (MRG-6). */
  conflicts?: MergeConflict[];
  message?: string;
}

/** One changed file, summarized at item level where the file is a register (CMT-7). */
export interface PendingChange {
  path: string;
  kind: 'register' | 'file';
  /** Item labels (code, falling back to id) — registers only. */
  added?: string[];
  modified?: string[];
  removed?: string[];
}

export interface StatusReport {
  /** Repository-relative paths with pending changes. */
  changed: string[];
  /** True when there is anything to commit. */
  dirty: boolean;
  /** Per-file summary; item-level for registers. */
  diff?: PendingChange[];
}

export class WorkingCopy {
  constructor(
    private readonly git: Git,
    private readonly config: ProjectConfig,
    /** Absolute path to the worktree root. */
    private readonly root: string,
  ) {}

  /** The project directory, relative to the repository root. */
  private get projectDir(): string {
    return this.config.repo.paths[0];
  }

  /** Absolute path for a repository-relative path. */
  private absolute(repoPath: string): string {
    return path.join(this.root, repoPath);
  }

  // ---- Reads ----

  async listDocuments(): Promise<DocumentListItem[]> {
    const dir = this.absolute(this.projectDir);
    const entries = await fs.readdir(dir).catch(() => [] as string[]);
    return entries
      .map(classifyDocFilename)
      .filter((d): d is DocumentListItem => d !== null);
  }

  async projectName(): Promise<string> {
    const documents = await this.listDocuments();
    const proj = documents.find((d) => d.type === 'proj');
    return proj ? proj.name : (documents[0]?.name ?? '');
  }

  /** Read a JSON file addressed relative to the project directory; null when absent. */
  async readJson(clientPath: string[] | string): Promise<SpecPadDoc | null> {
    const text = await this.readText(clientPath);
    return text === null ? null : (JSON.parse(text) as SpecPadDoc);
  }

  async readText(clientPath: string[] | string): Promise<string | null> {
    const repoPath = resolveInProject(this.projectDir, clientPath);
    try {
      return await fs.readFile(this.absolute(repoPath), 'utf8');
    } catch {
      return null;
    }
  }

  /** Write a file into the working copy. No commit — this is the autosave path (CMT-2). */
  async writeText(clientPath: string[] | string, content: string): Promise<void> {
    const repoPath = resolveInProject(this.projectDir, clientPath);
    const absolute = this.absolute(repoPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, 'utf8');
  }

  async writeDoc(doc: SpecPadDoc): Promise<void> {
    const kind = doc.type === 'project' ? 'proj' : doc.type;
    await this.writeText([`${doc.name}.${kind}.json`], serializeDocument(doc));
  }

  /** Pending changes, confined to the allowlist (the Commit badge). */
  async status(): Promise<StatusReport> {
    const changed = (await this.git.changedPaths()).filter((p) =>
      this.config.repo.paths.some((root) => p === root || p.startsWith(`${root}/`)),
    );
    return { changed, dirty: changed.length > 0 };
  }

  /**
   * The pending change set, summarized at item level (CMT-7).
   *
   * "3 files changed" tells a product manager nothing; "REQ-14 modified, REQ-22 added"
   * is the thing they are actually about to publish. Computed against HEAD with the
   * same id-keyed diff the editor's redline uses.
   */
  async pendingDiff(): Promise<PendingChange[]> {
    const { changed } = await this.status();
    const changes: PendingChange[] = [];

    for (const repoPath of changed) {
      if (!isSpecPadRegister(repoPath)) {
        changes.push({ path: repoPath, kind: 'file' });
        continue;
      }
      const [headText, currentText] = await Promise.all([
        this.git.showFile('HEAD', repoPath),
        fs.readFile(this.absolute(repoPath), 'utf8').catch(() => null),
      ]);
      const before = itemsOf(headText);
      const after = itemsOf(currentText);
      if (before === null || after === null) {
        changes.push({ path: repoPath, kind: 'file' });
        continue;
      }
      const diff = diffItems(before, after);
      changes.push({
        path: repoPath,
        kind: 'register',
        added: diff.added.map((c) => label(c.after)),
        modified: diff.modified.map((c) => label(c.after)),
        removed: diff.removed.map((c) => label(c.before)),
      });
    }

    return changes;
  }

  /** Assemble the whole project for the governance check. */
  async bundle(): Promise<ProjectBundle> {
    const name = await this.projectName();
    if (!name) return {};
    const read = async (suffix: string) => this.readJson([`${name}.${suffix}.json`]);
    const [project, srs, vtp, prd, job, jobs] = await Promise.all([
      read('proj'),
      read('srs'),
      read('vtp'),
      read('prd'),
      read('job'),
      read('jobs'),
    ]);
    return {
      project: project as ProjectDoc | null,
      srs: srs as SrsDoc | null,
      vtp: vtp as VtpDoc | null,
      prd: prd as PrdDoc | null,
      job: job as JobDoc | null,
      jobs: jobs as JobsDoc | null,
    };
  }

  // ---- The commit pipeline (CMT-3..CMT-6) ----

  async publish(principal: Principal, subject: string): Promise<CommitOutcome> {
    const { changed } = await this.status();
    if (changed.length === 0) {
      return { ok: false, message: 'There is nothing to commit.' };
    }

    // 1. Gate: structural validity, governance, attribution, path confinement.
    const bundle = await this.bundle();
    const gate = checkCommit({
      changed: await this.changedDocuments(changed),
      bundle,
      stagedPaths: changed,
      allowlist: this.config.repo.paths,
      activeJobs: activeJobIds(bundle.job),
      policy: this.config.commit,
    });
    if (!gate.ok) return { ok: false, gate };

    // 2. Commit as the human (AUTH-6, CMT-5).
    await this.git.stage(this.config.repo.paths);
    const message = buildCommitMessage(subject, activeJobIds(bundle.job));
    await this.git.commit(message, { name: principal.displayName, email: principal.email });

    // 3. Rebase and push, retrying a bounded number of times (CMT-6).
    return this.rebaseAndPush(gate);
  }

  private async rebaseAndPush(gate: CommitGateResult): Promise<CommitOutcome> {
    const { branch } = this.config.repo;
    const attempts = this.config.commit.pushRetries + 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      await this.git.fetch();
      const rebase = await this.git.rebase(`origin/${branch}`);

      if (rebase.code !== 0) {
        const conflicts = await this.resolveConflicts();
        if (conflicts.length > 0) {
          // A human must settle these. Leave the branch clean rather than half-rebased.
          await this.git.rebaseAbort();
          return { ok: false, conflicts, gate };
        }
        const continued = await this.git.rebaseContinue();
        if (continued.code !== 0) {
          await this.git.rebaseAbort();
          return {
            ok: false,
            message: `The rebase could not be completed automatically: ${continued.stderr.trim()}`,
            gate,
          };
        }
      }

      if (await this.git.push('origin', branch)) {
        return { ok: true, commit: await this.git.currentCommit(), gate };
      }
      // Non-fast-forward: someone pushed between our fetch and our push. Go round again.
    }

    return {
      ok: false,
      message:
        `The branch kept moving while publishing (gave up after ${attempts} attempts). ` +
        'Nothing was force-pushed; try again.',
      gate,
    };
  }

  /**
   * Resolve every conflicted SpecPad document structurally (MRG-5). Returns the
   * conflicts a human must settle; an empty result means the rebase can continue.
   */
  private async resolveConflicts(): Promise<MergeConflict[]> {
    const unresolved: MergeConflict[] = [];

    for (const repoPath of await this.git.conflictedPaths()) {
      if (!isSpecPadRegister(repoPath)) {
        // A non-register file (a diagram, the SAD) has no structural merge; a human
        // settles it. Reported as a whole-file conflict.
        unresolved.push({
          itemId: null,
          kind: 'field',
          field: repoPath,
          base: undefined,
          ours: undefined,
          theirs: undefined,
        });
        continue;
      }

      const sides = await this.git.conflictedFile(repoPath);
      if (!sides.base || !sides.ours || !sides.theirs) {
        unresolved.push({ itemId: null, kind: 'field', field: repoPath });
        continue;
      }

      const merged = mergeDocs(
        JSON.parse(sides.base),
        JSON.parse(sides.ours),
        JSON.parse(sides.theirs),
      );
      if (!merged.clean) {
        unresolved.push(...merged.conflicts);
        continue;
      }

      // Clean structural merge: write it back and stage it. A textual merge would have
      // produced conflict markers inside the JSON (MRG-5).
      await fs.writeFile(this.absolute(repoPath), serializeDocument(merged.doc), 'utf8');
      await this.git.stage([repoPath]);
    }

    return unresolved;
  }

  /** Read every changed document back for structural validation. */
  private async changedDocuments(
    changed: string[],
  ): Promise<{ path: string; doc: unknown }[]> {
    const documents: { path: string; doc: unknown }[] = [];
    for (const repoPath of changed) {
      if (!isSpecPadDocument(repoPath)) continue;
      try {
        const text = await fs.readFile(this.absolute(repoPath), 'utf8');
        documents.push({ path: repoPath, doc: JSON.parse(text) });
      } catch (err) {
        documents.push({ path: repoPath, doc: { __unreadable: String(err) } });
      }
    }
    return documents;
  }

  /** Throw away this user's pending changes without touching anyone else's (CMT-7). */
  async discard(): Promise<void> {
    await this.git.discard(this.config.repo.paths);
  }
}

/** A register's items, or null when the text is missing or not a parseable register. */
function itemsOf(text: string | null): { id: string; code?: string }[] | null {
  if (text === null) return null;
  try {
    const items = (JSON.parse(text) as { items?: unknown }).items;
    return Array.isArray(items) ? (items as { id: string; code?: string }[]) : null;
  } catch {
    return null;
  }
}

/** How a row is named to a human: its code where it has one, else its stable id. */
function label(item: { id: string; code?: string } | undefined): string {
  if (!item) return '(unknown)';
  return item.code ?? item.id;
}

/** A register document the structural merge understands (srs/vtp/prd). */
export function isSpecPadRegister(repoPath: string): boolean {
  return /\.(srs|vtp|prd)\.json$/.test(repoPath);
}

/** Any SpecPad document, including the project index and sidecars. */
export function isSpecPadDocument(repoPath: string): boolean {
  return classifyDocFilename(path.posix.basename(repoPath.replace(/\\/g, '/'))) !== null;
}
