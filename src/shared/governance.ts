import type { ProjectDoc, SrsDoc, VtpDoc, PrdDoc, SddDoc, RiskDoc, SoupDoc, ThreatDoc, ReferenceDoc, JobsDoc, JobDoc } from './schema';
import type { GovernanceRuleId } from './schema';

// Defined in schema.ts so the project index can name the rules it enforces without a
// cycle; re-exported here because this module is where rules are read from.
export type { GovernanceRuleId };

/** Normalize the active-job marker to a list, tolerating the legacy single `job`. */
export function activeJobIds(job: JobDoc | null | undefined): string[] {
  if (!job) return [];
  if (job.jobs && job.jobs.length) return job.jobs;
  return job.job ? [job.job] : [];
}

/**
 * How hard a rule bites. `violation` fails the project; `advisory` reports without failing,
 * which exists because two things needed saying that are not defects: material beyond the
 * declared safety class, and a field a project has not adopted yet. A blocking rule that
 * fires on every existing document teaches people to ignore governance, so a project opts
 * into being held to an advisory by naming it in the index's `enforce` list.
 */
export type RuleTier = 'violation' | 'advisory';

export interface GovernanceRule {
  id: GovernanceRuleId;
  title: string;
  description: string;
  /** Absent means `violation`; the tier a rule has before any project enforces it. */
  tier?: RuleTier;
}

// The canonical rule list. The skill's SKILL.md is parity-tested against these ids.
const RULES: GovernanceRule[] = [
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
  {
    id: 'threat-referential-integrity',
    title: 'Threat references resolve',
    description:
      'When a threat model is present, every `causes` entry must resolve to a design unit or a component, every `controls` entry to a requirement, and every `safetyRisk` entry to a risk.',
  },
  {
    id: 'threat-assessed',
    title: 'Every threat is assessed',
    description:
      'When a threat model is present, every non-heading threat must record an exploitability and an impact. A threat neither of which is stated has been identified but not analysed.',
  },
  {
    id: 'threat-controlled',
    title: 'Every threat is controlled or accepted',
    description:
      'When a threat model is present, every non-heading threat must reference at least one controlling requirement, or record why none is needed — for example a threat accepted, or controlled by the deployment environment.',
  },
  {
    id: 'reference-located',
    title: 'Every reference can be found',
    description:
      'When a references register is present, every non-heading entry must say where the document is kept (`location`) and what sort of document it is (`kind`). A reference a reviewer cannot open is a claim, not a record.',
  },
  {
    id: 'reference-covers',
    title: 'Every reference discharges something',
    description:
      'When a references register is present, every non-heading entry must say what it covers. The register exists to account for the processes SpecPad does not hold; an entry that discharges nothing is decoration, and this register is meant to stay short.',
  },
  {
    id: 'sdd-segregation',
    title: 'Segregation says why it holds',
    description:
      'When an SDD is present, a section naming other sections it is segregated from must say why the segregation is effective, and each named section must resolve (IEC 62304 5.3.5, strengthened by A1:2015 — separation intended is not separation ensured).',
  },
  {
    id: 'sdd-acceptance',
    tier: 'advisory',
    title: 'Units say what verified means',
    description:
      'When an SDD is present, every section of kind "unit" should state its acceptance criteria (IEC 62304 5.5.3; at Class C also 5.5.4). Advisory: asked per unit, and answerable only by someone who knows the unit.',
  },
  {
    id: 'risk-sequence',
    tier: 'advisory',
    title: 'Risks state the sequence of events',
    description:
      'When a risk register is present, every non-heading risk should record the sequence of events from the software failure to the hazardous situation (IEC 62304 7.1.5). Advisory: it is the analysis rather than a field, and recording only the endpoint hides the steps a control could break.',
  },
  {
    id: 'srs-category',
    tier: 'advisory',
    title: 'Requirements declare their content category',
    description:
      'Every non-heading SRS requirement should declare which of IEC 62304 5.2.2 a)–l) it is — one or more, since A1:2015 NOTE 10 states the categories can overlap. Advisory: the worth of the list is coverage, and a category with no requirement is a question to answer once rather than an omission found at review.',
  },
  {
    id: 'srs-security-control',
    tier: 'advisory',
    title: 'Security controls say which control they are',
    description:
      'A requirement named as a control by a threat should declare which FDA security control categories it implements (Cybersecurity in Medical Devices, February 2026, V.B.1). Advisory: it is asked only of requirements the threat model already relies on, and an adequate-coverage argument is built from these categories rather than from the word "security".',
  },
  {
    id: 'vtp-verification-level',
    tier: 'advisory',
    title: 'Tests declare their verification level',
    description:
      'Every non-heading VTP test should declare whether it is unit verification (IEC 62304 5.5), integration testing (5.6) or system testing (5.7). Advisory: without it a register shows requirements are covered by something, but not that each activity was performed.',
  },
];

