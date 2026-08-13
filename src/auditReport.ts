/**
 * auditReport — pure, client-side computation of the Auditor view's design-control
 * evidence from the loaded documents. No git, no I/O.
 *
 * The thread it builds is the whole one the registers now describe:
 *
 *   product need → requirement → design → verification
 *                       ↑
 *          risk control / threat control
 *
 * A requirement is the hub: it satisfies a need, is implemented by a design section, is
 * verified by tests, and may exist *because* a risk or a threat needed controlling. That
 * last edge is stored on the risk and the threat rather than on the requirement, so it is
 * resolved backwards here — which is why a requirement can look ordinary in the SRS and
 * turn out to be load-bearing.
 *
 * Per-job source/release attribution lives in the Jobs/Releases views. Governance gaps are
 * the shared checkGovernance output, so the Auditor view and the skill agree.
 */
import type {
  PrdDoc, SrsDoc, VtpDoc, SddDoc, RiskDoc, ThreatDoc,
  PrdItem, SrsItem, VtpItem, SddSection, RiskItem, ThreatItem,
  GovernanceViolation, RunRecord, TestLevel,
} from './shared';
import { checkGovernance, verificationOutcome } from './shared';

export type TestRollup = 'passed' | 'failed' | 'not_tested' | 'no_test';

export interface TraceRow {
  req: SrsItem;
  prds: PrdItem[]; // resolved from req.satisfies (when a PRD register is present)
  danglingPrdRefs: string[]; // satisfies ids that resolve to nothing
  designs: SddSection[]; // resolved from req.design (when a detailed design is present)
  danglingDesignRefs: string[];
  tests: VtpItem[]; // tests whose verifies includes this requirement
  /** Risks and threats naming this requirement as a control — resolved backwards. */
  risks: RiskItem[];
  threats: ThreatItem[];
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
  /** The registers actually present, so the view shows only the columns that mean something. */
  has: { prd: boolean; sdd: boolean; risk: boolean; threat: boolean };
  /** Depth of the record, as distinct from its breadth. */
  depth: {
    designed: number; // requirements reaching a design section
    categorised: number; // requirements declaring a §5.2.2 category
    levels: Record<TestLevel, number>; // tests by verification activity
    unlevelled: number;
    controlling: number; // requirements a risk or threat leans on
  };
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
  sdd?: SddDoc | null;
  risk?: RiskDoc | null;
  threat?: ThreatDoc | null;
}, run: RunRecord | null = null): AuditReport {
  const prd = docs.prd ?? null;
  const sdd = docs.sdd ?? null;
  const risk = docs.risk ?? null;
  const threat = docs.threat ?? null;
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
  const sddById = new Map((sdd?.items ?? []).map((d) => [d.id, d]));

  // The control edges point *at* requirements, so index them backwards: a requirement does
  // not know it is a control, and that is exactly what a reviewer needs told.
  const risksByReq = new Map<string, RiskItem[]>();
  for (const k of (risk?.items ?? []).filter((i) => !i.heading)) {
    for (const id of k.controls ?? []) risksByReq.set(id, [...(risksByReq.get(id) ?? []), k]);
  }
  const threatsByReq = new Map<string, ThreatItem[]>();
  for (const x of (threat?.items ?? []).filter((i) => !i.heading)) {
    for (const id of x.controls ?? []) threatsByReq.set(id, [...(threatsByReq.get(id) ?? []), x]);
  }

  const trace: TraceRow[] = reqs.map((req) => {
    const prds: PrdItem[] = [];
    const danglingPrdRefs: string[] = [];
    for (const id of req.satisfies ?? []) {
      const p = prdById.get(id);
      if (p) prds.push(p);
      else if (prd) danglingPrdRefs.push(id);
    }
    const designs: SddSection[] = [];
    const danglingDesignRefs: string[] = [];
    for (const id of req.design ?? []) {
      const d = sddById.get(id);
      if (d) designs.push(d);
      else if (sdd) danglingDesignRefs.push(id);
    }
    const tests = testsByReq.get(req.id) ?? [];
    return {
      req, prds, danglingPrdRefs, designs, danglingDesignRefs, tests,
      risks: risksByReq.get(req.id) ?? [],
      threats: threatsByReq.get(req.id) ?? [],
      rollup: rollupFor(tests, run),
    };
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

  const levels: Record<TestLevel, number> = { unit: 0, integration: 0, system: 0 };
  for (const t of vtpItems) if (t.verificationLevel) levels[t.verificationLevel]++;

  return {
    hasPrd: !!prd,
    has: { prd: !!prd, sdd: !!sdd, risk: !!risk, threat: !!threat },
    depth: {
      designed: trace.filter((r) => r.designs.length > 0).length,
      categorised: reqs.filter((r) => (r.category ?? []).length > 0).length,
      levels,
      unlevelled: vtpItems.filter((t) => !t.verificationLevel).length,
      controlling: trace.filter((r) => r.risks.length > 0 || r.threats.length > 0).length,
    },
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
    violations: checkGovernance({ srs: docs.srs ?? null, vtp: docs.vtp ?? null, prd, sdd, risk, threat }),
  };
}
