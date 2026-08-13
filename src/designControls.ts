/**
 * designControls — the Auditor view's design-control map. Pure: from the loaded
 * project it produces the formal elements (ISO 13485 §7.3 + IEC 62304), each
 * with a citation, a plain statement, a status derived live, and a link to the
 * tab that holds the evidence. This is the surface an engineer uses to answer an
 * auditor's "where are your design inputs / verification / …?".
 */
import type { PrdDoc, SrsDoc, VtpDoc, SddDoc, RiskDoc, ReleasesDoc, JobRecord } from './shared';
import { buildAuditReport } from './auditReport';
import type { ViewKey } from './components/ViewTabs';

/**
 * `elsewhere` rather than `gap`: an element SpecPad does not hold is not missing evidence,
 * it is evidence another system holds. Saying which system is more use to a reviewer than
 * raising an alarm about a boundary that was drawn on purpose.
 */
export type ControlStatus = 'present' | 'partial' | 'elsewhere';

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
  sdd?: SddDoc | null;
  risk?: RiskDoc | null;
  jobs?: JobRecord[];
  releases?: ReleasesDoc | null;
  hasArchitecture?: boolean;
}

/** Plain-language "where this stands", so the status is never a bare word. */
function describeOutputs(hasArch: boolean, hasSdd: boolean, sections: number, undesigned: number): string {
  if (!hasArch && !hasSdd) return 'No architecture or detailed design yet';
  if (hasArch && !hasSdd) return 'Architecture documented; no detailed design yet';
  if (!hasArch && hasSdd) return `${sections} design sections; no architecture document yet`;
  return undesigned > 0
    ? `Architecture documented · ${sections} design sections · ${undesigned} requirement(s) not yet traced to a design section`
    : `Architecture documented · ${sections} design sections · every requirement traced to a design section`;
}

