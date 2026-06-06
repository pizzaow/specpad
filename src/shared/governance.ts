import type { ProjectDoc, SrsDoc, VtpDoc } from './schema';

export type GovernanceRuleId =
  | 'traceability'
  | 'referential-integrity'
  | 'missing-expected';

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
];

export interface ProjectBundle {
  project?: ProjectDoc | null;
  srs?: SrsDoc | null;
  vtp?: VtpDoc | null;
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

  return violations;
}
