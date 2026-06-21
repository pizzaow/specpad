/**
 * designControls — the Auditor view's design-control map. Pure: from the loaded
 * project it produces the formal elements (FDA 21 CFR 820.30 + IEC 62304), each
 * with a citation, a plain statement, a status derived live, and a link to the
 * tab that holds the evidence. This is the surface an engineer uses to answer an
 * auditor's "where are your design inputs / verification / …?".
 */
import type { PrdDoc, SrsDoc, VtpDoc, ReleasesDoc, JobRecord } from './shared';
import { buildAuditReport } from './auditReport';
import type { ViewKey } from './components/ViewTabs';

export type ControlStatus = 'present' | 'partial' | 'gap';

export interface ControlElement {
  key: string;
  name: string;
  cite: string; // standard citation(s)
  statement: string; // plain-language "what this is"
  status: ControlStatus;
  detail: string; // where it lives / why this status
  link?: ViewKey; // the tab that holds the evidence
}

export interface DesignControlsInput {
  prd?: PrdDoc | null;
  srs?: SrsDoc | null;
  vtp?: VtpDoc | null;
  jobs?: JobRecord[];
  releases?: ReleasesDoc | null;
  hasArchitecture?: boolean;
}

export function buildDesignControls(input: DesignControlsInput): ControlElement[] {
  const report = buildAuditReport({ prd: input.prd, srs: input.srs, vtp: input.vtp });
  const reqs = report.coverage.requirements;
  const jobs = input.jobs ?? [];
  const releaseCount = input.releases?.releases.length ?? 0;
  const hasArch = !!input.hasArchitecture;

  const verifyStatus: ControlStatus =
    reqs.total === 0 ? 'gap' : reqs.verified === reqs.total ? 'present' : 'partial';

  return [
    {
      key: 'inputs',
      name: 'Design Inputs',
      cite: 'IEC 62304 §5.2 · 21 CFR 820.30(c)',
      statement: 'What the software must do — the requirements, traced to product/user needs.',
      status: reqs.total > 0 ? 'present' : 'gap',
      detail:
        reqs.total > 0
          ? `${reqs.total} requirements${report.hasPrd ? ' · PRD register present' : ''}`
          : 'No requirements captured yet',
      link: 'srs',
    },
    {
      key: 'outputs',
      name: 'Design Outputs',
      cite: 'IEC 62304 §5.3–5.4 · 21 CFR 820.30(d)',
      statement: 'The realized design — software architecture (and detailed design).',
      status: hasArch ? 'partial' : 'gap',
      detail: hasArch
        ? 'Architecture documented; detailed design (SDD) is roadmap'
        : 'No architecture document yet',
      link: hasArch ? 'arch' : undefined,
    },
    {
      key: 'verification',
      name: 'Design Verification',
      cite: 'IEC 62304 §5.5–5.7 · 21 CFR 820.30(f)',
      statement: 'Evidence the outputs meet the inputs — verification tests and results.',
      status: verifyStatus,
      detail: `${reqs.verified}/${reqs.total} requirements verified`,
      link: 'vtp',
    },
    {
      key: 'validation',
      name: 'Design Validation',
      cite: '21 CFR 820.30(g)',
      statement: 'Evidence the product meets user needs / intended use (distinct from verification).',
      status: 'gap',
      detail: 'Not yet captured — roadmap (PROD-13)',
    },
    {
      key: 'traceability',
      name: 'Traceability',
      cite: 'IEC 62304 §5.1 · trace matrix',
      statement: 'The linkage product requirement → requirement → verification.',
      status: reqs.total > 0 ? 'present' : 'gap',
      detail: 'PRD → requirement → test',
      link: 'trace',
    },
    {
      key: 'changes',
      name: 'Design Changes',
      cite: 'IEC 62304 §6, §8 · 21 CFR 820.30(i)',
      statement: 'Controlled, attributed change — every change tied to an authorized job.',
      status: jobs.length > 0 ? 'present' : 'gap',
      detail: jobs.length > 0 ? `${jobs.length} jobs · Job: commit trailers` : 'No jobs recorded yet',
      link: 'jobs',
    },
    {
      key: 'dhf',
      name: 'Design History File',
      cite: '21 CFR 820.30(j)',
      statement: 'The complete, versioned record of the design.',
      status: releaseCount > 0 ? 'present' : 'partial',
      detail: releaseCount > 0 ? `${releaseCount} releases + the repository` : 'The repository (no tagged releases yet)',
      link: 'releases',
    },
    {
      key: 'reviews',
      name: 'Design Reviews',
      cite: '21 CFR 820.30(e)',
      statement: 'Review and ratification of the design at defined stages.',
      status: 'partial',
      detail: 'Governance checks + git review; no formal review records yet',
    },
    {
      key: 'risk',
      name: 'Risk Management',
      cite: 'ISO 14971 · IEC 62304 §7',
      statement: 'Hazard analysis and risk control measures, traced to requirements/tests.',
      status: 'gap',
      detail: 'Not yet captured — roadmap (PROD-20)',
    },
    {
      key: 'config',
      name: 'Configuration Management',
      cite: 'IEC 62304 §8 · 21 CFR 820.40',
      statement: 'Identification and control of versions and baselines.',
      status: 'present',
      detail: 'git + release snapshots + schemaVersion',
      link: 'releases',
    },
  ];
}