export function buildDesignControls(input: DesignControlsInput): ControlElement[] {
  const report = buildAuditReport({ prd: input.prd, srs: input.srs, vtp: input.vtp });
  const reqs = report.coverage.requirements;
  const jobs = input.jobs ?? [];
  const releaseCount = input.releases?.releases.length ?? 0;
  const hasArch = !!input.hasArchitecture;
  // A detailed design counts only once it says something: an empty register is a file,
  // not a design output.
  const designSections = (input.sdd?.items ?? []).filter((s) => !s.heading);
  const hasSdd = designSections.length > 0;
  // 62304 5.3 (architecture) and 5.4 (detailed design) are both Design Outputs, so the
  // element is complete only with both, and partial with either alone.
  const outputsStatus: ControlStatus = hasArch && hasSdd ? 'present' : hasArch || hasSdd ? 'partial' : 'elsewhere';
  const undesigned = reqs.total > 0 ? (input.srs?.items ?? []).filter((r) => !r.heading && (r.design ?? []).length === 0).length : 0;

  // Risk Management (ISO 14971 / 62304 §7). Derived from the register rather than
  // hardcoded: present once every risk is controlled or justified, partial while any is
  // not. A control's verification lives in the trace, so it is not re-counted here.
  const risks = (input.risk?.items ?? []).filter((r) => !r.heading);
  const uncontrolled = risks.filter((r) => (r.controls ?? []).length === 0 && !(r.justification ?? '').trim());
  const unassessed = risks.filter((r) => (r.residual ?? 'not_assessed') === 'not_assessed');
  const riskStatus: ControlStatus =
    risks.length === 0 ? 'elsewhere' : uncontrolled.length === 0 && unassessed.length === 0 ? 'present' : 'partial';
  const riskDetail =
    risks.length === 0
      ? 'No software risk analysis yet'
      : [
          `${risks.length} risks`,
          uncontrolled.length > 0 ? `${uncontrolled.length} uncontrolled` : 'all controlled or justified',
          unassessed.length > 0 ? `${unassessed.length} residual risk not assessed` : 'residual risk assessed',
        ].join(' · ');

  const verifyStatus: ControlStatus =
    reqs.total === 0 ? 'elsewhere' : reqs.verified === reqs.total ? 'present' : 'partial';

  return [
    {
      key: 'inputs',
      name: 'Design Inputs',
      cite: 'IEC 62304 §5.2 · ISO 13485 §7.3.3',
      statement: 'What the software must do — the requirements, traced to product/user needs.',
      status: reqs.total > 0 ? 'present' : 'elsewhere',
      detail:
        reqs.total > 0
          ? `${reqs.total} requirements${report.hasPrd ? ' · PRD register present' : ''}`
          : 'No requirements captured yet',
      link: 'srs',
    },
    {
      key: 'outputs',
      name: 'Design Outputs',
      cite: 'IEC 62304 §5.3–5.4 · ISO 13485 §7.3.4',
      statement: 'The realized design — the software architecture and the detailed design.',
      status: outputsStatus,
      detail: describeOutputs(hasArch, hasSdd, designSections.length, undesigned),
      link: hasSdd && !hasArch ? 'sdd' : hasArch ? 'arch' : undefined,
    },
    {
      key: 'verification',
      name: 'Design Verification',
      cite: 'IEC 62304 §5.5–5.7 · ISO 13485 §7.3.6',
      statement: 'Evidence the outputs meet the inputs — verification tests and results.',
      status: verifyStatus,
      detail: `${reqs.verified}/${reqs.total} requirements verified`,
      link: 'vtp',
    },
    {
      key: 'validation',
      name: 'Design Validation',
      cite: 'ISO 13485 §7.3.7',
      statement: 'Evidence the product meets user needs / intended use (distinct from verification).',
      status: 'elsewhere',
      detail: 'A system-level activity — clinical evaluation and human factors, outside the software record',
    },
    {
      key: 'traceability',
      name: 'Traceability',
      cite: 'IEC 62304 §5.1 · trace matrix',
      statement: 'The linkage product requirement → requirement → verification.',
      status: reqs.total > 0 ? 'present' : 'elsewhere',
      detail: 'PRD → requirement → test',
      link: 'trace',
    },
    {
      key: 'changes',
      name: 'Design Changes',
      cite: 'IEC 62304 §6, §8 · ISO 13485 §7.3.9',
      statement: 'Controlled, attributed change — every change tied to an authorized job.',
      status: jobs.length > 0 ? 'present' : 'elsewhere',
      detail: jobs.length > 0 ? `${jobs.length} jobs · Job: commit trailers` : 'No jobs recorded yet',
      link: 'jobs',
    },
    {
      key: 'dhf',
      name: 'Design History File',
      cite: 'ISO 13485 §7.3.10',
      statement: 'The complete, versioned record of the design.',
      status: releaseCount > 0 ? 'present' : 'partial',
      detail: releaseCount > 0 ? `${releaseCount} releases + the repository` : 'The repository (no tagged releases yet)',
      link: 'releases',
    },
    {
      key: 'reviews',
      name: 'Design Reviews',
      cite: 'ISO 13485 §7.3.5',
      statement: 'Review and ratification of the design at defined stages.',
      status: 'partial',
      detail: 'Governance checks and git review here; formal review records are a quality-system document',
    },
    {
      key: 'risk',
      name: 'Risk Management',
      cite: 'ISO 14971 · IEC 62304 §7',
      statement: 'Hazard analysis and risk control measures, traced to requirements/tests.',
      status: riskStatus,
      detail: riskDetail,
      link: risks.length > 0 ? 'risk' : undefined,
    },
    {
      key: 'config',
      name: 'Configuration Management',
      cite: 'IEC 62304 §8 · ISO 13485 §4.2.4–4.2.5',
      statement: 'Identification and control of versions and baselines.',
      status: 'present',
      detail: 'git + release snapshots + schemaVersion',
      link: 'releases',
    },
  ];
}
