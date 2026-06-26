/**
 * auditReport — pure, client-side computation of the Auditor view's design-control
 * evidence from the loaded PRD/SRS/VTP documents. No git, no I/O. The traceability
 * thread it builds is PRD → SRS → VTP (everything derivable in the browser); per-job
 * source/release attribution lives in the Jobs/Releases views. Governance gaps are
 * the shared checkGovernance output, so the Auditor view and the skill agree.
 */
import type { PrdDoc, SrsDoc, VtpDoc, PrdItem, SrsItem, VtpItem, GovernanceViolation, RunRecord } from './shared';
import { checkGovernance, verificationOutcome } from './shared';

export type TestRollup = 'passed' | 'failed' | 'not_tested' | 'no_test';

export interface TraceRow {
  req: SrsItem;
  prds: PrdItem[]; // resolved from req.satisfies (when a PRD register is present)
  danglingPrdRefs: string[]; // satisfies ids that resolve to nothing
  tests: VtpItem[]; // tests whose verifies includes this requirement
  rollup: TestRollup;
}

export interface AuditReport {
  hasPrd: boolean;
  coverage: {
    requirements: { total: number; verified: number };
    tests: { total: number; passed: number; failed: number; notTested: number; noExpected: number };
    productRequirements: { total: number; implemented: number; implementedSatisfied: number; proposed: number };
  };
  trace: TraceRow[];
  roadmap: PrdItem[]; // proposed (or status-less) non-heading PRD items
  violations: GovernanceViolation[];
}

const isReq = (i: SrsItem) => !i.heading;

// A test's effective status: derived from the run for automated tests, the stored
// result for manual ones (verificationOutcome). 'passed'/'failed' are decisive;
// everything else (not_run/skipped/not_tested/unset) counts as not-yet-verified.
function statusOf(t: VtpItem, run: RunRecord | null): 'passed' | 'failed' | 'other' {
  const s = verificationOutcome(t, run).status;
  return s === 'passed' ? 'passed' : s === 'failed' ? 'failed' : 'other';
}

function rollupFor(tests: VtpItem[], run: RunRecord | null): TestRollup {
  if (tests.length === 0) return 'no_test';
  if (tests.some((t) => statusOf(t, run) === 'failed')) return 'failed';
  if (tests.every((t) => statusOf(t, run) === 'passed')) return 'passed';
  return 'not_tested';
}

export function buildAuditReport(docs: {
  prd?: PrdDoc | null;
  srs?: SrsDoc | null;
  vtp?: VtpDoc | null;
}, run: RunRecord | null = null): AuditReport {
  const prd = docs.prd ?? null;
  const srsItems = docs.srs?.items ?? [];
  const vtpItems = (docs.vtp?.items ?? []).filter((t) => !t.heading);
  const reqs = srsItems.filter(isReq);

  // Index tests by the requirement id they verify.
  const testsByReq = new Map<string, VtpItem[]>();
  for (const t of vtpItems) {
    for (const ref of t.verifies ?? []) {
      const list = testsByReq.get(ref) ?? [];
      list.push(t);
      testsByReq.set(ref, list);
    }
  }

  const prdById = new Map((prd?.items ?? []).map((p) => [p.id, p]));

  const trace: TraceRow[] = reqs.map((req) => {
    const prds: PrdItem[] = [];
    const danglingPrdRefs: string[] = [];
    for (const id of req.satisfies ?? []) {
      const p = prdById.get(id);
      if (p) prds.push(p);
      else if (prd) danglingPrdRefs.push(id);
    }
    const tests = testsByReq.get(req.id) ?? [];
    return { req, prds, danglingPrdRefs, tests, rollup: rollupFor(tests, run) };
  });

  const verified = trace.filter((r) => r.tests.length > 0).length;

  const statuses = vtpItems.map((t) => statusOf(t, run));
  const tests = {
    total: vtpItems.length,
    passed: statuses.filter((s) => s === 'passed').length,
    failed: statuses.filter((s) => s === 'failed').length,
    notTested: statuses.filter((s) => s === 'other').length,
    noExpected: vtpItems.filter((t) => !t.expected || t.expected.trim() === '').length,
  };

  const prdItems = (prd?.items ?? []).filter((p) => !p.heading);
  const satisfiedPrdIds = new Set<string>();
  for (const req of reqs) for (const id of req.satisfies ?? []) satisfiedPrdIds.add(id);
  const implemented = prdItems.filter((p) => p.status === 'implemented');
  const roadmap = prdItems.filter((p) => p.status !== 'implemented');

  return {
    hasPrd: !!prd,
    coverage: {
      requirements: { total: reqs.length, verified },
      tests,
      productRequirements: {
        total: prdItems.length,
        implemented: implemented.length,
        implementedSatisfied: implemented.filter((p) => satisfiedPrdIds.has(p.id)).length,
        proposed: roadmap.length,
      },
    },
    trace,
    roadmap,
    violations: checkGovernance({ srs: docs.srs ?? null, vtp: docs.vtp ?? null, prd }),
  };
}