/** Rules with their tier resolved; absent in the literal above means `violation`. */
export const GOVERNANCE_RULES: GovernanceRule[] = RULES.map((r) => ({ tier: 'violation', ...r }));

const ADVISORY_IDS = new Set(GOVERNANCE_RULES.filter((r) => r.tier === 'advisory').map((r) => r.id));

export interface ProjectBundle {
  project?: ProjectDoc | null;
  srs?: SrsDoc | null;
  vtp?: VtpDoc | null;
  prd?: PrdDoc | null;
  sdd?: SddDoc | null;
  risk?: RiskDoc | null;
  soup?: SoupDoc | null;
  threat?: ThreatDoc | null;
  reference?: ReferenceDoc | null;
  jobs?: JobsDoc | null;
  job?: JobDoc | null;
}

export interface GovernanceViolation {
  rule: GovernanceRuleId;
  itemId: string | null;
  message: string;
}

/** An advisory carries the same shape, plus the tier that says it does not fail. */
export interface GovernanceFinding extends GovernanceViolation {
  severity: RuleTier;
}

/**
 * Findings from the advisory-tier rules, minus any the project has promoted to blocking
 * (those come back from `checkGovernance` instead, so a finding is never reported twice).
 */
export function checkAdvice(bundle: ProjectBundle): GovernanceFinding[] {
  const enforced = new Set(bundle.project?.enforce ?? []);
  return advisoryFindings(bundle).filter((f) => !enforced.has(f.rule));
}

/** Every advisory-tier finding, regardless of what the project enforces. */
function advisoryFindings(bundle: ProjectBundle): GovernanceFinding[] {
  const out: GovernanceFinding[] = [];
  const advise = (rule: GovernanceRuleId, itemId: string | null, message: string) =>
    out.push({ rule, itemId, message, severity: 'advisory' });

  for (const item of bundle.srs?.items ?? []) {
    if (item.heading || (item.category ?? []).length) continue;
    advise('srs-category', item.id, `Requirement ${item.code ?? item.id} does not say which of IEC 62304 5.2.2 a)–l) it is.`);
  }
  for (const test of bundle.vtp?.items ?? []) {
    if (test.heading || test.verificationLevel) continue;
    advise('vtp-verification-level', test.id, `Test ${test.code ?? test.id} does not say whether it is unit, integration or system verification.`);
  }
  // Only units: a design view is not something "verified" is asked of.
  for (const section of bundle.sdd?.items ?? []) {
    if (section.heading || (section.kind ?? 'unit') !== 'unit') continue;
    if ((section.acceptance ?? '').trim()) continue;
    advise('sdd-acceptance', section.id, `Unit ${section.code ?? section.title} does not state what verified means for it.`);
  }
  // Asked only of requirements a threat already leans on: those are the ones an
  // adequate-coverage argument is made from, and asking it of every requirement would be
  // noise on a register that is mostly not about security.
  if (bundle.threat) {
    const controlled = new Set((bundle.threat.items ?? []).flatMap((t) => t.controls ?? []));
    for (const req of bundle.srs?.items ?? []) {
      if (req.heading || !controlled.has(req.id)) continue;
      if ((req.securityControl ?? []).length) continue;
      advise('srs-security-control', req.id, `Requirement ${req.code ?? req.id} is named as a security control but does not say which FDA control category it implements.`);
    }
  }
  for (const risk of bundle.risk?.items ?? []) {
    if (risk.heading || (risk.sequence ?? '').trim()) continue;
    advise('risk-sequence', risk.id, `Risk ${risk.code ?? risk.id} does not record the sequence of events leading to the hazardous situation.`);
  }
  return out;
}

