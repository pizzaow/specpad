/**
 * standards — the Auditor view's conformity model.
 *
 * One entry per clause of each standard SpecPad is trying to satisfy, with a status
 * derived from the loaded project where it can be derived and stated plainly where it
 * cannot. The point is to answer a reviewer's question directly: *for this clause, what
 * do you have and where is it?*
 *
 * There is deliberately no "gap" status. A clause SpecPad does not hold is not a hole in
 * the evidence — it is evidence kept somewhere else, and saying which system holds it is
 * more useful to a reviewer than an alarm. `elsewhere` carries that pointer, and the
 * references register is where a project records the document it points at.
 */
import type {
  PrdDoc, SrsDoc, VtpDoc, SddDoc, RiskDoc, SoupDoc, ThreatDoc, ReferenceDoc, ReleasesDoc, JobRecord,
} from './shared';
import type { ViewKey } from './components/ViewTabs';

export type ConformanceStatus = 'met' | 'partial' | 'elsewhere' | 'not-applicable';

export interface ClauseEntry {
  clause: string;
  title: string;
  status: ConformanceStatus;
  /** What is held, or which system holds it. Never a bare status word. */
  detail: string;
  link?: ViewKey;
}

export interface StandardSection {
  id: string;
  /** Short label for the tab. */
  label: string;
  /** The document's full title and edition, as it would be cited. */
  cite: string;
  /** What this standard asks of the project, in one or two sentences. */
  scope: string;
  clauses: ClauseEntry[];
}

export interface StandardsInput {
  prd?: PrdDoc | null;
  srs?: SrsDoc | null;
  vtp?: VtpDoc | null;
  sdd?: SddDoc | null;
  risk?: RiskDoc | null;
  soup?: SoupDoc | null;
  threat?: ThreatDoc | null;
  reference?: ReferenceDoc | null;
  releases?: ReleasesDoc | null;
  jobs?: JobRecord[];
  hasArchitecture?: boolean;
  hasSecurityArchitecture?: boolean;
}

const live = <T,>(items: T[] | undefined, isHeading: (t: T) => boolean) =>
  (items ?? []).filter((i) => !isHeading(i));

/**
 * Where a clause is held outside SpecPad, name the reference that accounts for it — the
 * register exists precisely so this pointer resolves to a real document.
 */
function heldElsewhere(reference: ReferenceDoc | null | undefined, match: RegExp, fallback: string): ClauseEntry['detail'] {
  const entry = (reference?.items ?? []).find(
    (r) => !r.heading && (r.covers ?? []).some((c) => match.test(c)),
  );
  if (!entry) return `${fallback} — not yet named in the references register`;
  const id = entry.identifier ? ` (${entry.identifier})` : '';
  return `Held in ${entry.title}${id}${entry.owner ? `, owned by ${entry.owner}` : ''}`;
}

