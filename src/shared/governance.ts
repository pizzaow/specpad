import type { ProjectDoc, SrsDoc, VtpDoc, PrdDoc, SddDoc, RiskDoc, SoupDoc, JobsDoc, JobDoc } from './schema';

export type GovernanceRuleId =
  | 'traceability'
  | 'referential-integrity'
  | 'missing-expected'
  | 'active-job-open'
  | 'active-job-known'
  | 'prd-referential-integrity'
  | 'prd-coverage'
  | 'sdd-referential-integrity'
  | 'sdd-coverage'
  | 'risk-referential-integrity'
  | 'risk-cause'
  | 'risk-controlled'
  | 'soup-identity'
  | 'soup-requirements'
  | 'soup-referential-integrity';

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
    title: 'Every implemented product requirement is satisfied',
    description:
      'When a PRD register is present, every non-heading PRD item marked `status: "implemented"` must be referenced by at least one SRS requirement via `satisfies`. Items that are `proposed` (or have no status) are roadmap/vision and exempt.',
  },
  {
    id: 'sdd-referential-integrity',
    title: 'Design references resolve',
    description:
      'When an SDD is present, every SRS `design` entry must resolve to an existing SDD section id.',
  },
  {
    id: 'sdd-coverage',
    title: 'Every requirement reaches the design',
    description:
      'When an SDD is present, every non-heading SRS requirement must reference at least one SDD section via `design` — the evidence that the design implements the requirements (IEC 62304 5.4; FDA SDS).',
  },
  {
    id: 'risk-referential-integrity',
    title: 'Risk references resolve',
    description:
      'When a risk register is present, every `causes` entry must resolve to an SDD section of kind "unit", and every `controls` entry to an existing SRS requirement.',
  },
  {
    id: 'risk-cause',
    title: 'Every risk names a contributing software item',
    description:
      'When a risk register is present, every non-heading risk must name at least one software item that could cause it (IEC 62304 7.1). A hazardous situation with no software cause does not belong in the software risk analysis.',
  },
  {
    id: 'risk-controlled',
    title: 'Every risk is controlled or justified',
    description:
      'When a risk register is present, every non-heading risk must reference at least one controlling requirement (IEC 62304 7.2), or record why no software control is needed — for example a risk controlled in hardware or by labelling.',
  },
  {
    id: 'soup-identity',
    title: 'Every component is exactly identified',
    description:
      'When a SOUP register is present, every component must record a supplier and an exact version (IEC 62304 8.1.2). A version range is not an identity: an anomaly evaluation is only valid for the version it was performed against.',
  },
  {
    id: 'soup-requirements',
    title: 'Every component has requirements placed on it',
    description:
      'When a SOUP register is present, every component must state the functional and performance requirements necessary for its intended use (IEC 62304 5.3.3).',
  },
  {
    id: 'soup-referential-integrity',
    title: 'Component references resolve',
    description:
      'When a SOUP register is present, every `usedBy` entry must resolve to an SDD section and every `tests` entry to a VTP item.',
  },
];