export function checkGovernance(bundle: ProjectBundle): GovernanceViolation[] {
  const violations: GovernanceViolation[] = [];

  // Advisory rules the project has chosen to be held to become ordinary violations.
  const enforced = new Set((bundle.project?.enforce ?? []).filter((r) => ADVISORY_IDS.has(r)));
  if (enforced.size) {
    for (const f of advisoryFindings(bundle)) {
      if (enforced.has(f.rule)) violations.push({ rule: f.rule, itemId: f.itemId, message: f.message });
    }
  }
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

  // threat-*: only when a threat model is present (opt-in), as with the other pillars.
  //
  // Exploitability replaces probability, so `threat-assessed` asks for it rather than a
  // likelihood: an attacker chooses when to act, and a defence is worth what it costs to
  // defeat.
  if (bundle.threat) {
    const attackSurface = new Set([
      ...(bundle.sdd?.items ?? []).filter((s) => !s.heading && (s.kind ?? 'unit') === 'unit').map((s) => s.id),
      ...(bundle.soup?.items ?? []).filter((c) => !c.heading).map((c) => c.id),
    ]);
    const srsIds3 = new Set(srsItems.map((i) => i.id));
    const riskIds = new Set((bundle.risk?.items ?? []).filter((r) => !r.heading).map((r) => r.id));

    for (const threat of bundle.threat.items ?? []) {
      if (threat.heading) continue;
      const label = threat.code || threat.id;

      for (const ref of threat.causes ?? []) {
        if (!attackSurface.has(ref)) {
          violations.push({
            rule: 'threat-referential-integrity',
            itemId: threat.id,
            message: `Threat ${label} names attack surface "${ref}", which is neither a software unit nor a component.`,
          });
        }
      }
      for (const ref of threat.controls ?? []) {
        if (!srsIds3.has(ref)) {
          violations.push({
            rule: 'threat-referential-integrity',
            itemId: threat.id,
            message: `Threat ${label} names control "${ref}", which is not a known requirement id.`,
          });
        }
      }
      for (const ref of threat.safetyRisk ?? []) {
        if (!riskIds.has(ref)) {
          violations.push({
            rule: 'threat-referential-integrity',
            itemId: threat.id,
            message: `Threat ${label} names safety risk "${ref}", which is not a known risk id.`,
          });
        }
      }

      if (!threat.exploitability || !threat.impact) {
        violations.push({
          rule: 'threat-assessed',
          itemId: threat.id,
          message: `Threat ${label} does not record both an exploitability and an impact.`,
        });
      }
      if ((threat.controls ?? []).length === 0 && !(threat.justification ?? '').trim()) {
        violations.push({
          rule: 'threat-controlled',
          itemId: threat.id,
          message: `Threat ${label} has no controlling requirement and no justification for having none.`,
        });
      }
    }
  }

  // sdd-segregation: only where a section claims segregation. Unlike the other SDD rules
  // this asks nothing of a project that makes no such claim — 5.3.5 applies when separation
  // is essential to risk control, which most units never are.
  if (bundle.sdd) {
    const sectionIds = new Set(bundle.sdd.items.map((s) => s.id));
    for (const section of bundle.sdd.items) {
      const named = (section.segregatedFrom ?? []).filter((r) => r.trim());
      if (!named.length) continue;
      const label = section.code ?? section.title ?? section.id;
      for (const ref of named) {
        if (!sectionIds.has(ref)) {
          violations.push({
            rule: 'sdd-segregation',
            itemId: section.id,
            message: `Section ${label} is segregated from "${ref}", which is not a known design section id.`,
          });
        }
      }
      if (!(section.segregationRationale ?? '').trim()) {
        violations.push({
          rule: 'sdd-segregation',
          itemId: section.id,
          message: `Section ${label} claims segregation but does not say why it is effective.`,
        });
      }
    }
  }

  // reference-*: only when a references register is present (opt-in, as with the other
  // pillars). This register accounts for the processes SpecPad does not hold, so both rules
  // ask the same thing in different directions — can it be found, and does it discharge
  // anything. An entry that fails either is not carrying its weight.
  if (bundle.reference) {
    for (const ref of bundle.reference.items) {
      if (ref.heading) continue;
      const label = ref.code ?? ref.title ?? ref.id;
      if (!(ref.location ?? '').trim() || !ref.kind) {
        violations.push({
          rule: 'reference-located',
          itemId: ref.id,
          message: `Reference ${label} does not say both what sort of document it is and where it is kept.`,
        });
      }
      if ((ref.covers ?? []).filter((c) => c.trim()).length === 0) {
        violations.push({
          rule: 'reference-covers',
          itemId: ref.id,
          message: `Reference ${label} does not say what it covers, so nothing accounts for why it is listed.`,
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