export function buildStandards(input: StandardsInput): StandardSection[] {
  const reqs = live(input.srs?.items, (i) => !!i.heading);
  const tests = live(input.vtp?.items, (i) => !!i.heading);
  const units = live(input.sdd?.items, (i) => !!i.heading).filter((s) => (s.kind ?? 'unit') === 'unit');
  const risks = live(input.risk?.items, (i) => !!i.heading);
  const components = live(input.soup?.items, (i) => !!i.heading);
  const threats = live(input.threat?.items, (i) => !!i.heading);
  const ref = input.reference;

  const verified = reqs.filter((r) => tests.some((t) => (t.verifies ?? []).includes(r.id))).length;
  const designed = reqs.filter((r) => (r.design ?? []).length > 0).length;
  const categorised = reqs.filter((r) => (r.category ?? []).length > 0).length;
  const levels = new Set(tests.map((t) => t.verificationLevel).filter(Boolean));
  const withAcceptance = units.filter((u) => (u.acceptance ?? '').trim()).length;
  const releaseCount = input.releases?.releases.length ?? 0;
  const anomaliesRecorded = (input.releases?.releases ?? []).some((r) => (r.anomalies ?? []).length > 0);
  const buildRecorded = (input.releases?.releases ?? []).some((r) => (r.build ?? '').trim());

  const some = (n: number, total: number): ConformanceStatus =>
    total === 0 ? 'elsewhere' : n === total ? 'met' : n > 0 ? 'partial' : 'elsewhere';

  const iec62304: StandardSection = {
    id: 'iec62304',
    label: 'IEC 62304',
    cite: 'IEC 62304:2006+A1:2015 — Medical device software: software life cycle processes',
    scope:
      'The life-cycle processes for medical device software. SpecPad holds the design and verification records; the process documents that govern how the project is run are kept in the quality system.',
    clauses: [
      {
        clause: '4.3',
        title: 'Software safety classification',
        status: 'met',
        detail: 'Declared on the project index with its rationale; authoring stays at maximum rigor regardless of the class',
      },
      {
        clause: '5.1',
        title: 'Software development planning',
        status: 'elsewhere',
        detail: heldElsewhere(ref, /5\.1|planning/i, 'The software development plan is a quality-system document'),
        link: 'reference',
      },
      {
        clause: '5.2',
        title: 'Software requirements analysis',
        status: reqs.length > 0 ? 'met' : 'elsewhere',
        detail: reqs.length > 0 ? `${reqs.length} requirements, ${categorised} categorised against 5.2.2 a)–l)` : 'No requirements captured',
        link: 'srs',
      },
      {
        clause: '5.3',
        title: 'Software architectural design',
        status: input.hasArchitecture ? 'met' : 'elsewhere',
        detail: input.hasArchitecture ? 'arc42 architecture document, with SOUP requirements recorded per component (5.3.3, 5.3.4)' : 'No architecture document',
        link: 'arch',
      },
      {
        clause: '5.4',
        title: 'Software detailed design',
        status: some(designed, reqs.length),
        detail: units.length > 0 ? `${units.length} software units · ${designed}/${reqs.length} requirements traced to a design section` : 'No detailed design',
        link: 'sdd',
      },
      {
        clause: '5.5',
        title: 'Unit implementation and verification',
        status: units.length === 0 ? 'elsewhere' : some(withAcceptance, units.length),
        detail: units.length > 0 ? `${withAcceptance}/${units.length} units state acceptance criteria (5.5.3)` : 'No software units recorded',
        link: 'sdd',
      },
      {
        clause: '5.6 / 5.7',
        title: 'Integration and system testing',
        status: levels.size >= 2 ? 'met' : levels.size === 1 ? 'partial' : 'elsewhere',
        detail: levels.size > 0 ? `Tests classified as ${[...levels].join(', ')}` : 'Verification level not recorded on tests',
        link: 'vtp',
      },
      {
        clause: '5.8',
        title: 'Software release',
        status: releaseCount === 0 ? 'elsewhere' : anomaliesRecorded && buildRecorded ? 'met' : 'partial',
        detail: releaseCount === 0
          ? 'No tagged releases yet'
          : `${releaseCount} releases · ${anomaliesRecorded ? 'known anomalies recorded' : 'no known anomalies recorded (5.8.2)'} · ${buildRecorded ? 'build recorded' : 'no build record (5.8.5)'}`,
        link: 'releases',
      },
      {
        clause: '6',
        title: 'Software maintenance',
        status: 'elsewhere',
        detail: heldElsewhere(ref, /clause 6|maintenance/i, 'The maintenance plan and feedback intake are quality-system processes'),
        link: 'reference',
      },
      {
        clause: '7',
        title: 'Software risk management',
        status: risks.length > 0 ? 'met' : 'elsewhere',
        detail: risks.length > 0
          ? `${risks.length} risks, each naming its causes and controlling requirements; control verification derives from the trace (7.3.1)`
          : 'No software risk analysis',
        link: 'risk',
      },
      {
        clause: '8',
        title: 'Configuration management',
        status: 'met',
        detail: `git, release snapshots and schemaVersion${components.length ? ` · ${components.length} SOUP components exactly identified (8.1.2)` : ''}`,
        link: 'releases',
      },
      {
        clause: '9',
        title: 'Software problem resolution',
        status: 'elsewhere',
        detail: heldElsewhere(ref, /clause 9|problem/i, 'Problem reports live in the issue tracker'),
        link: 'reference',
      },
    ],
  };

  const fdaSoftware: StandardSection = {
    id: 'fda-software',
    label: 'FDA Software',
    cite: 'FDA — Content of Premarket Submissions for Device Software Functions (June 2023)',
    scope:
      'What a premarket submission should contain for a device software function. Documentation level (Basic or Enhanced) scales the depth; SpecPad authors at the deeper level throughout.',
    clauses: [
      { clause: 'Documentation level', title: 'Basic or Enhanced', status: 'met', detail: 'Authored at Enhanced depth throughout, so a Basic submission omits rather than rewrites' },
      { clause: 'Software description', title: 'Overview and features', status: input.hasArchitecture ? 'met' : 'partial', detail: 'The architecture document and its context views', link: 'arch' },
      { clause: 'Risk management file', title: 'Analysis, controls, verification', status: risks.length > 0 ? 'met' : 'elsewhere', detail: risks.length > 0 ? `${risks.length} software risks; the system-level file is referenced by hazardRef` : 'Held in the system risk management file', link: 'risk' },
      { clause: 'Requirements specification', title: 'SRS', status: reqs.length > 0 ? 'met' : 'elsewhere', detail: `${reqs.length} requirements`, link: 'srs' },
      { clause: 'System/architecture design', title: 'Architecture diagram', status: input.hasArchitecture ? 'met' : 'elsewhere', detail: 'arc42 plus C4 views', link: 'arch' },
      { clause: 'Design specification', title: 'SDS', status: units.length > 0 ? 'met' : 'elsewhere', detail: units.length > 0 ? `${units.length} software units` : 'No detailed design', link: 'sdd' },
      { clause: 'Testing', title: 'Unit, integration and system level', status: levels.size >= 2 ? 'met' : 'partial', detail: `${verified}/${reqs.length} requirements verified; results derived from a captured run`, link: 'vtp' },
      { clause: 'Traceability', title: 'Requirements to testing', status: reqs.length > 0 ? 'met' : 'elsewhere', detail: 'Product need → requirement → design → test, all by stable id', link: 'trace' },
      { clause: 'Unresolved anomalies', title: 'Known defects at release', status: anomaliesRecorded ? 'met' : 'partial', detail: anomaliesRecorded ? 'Recorded per release with the evaluation that made shipping acceptable' : 'Recordable per release; none recorded yet', link: 'releases' },
      { clause: 'Revision history', title: 'Version history', status: releaseCount > 0 ? 'met' : 'partial', detail: releaseCount > 0 ? `${releaseCount} releases with their change sets` : 'The repository; no tagged releases yet', link: 'releases' },
    ],
  };

  const fdaCyber: StandardSection = {
    id: 'fda-cyber',
    label: 'FDA Cybersecurity',
    cite: 'FDA — Cybersecurity in Medical Devices: Quality Management System Considerations and Content of Premarket Submissions (3 February 2026)',
    scope:
      'Security as part of device safety and the quality system. Supersedes the June 2025 edition and aligns the guidance with the QMSR.',
    clauses: [
      { clause: 'Threat modelling', title: 'Threats, assessed', status: threats.length > 0 ? 'met' : 'elsewhere', detail: threats.length > 0 ? `${threats.length} threats, rated on exploitability, each controlled or justified` : 'No threat model', link: 'threat' },
      { clause: 'Security risk management', title: 'One register with safety', status: threats.length > 0 ? 'met' : 'elsewhere', detail: 'A threat with a patient consequence names the safety risk it creates (AAMI SW96)', link: 'threat' },
      { clause: 'Security architecture views', title: 'Global, multi-patient, updateability, use cases', status: input.hasSecurityArchitecture ? 'met' : 'elsewhere', detail: input.hasSecurityArchitecture ? 'All four view types, with a diagram and a communication-path table per view' : 'No security architecture document', link: 'sec' },
      { clause: 'Security controls', title: 'Implemented and verified', status: threats.length > 0 ? 'met' : 'elsewhere', detail: 'A control is recorded as a requirement, so its verification comes from the ordinary trace', link: 'srs' },
      { clause: 'SBOM', title: 'Machine-readable inventory (§524B)', status: 'elsewhere', detail: 'Generated from the dependency manifests by the build; the SOUP register is the assessed subset, not the SBOM', link: 'soup' },
      { clause: 'Vulnerability management', title: 'Monitoring, triage, disclosure', status: 'elsewhere', detail: heldElsewhere(ref, /vulnerab|disclosure|524B/i, 'Post-market monitoring and disclosure are quality-system processes'), link: 'reference' },
      { clause: 'Security testing', title: 'Beyond ordinary V&V', status: 'partial', detail: 'Control effectiveness is verified through the requirement trace; penetration testing is not held here', link: 'vtp' },
    ],
  };

  const fdaOts: StandardSection = {
    id: 'fda-ots',
    label: 'FDA OTS',
    cite: 'FDA — Off-The-Shelf Software Use in Medical Devices (August 2023)',
    scope:
      'What must be known about software the manufacturer did not write. Runs alongside IEC 62304 §5.3.3, §5.3.4 and §8.1.2 rather than instead of them.',
    clauses: [
      { clause: 'Identification', title: 'Title, manufacturer, exact version', status: components.length > 0 ? 'met' : 'elsewhere', detail: components.length > 0 ? `${components.length} components, each with a supplier and an exact version` : 'No component register', link: 'soup' },
      { clause: 'Why used', title: 'Purpose and appropriateness', status: components.length > 0 ? 'met' : 'elsewhere', detail: 'Each component records what it does here and why it is appropriate', link: 'soup' },
      { clause: 'Requirements placed on it', title: 'Functional and performance', status: components.length > 0 ? 'met' : 'elsewhere', detail: 'Recorded per component (IEC 62304 §5.3.3)', link: 'soup' },
      { clause: 'Computing requirements', title: 'What it needs to run', status: components.length > 0 ? 'met' : 'elsewhere', detail: 'Hardware and software prerequisites per component (§5.3.4)', link: 'soup' },
      { clause: 'Design limitations', title: 'What it is known not to do', status: components.length > 0 ? 'met' : 'elsewhere', detail: 'Recorded per component', link: 'soup' },
      { clause: 'Anomaly list review', title: 'Published defects', status: 'elsewhere', detail: 'A per-version exercise against a moving feed; belongs with the SBOM and its vulnerability monitoring', link: 'soup' },
      { clause: 'End of support', title: 'Lifecycle and contingency', status: components.length > 0 ? 'met' : 'elsewhere', detail: 'End-of-life date with its source, and the contingency when support ends', link: 'soup' },
      { clause: 'Verification', title: 'That it performs as required', status: components.length > 0 ? 'partial' : 'elsewhere', detail: 'A component can name the tests exercising it; not every component does yet', link: 'soup' },
    ],
  };

  return [iec62304, fdaSoftware, fdaCyber, fdaOts];
}