export interface ProjectBundle {
  project?: ProjectDoc | null;
  srs?: SrsDoc | null;
  vtp?: VtpDoc | null;
  prd?: PrdDoc | null;
  sdd?: SddDoc | null;
  risk?: RiskDoc | null;
  soup?: SoupDoc | null;
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
      if (prd.status !== 'implemented') continue; // proposed/roadmap items are exempt
      if (!satisfied.has(prd.id)) {
        violations.push({
          rule: 'prd-coverage',
          itemId: prd.id,
          message: `Implemented product requirement ${prd.id} is not satisfied by any SRS requirement.`,
        });
      }
    }
  }

  // sdd-{referential-integrity,coverage}: only when an SDD is present (opt-in), the same
  // way PRD governance is. A project with no detailed design pays nothing.
  //
  // Coverage is checked at full rigor unconditionally: 62304 makes the per-unit detailed
  // design Class C only and FDA submits the SDS only at Enhanced, but deciding what to
  // OMIT belongs to the export, not to the author. See guides/detailed-design.md.
  if (bundle.sdd) {
    const sddIds = new Set((bundle.sdd.items ?? []).map((s) => s.id));
    for (const req of srsItems) {
      for (const ref of req.design ?? []) {
        if (!sddIds.has(ref)) {
          violations.push({
            rule: 'sdd-referential-integrity',
            itemId: req.id,
            message: `Requirement ${req.id} points at design section "${ref}", which is not a known SDD section id.`,
          });
        }
      }
    }
    for (const req of srsItems) {
      if (req.heading) continue;
      if ((req.design ?? []).length === 0) {
        violations.push({
          rule: 'sdd-coverage',
          itemId: req.id,
          message: `Requirement ${req.id} does not reference any design section.`,
        });
      }
    }
  }

  // risk-*: only when a risk register is present (opt-in), as with PRD and SDD.
  //
  // The control measures are ordinary requirements (62304 5.2.2), so the evidence that
  // a control works is the tests already verifying that requirement — 7.3 needs no rule
  // of its own here, only the trace that `traceability` already enforces.
  if (bundle.risk) {
    const unitIds = new Set(
      (bundle.sdd?.items ?? []).filter((s) => !s.heading && (s.kind ?? 'unit') === 'unit').map((s) => s.id),
    );
    const sectionIds = new Set((bundle.sdd?.items ?? []).map((s) => s.id));
    const srsIds2 = new Set(srsItems.map((i) => i.id));
    // A cause is whatever could fail: one of our units, or a supplier's component (7.1.2).
    const soupIds = new Set((bundle.soup?.items ?? []).filter((c) => !c.heading).map((c) => c.id));

    for (const risk of bundle.risk.items ?? []) {
      if (risk.heading) continue;

      for (const ref of risk.causes ?? []) {
        if (soupIds.has(ref)) continue;
        if (!sectionIds.has(ref)) {
          violations.push({
            rule: 'risk-referential-integrity',
            itemId: risk.id,
            message: `Risk ${risk.id} names cause "${ref}", which is neither a known design section nor a known component.`,
          });
        } else if (!unitIds.has(ref)) {
          // A design view describes structure across units; it cannot fail on its own.
          violations.push({
            rule: 'risk-referential-integrity',
            itemId: risk.id,
            message: `Risk ${risk.id} names cause "${ref}", which is a design view rather than a software unit.`,
          });
        }
      }
      for (const ref of risk.controls ?? []) {
        if (!srsIds2.has(ref)) {
          violations.push({
            rule: 'risk-referential-integrity',
            itemId: risk.id,
            message: `Risk ${risk.id} names control "${ref}", which is not a known requirement id.`,
          });
        }
      }

      if ((risk.causes ?? []).length === 0) {
        violations.push({
          rule: 'risk-cause',
          itemId: risk.id,
          message: `Risk ${risk.id} names no software item that could cause it.`,
        });
      }
      if ((risk.controls ?? []).length === 0 && !(risk.justification ?? '').trim()) {
        violations.push({
          rule: 'risk-controlled',
          itemId: risk.id,
          message: `Risk ${risk.id} has no controlling requirement and no justification for having none.`,
        });
      }
    }
  }

  // soup-*: only when a SOUP register is present (opt-in), as with the other pillars.
  if (bundle.soup) {
    const sectionIds2 = new Set((bundle.sdd?.items ?? []).map((s) => s.id));
    const vtpIds = new Set(vtpItems.map((t) => t.id));

    for (const component of bundle.soup.items ?? []) {
      if (component.heading) continue;
      const label = component.name || component.id;

      if (!(component.vendor ?? '').trim() || !(component.version ?? '').trim()) {
        violations.push({
          rule: 'soup-identity',
          itemId: component.id,
          message: `Component ${label} does not record both a supplier and an exact version.`,
        });
      }
      if (!(component.requirements ?? '').trim()) {
        violations.push({
          rule: 'soup-requirements',
          itemId: component.id,
          message: `Component ${label} states no functional or performance requirements.`,
        });
      }
      for (const ref of component.usedBy ?? []) {
        if (!sectionIds2.has(ref)) {
          violations.push({
            rule: 'soup-referential-integrity',
            itemId: component.id,
            message: `Component ${label} is used by "${ref}", which is not a known design section id.`,
          });
        }
      }
      for (const ref of component.tests ?? []) {
        if (!vtpIds.has(ref)) {
          violations.push({
            rule: 'soup-referential-integrity',
            itemId: component.id,
            message: `Component ${label} names test "${ref}", which is not a known test id.`,
          });
        }
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
