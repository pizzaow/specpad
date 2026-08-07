/**
 * The commit gate (CMT-4, CMT-5) — everything that must be true before the server
 * touches the repository, decided as a pure function so it is fully testable without
 * git.
 *
 * The client is not trusted. Governance runs here, on the server, using the same
 * `checkGovernance` the editor and the skill run (SRV-5) — a browser can be bypassed,
 * this cannot. For a PM who will never run `npm test`, this gate *is* the dogfood rule.
 */
import { validate, checkGovernance } from '../src/shared';
import type { ProjectBundle, GovernanceViolation } from '../src/shared';
import type { CommitConfig } from './config';
import { offendingPaths } from './paths';

export interface ChangedDocument {
  /** Repository-relative path, for the message. */
  path: string;
  doc: unknown;
}

export interface CommitGateInput {
  /** Every document the commit would change, for structural validation. */
  changed: ChangedDocument[];
  /** The whole project as it would be after the commit, for governance. */
  bundle: ProjectBundle;
  /** Repository-relative paths the commit would stage. */
  stagedPaths: string[];
  allowlist: string[];
  activeJobs: string[];
  policy: CommitConfig;
}

export interface CommitGateResult {
  /** Whether the commit may proceed. */
  ok: boolean;
  /** Reasons the commit is refused. */
  blocked: string[];
  /** Problems reported but not fatal under the configured policy. */
  warnings: string[];
  governance: GovernanceViolation[];
}

/** Decide whether a commit may proceed, and why not (CMT-4). */
export function checkCommit(input: CommitGateInput): CommitGateResult {
  const blocked: string[] = [];
  const warnings: string[] = [];

  // 1. Path confinement. The sparse checkout should have made this impossible, so a
  //    hit here means something is wrong enough to refuse regardless of policy (SRV-2).
  const offending = offendingPaths(input.allowlist, input.stagedPaths);
  for (const path of offending) {
    blocked.push(`"${path}" is outside the allowlisted paths and may not be committed.`);
  }

  // 2. Structural validity. Never negotiable: an invalid document is never committed.
  for (const { path, doc } of input.changed) {
    for (const error of validate(doc)) {
      const where = error.path ? ` at ${error.path}` : '';
      blocked.push(`${path} is not a valid SpecPad document${where}: ${error.message}`);
    }
  }

  // 3. An active job, so the change is attributable (CMT-5).
  if (input.policy.requireActiveJob && input.activeJobs.length === 0) {
    blocked.push(
      'No active job is set. Choose the job this change belongs to before committing.',
    );
  }

  // 4. Governance, at the strictness the operator configured.
  let governance: GovernanceViolation[] = [];
  if (input.policy.requireGovernanceClean !== 'off') {
    governance = checkGovernance(input.bundle);
    const messages = governance.map((v) => `${v.rule}: ${v.message}`);
    if (input.policy.requireGovernanceClean === 'block') blocked.push(...messages);
    else warnings.push(...messages);
  }

  return { ok: blocked.length === 0, blocked, warnings, governance };
}

/**
 * Build the commit message, appending one `Job: <id>` trailer per active job.
 *
 * Trailers must sit in one unbroken block at the end or git will not parse them, and
 * the whole change-attribution model (jobs → commits → source) reads them back out.
 */
export function buildCommitMessage(subject: string, activeJobs: string[]): string {
  const body = subject.trimEnd();
  if (activeJobs.length === 0) return `${body}\n`;
  const trailers = activeJobs.map((id) => `Job: ${id}`).join('\n');
  return `${body}\n\n${trailers}\n`;
}

/** The git author identity for a commit made through the server (AUTH-6, CMT-5). */
export function commitAuthor(principal: { displayName: string; email: string }): string {
  return `${principal.displayName} <${principal.email}>`;
}