/** Standards SpecPad does not implement, but which govern the project around it. */
export interface ConnectedStandard {
  cite: string;
  role: string;
  relationship: string;
}

export const CONNECTED_STANDARDS: ConnectedStandard[] = [
  {
    cite: 'ISO 13485:2016 — Quality management systems for medical devices',
    role: 'The quality system the whole project runs inside.',
    relationship:
      'Since 2 February 2026 the FDA\'s Quality Management System Regulation incorporates it by reference into 21 CFR Part 820, with FDA-specific supplements in Subparts A and B. Design and development is §7.3 — the clauses the design-control map is built on. SpecPad produces records that a §7.3 design and development file consumes; it is not a quality system and holds no procedures, training records or management review.',
  },
  {
    cite: 'ISO 14971:2019 — Application of risk management to medical devices',
    role: 'Risk management for the device as a whole.',
    relationship:
      'SpecPad holds the software slice only — the hazardous situations software can contribute to, their causes and controls. Hazards, harms, probability estimation, benefit-risk analysis and post-market surveillance live in the system risk management file, which a risk record points at by `hazardRef`.',
  },
  {
    cite: 'IEC 81001-5-1:2021 — Health software security life cycle',
    role: 'The security development lifecycle behind the threat model.',
    relationship:
      'Runs alongside IEC 62304 as the secure-development process. SpecPad holds its outputs — the threat model and the security architecture — rather than the process itself.',
  },
  {
    cite: 'AAMI TIR57 / SW96 — Security risk management',
    role: 'How security risk is assessed beside safety risk.',
    relationship:
      'The reason the threat model is one register rather than two, rates exploitability rather than probability, and links a threat to the safety risk exploiting it would create.',
  },
  {
    cite: 'IEC 62366-1:2015 — Usability engineering',
    role: 'Usability engineering and the use-related risk it controls.',
    relationship:
      'Not held here. Requirements categorised `user-interface` (IEC 62304 §5.2.2 f) are the software side of it; the usability engineering file itself is a separate deliverable.',
  },
];

