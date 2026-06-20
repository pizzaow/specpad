import type { ProjectDoc, SrsDoc, VtpDoc, PrdDoc, JobsDoc, JobDoc } from './schema';

export type GovernanceRuleId =
  | 'traceability'
  | 'referential-integrity'
  | 'missing-expected'
  | 'active-job-open'
  | 'active-job-known'
  | 'prd-referential-integrity'
  | 'prd-coverage';

/** Normalize the active-job marker to a list, tolerating the legacy single `job`. */
export function activeJobIds(job: JobDoc | null | undefined): string[] {
  if (!job) return [];
  if (job.jobs && job.jobs.length) return job.jobs;
  return job.job ? [job.job] : [];
}

export interface GovernanceRule {
  id: GovernanceRuleId;
  title: string;
  description: string;
}

// The canonical rule list. The skill's SKILL.md is parity-tested against these ids.
export const GOVERNANCE_RULES: GovernanceRule[] = [
  {
    id: 'traceability',
    title: 'Every requirement is verified',
    description:
      'Every non-heading SRS requirement must be referenced by at least one VTP test.',
  },
  {
    id: 'referential-integrity',
    title: 'References resolve',
    description:
      'Every VTP `verifies` entry must resolve to an existing SRS item id.',
  },
  {
    id: 'missing-expected',
    title: 'Tests declare an expected result',
    description:
      'Every non-heading VTP test must have a non-empty `expected` value.',
  },
  {
    id: 'active-job-open',
    title: 'Active jobs are open',
    description:
      'No active-job marker entry may point at a closed job record; reopen it or pick another before attaching more changes.',
  },
  {
    id: 'active-job-known',
    title: 'Active jobs exist in the register',
    description:
      'When a jobs register exists, every active-job marker entry must resolve to a record in it (no dangling or mistyped ids).',
  },
  {
    id: 'prd-referential-integrity',
    title: 'PRD references resolve',
    description:
      'When a PRD register is present, every SRS `satisfies` entry must resolve to an existing PRD item id.',
  },
  {
    id: 'prd-coverage',
    title: 'Every product requirement is satisfied',
    description:
      'When a PRD register is present, every non-heading PRD item must be referenced by at least one SRS requirement via `satisfies`.',
  },
];

export interface ProjectBundle {
  project?: ProjectDoc | null;
  srs?: SrsDoc | null;
  vtp?: VtpDoc | null;
  prd?: PrdDoc | null;
  jobs?: JobsDoc | null;
  job?: JobDoc | null;
}

export interface GovernanceViolation {
  rule: GovernanceRuleId;
  itemId: string | null;
  message: string;
}

export function checkGovernance(bundle: ProjectBundle): GovernanceViolation[] {
  const violations: GovernanceViolation[] = [];
  const srsItems = bundle.srs?.items ?? [];
  const vtpItems = bundle.vtp?.items ?? [];
  const srsIds = new Set(srsItems.map((i) => i.id));

  // referential-integrity: every verifies entry resolves to a real srs id.
  for (const test of vtpItems) {
    for (const ref of test.verifies ?? []) {
      if (!srsIds.has(ref)) {
        violations.push({
          rule: 'referential-integrity',
          itemId: test.id,
          message: `Test ${test.id} verifies "${ref}", which is not a known requirement id.`,
        });
      }
    }
  }

  // missing-expected: non-heading tests need a non-empty expected.
  for (const test of vtpItems) {
    if (test.heading) continue;
    if (!test.expected || test.expected.trim() === '') {
      violations.push({
        rule: 'missing-expected',
        itemId: test.id,
        message: `Test ${test.id} has no expected result.`,
      });
    }
  }

  // traceability: every non-heading requirement is verified by >=1 test.
  const verified = new Set<string>();
  for (const test of vtpItems) {
    for (const ref of test.verifies ?? []) verified.add(ref);
  }
  for (const req of srsItems) {
    if (req.heading) continue;
    if (!verified.has(req.id)) {
      violations.push({
        rule: 'traceability',
        itemId: req.id,
        message: `Requirement ${req.id} has no verifying test.`,
      });
    }
  }

  // active-job-{known,open}: every active-job entry must resolve to an OPEN record.
  // (Pure data — both files are in the working tree, so the editor can evaluate this too.
  // Requiring an active job *for spec changes* needs HEAD and lives in the skill pre-commit gate.
  // With no register, entries are external tracker keys we can't resolve, so we skip the check.)
  // prd-{referential-integrity,coverage}: only when a PRD register is present (opt-in).
  // Without a PRD register, `satisfies` entries are unresolvable and PRD governance is skipped.
  if (bundle.prd) {
    const prdItems = bundle.prd.items ?? [];
    const prdIds = new Set(prdItems.map((i) => i.id));
    const satisfied = new Set<string>();
    for (const req of srsItems) {
      for (const ref of req.satisfies ?? []) {
        satisfied.add(ref);
        if (!prdIds.has(ref)) {
          violations.push({
            rule: 'prd-referential-integrity',
            itemId: req.id,
            message: `Requirement ${req.id} satisfies "${ref}", which is not a known PRD item id.`,
          });
        }
      }
    }
    for (const prd of prdItems) {
      if (prd.heading) continue;
      if (!satisfied.has(prd.id)) {
        violations.push({
          rule: 'prd-coverage',
          itemId: prd.id,
          message: `Product requirement ${prd.id} is not satisfied by any SRS requirement.`,
        });
      }
    }
  }

  const active = activeJobIds(bundle.job);
  if (active.length && bundle.jobs) {
    const byId = new Map(bundle.jobs.jobs.map((j) => [j.id, j]));
    for (const id of active) {
      const record = byId.get(id);
      if (!record) {
        violations.push({
          rule: 'active-job-known',
          itemId: id,
          message: `Active job "${id}" is not a record in the jobs register.`,
        });
      } else if (record.status === 'closed') {
        violations.push({
          rule: 'active-job-open',
          itemId: record.id,
          message: `Active job ${record.code ?? record.id} is closed; reopen it or pick another before attaching more changes.`,
        });
      }
    }
  }

  return violations;
}
