/**
 * verification — pure functions that resolve a VTP test's outcome from a captured
 * run, completing the evidence chain VTP item → automation link(s) → run result.
 *
 * Framework-agnostic: a link is matched to run results by file (+ optional selector);
 * the runner that produced the run is never interpreted here. Automated tests derive
 * their status from the run; manual tests (no automation) fall back to their stored
 * result. No git/IO — the editor and the export both call these on already-loaded data.
 */
import type { VtpItem, RunRecord, RunResult, RunStatus, AutomationLink } from './schema';

// 'missing' = the link resolves to no result in the run (test not executed, or the
// selector/file no longer matches) — a real gap, distinct from a recorded skip.
export type LinkStatus = RunStatus | 'missing';

export interface LinkOutcome {
  link: AutomationLink;
  status: LinkStatus;
  matches: number; // how many run results the link matched
}

// A test's overall verification state. 'not_run' = automated but the run has no
// result for at least one link; 'unset' = manual with no recorded result.
export type VerificationStatus = 'passed' | 'failed' | 'skipped' | 'not_run' | 'not_tested' | 'unset';

export interface VerificationOutcome {
  automated: boolean;
  status: VerificationStatus;
  links: LinkOutcome[]; // [] for a manual test
  run?: { runner: string; ref: string; ranAt: string }; // run provenance when automated and a run is loaded
}

/** Results in a run that a link points at: same file, and same selector when the link pins one. */
export function matchLink(link: AutomationLink, run: RunRecord): RunResult[] {
  return run.results.filter((r) => r.file === link.file && (link.selector == null || r.selector === link.selector));
}

/** Resolve a single automation link against a run (or null when no run is loaded). */
export function linkOutcome(link: AutomationLink, run: RunRecord | null): LinkOutcome {
  if (!run) return { link, status: 'missing', matches: 0 };
  const m = matchLink(link, run);
  if (m.length === 0) return { link, status: 'missing', matches: 0 };
  let status: LinkStatus = 'passed';
  if (m.some((r) => r.status === 'failed')) status = 'failed';
  else if (m.every((r) => r.status === 'skipped')) status = 'skipped';
  return { link, status, matches: m.length };
}

/** The full verification outcome for a VTP item against a loaded run (or null). */
export function verificationOutcome(item: VtpItem, run: RunRecord | null): VerificationOutcome {
  const links = item.automation ?? [];
  if (links.length === 0) {
    const r = item.result ?? '';
    return { automated: false, status: r === '' ? 'unset' : r, links: [] };
  }
  const outcomes = links.map((l) => linkOutcome(l, run));
  let status: VerificationStatus;
  if (outcomes.some((o) => o.status === 'failed')) status = 'failed';
  else if (outcomes.some((o) => o.status === 'missing')) status = 'not_run';
  else if (outcomes.every((o) => o.status === 'skipped')) status = 'skipped';
  else status = 'passed';
  return {
    automated: true,
    status,
    links: outcomes,
    run: run ? { runner: run.runner, ref: run.ref, ranAt: run.ranAt } : undefined,
  };
}

export type VerificationRollup = Record<VerificationStatus, number> & { automated: number; manual: number };

/** Count non-heading tests by verification status (for the Results summary / deliverable rollups). */
export function rollup(items: VtpItem[], run: RunRecord | null): VerificationRollup {
  const acc: VerificationRollup = { passed: 0, failed: 0, skipped: 0, not_run: 0, not_tested: 0, unset: 0, automated: 0, manual: 0 };
  for (const it of items) {
    if (it.heading) continue;
    const o = verificationOutcome(it, run);
    acc[o.status] += 1;
    if (o.automated) acc.automated += 1; else acc.manual += 1;
  }
  return acc;
}