/** What SpecPad deliberately does not do, stated once so a reviewer is not left inferring. */
export const INTENTIONAL_OMISSIONS: { title: string; reason: string }[] = [
  {
    title: 'SpecPad is not a quality management system',
    reason:
      'It holds design and verification records, not procedures, training records, supplier controls, management review or CAPA. Those belong to ISO 13485 and the system that implements it.',
  },
  {
    title: 'Process documents are named, not duplicated',
    reason:
      'Development planning (§5.1), maintenance (clause 6) and problem resolution (clause 9) are required, and most organisations already run them in a quality system or an issue tracker. A second copy in a git repository would be the stale one, so the references register names and locates them instead.',
  },
  {
    title: 'No SBOM is generated here',
    reason:
      'An SBOM is a recursive inventory of every dependency, produced from the manifests by the build. The SOUP register is the assessed subset — a smaller, human-judged list. Letting one stand in for the other would misrepresent both.',
  },
  {
    title: 'No probability on a software risk',
    reason:
      'Software fails deterministically: given the same conditions the defect occurs every time. Severity and the presence of a control carry the analysis, which is how IEC 62304 treats it. Security risk drops probability for the opposite reason — an attacker chooses when to act — and uses exploitability instead.',
  },
  {
    title: 'No requirement-to-architecture trace matrix',
    reason:
      'Architecture is coupled to jobs and releases rather than to individual requirements. A matrix at that granularity is expensive to maintain and, in practice, is maintained badly.',
  },
  {
    title: 'Design validation is not held here',
    reason:
      'Verification asks whether the outputs meet the inputs, which SpecPad answers. Validation asks whether the product meets user needs in its intended environment — clinical evaluation, human factors, field data — which is a system-level activity outside the software record.',
  },
];
