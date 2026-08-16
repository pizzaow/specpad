// v1 SpecPad contract: TypeScript types + JSON Schema documents.
// JSON Schema enforces STRUCTURE ONLY. Policy lives in governance.ts.

export const SCHEMA_VERSION = '1.0' as const;
export type SchemaVersion = typeof SCHEMA_VERSION;
export type DocType = 'project' | 'srs' | 'vtp' | 'prd' | 'sdd' | 'risk' | 'soup' | 'threat';
export type TestResult = '' | 'not_tested' | 'passed' | 'failed';

export interface ProjectDocRef {
  type: 'srs' | 'vtp' | 'prd' | 'sdd' | 'risk' | 'soup' | 'threat';
  path: string;
  title: string;
}

export interface ProjectDoc {
  schemaVersion: SchemaVersion;
  type: 'project';
  name: string;
  title: string;
  description?: string;
  // Where the generated launcher sends people. Absent = the public hosted editor;
  // set it to a company's own SpecPad server so the whole team lands there (EDR-4).
  editorBaseUrl?: string;
  /** Which project on a multi-project self-hosted server this repo is (MPT-10). */
  editorProjectId?: string;
  /**
   * The software safety class and why (IEC 62304 §4.3). Declared rather than derived:
   * authoring stays at maximum rigor whatever the class says, so this is a record of the
   * judgement, not a switch that removes content. Material beyond the declared class is
   * highlighted as advice rather than dropped.
   */
  safetyClass?: SafetyClass;
  safetyClassRationale?: string;
  /**
   * Advisory rules this project has chosen to be held to. Naming a rule here moves it from
   * advice into the blocking result — the way a project adopts a practice when it is ready
   * rather than on the day the rule ships.
   */
  enforce?: GovernanceRuleId[];
  documents: ProjectDocRef[];
}

/** IEC 62304 §4.3. Edition 2 replaces these with two rigor levels; not yet published. */
export type SafetyClass = 'A' | 'B' | 'C';

/**
 * Every governance rule. Lives here rather than in `governance.ts` so the project index can
 * name the rules it enforces; `governance.ts` re-exports it and owns the rule descriptions.
 */
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
  | 'soup-referential-integrity'
  | 'threat-referential-integrity'
  | 'threat-assessed'
  | 'threat-controlled'
  // Advisory by default (JOB-56): reported without failing until a project enforces them.
  | 'srs-category'
  | 'srs-cites'
  | 'srs-security-control'
  | 'vtp-verification-level'
  | 'vtp-negative-path'
  | 'sdd-segregation'
  // Advisory (JOB-56): asked of every unit and every risk, adopted when a project is ready.
  | 'sdd-unit-trace'
  | 'sdd-acceptance'
  | 'risk-sequence';

export interface SrsItem {
  id: string;
  code?: string;
  text: string;
  heading?: boolean;
  level?: number;
  satisfies?: string[]; // ids of PRD items this requirement satisfies (upward trace; ids, never codes)
  design?: string[]; // ids of SDD sections implementing this requirement (downward trace; ids, never codes)
  /**
   * Which of IEC 62304 §5.2.2's content categories this requirement is — a list, because
   * A1:2015 NOTE 10 says plainly that "the requirements in a) through l) can overlap".
   *
   * An enumeration rather than a free tag, because the point is the coverage question
   * ("is there really nothing under alarms?"), and against free text an absent category
   * and a misspelt one look identical. Headings carry the project's own grouping, so there
   * is no second free-form label competing with this one.
   */
  category?: RequirementCategory[];
  /**
   * Which FDA security control categories this requirement implements (Cybersecurity in
   * Medical Devices, February 2026, §V.B.1 and Appendix 1).
   *
   * A list, because one requirement often serves several — refusing a request from an
   * untrusted peer is authentication and authorization at once. Separate from `category`
   * because §5.2.2 e) says only "this is a security requirement"; this says which control
   * it is, which is what an adequate-coverage argument is built from.
   */
  securityControl?: SecurityControl[];
  /**
   * Drafted by a tool and not yet ratified by a person. The baseline generator sets it on
   * everything it writes; a reviewer clears it. Without it a scaffold is indistinguishable
   * from a specification, which is the one thing a draft must never be.
   */
  draft?: boolean;
  /**
   * What this rests on, so it can be checked rather than believed: a clause of a standard, a
   * source construct, a test that pins it. Free text and deliberately so — the sources a
   * project cites are not SpecPad's to enumerate — but present, because the review pass that
   * verifies a citation needs something to look up.
   */
  cites?: string[];
  hazards?: string[];
}

/**
 * The eight control categories FDA expects an adequate set to draw from (§V.B.1). Named
 * from the normative list in the body; Appendix 1 words the last one as "Firmware and
 * Software Updates" and details recommendations for each.
 */
export type SecurityControl =
  | 'authentication'
  | 'authorization'
  | 'cryptography'
  | 'integrity'
  | 'confidentiality'
  | 'event-detection'
  | 'resiliency'
  | 'updatability';

export const SECURITY_CONTROLS: { value: SecurityControl; label: string; text: string }[] = [
  { value: 'authentication', label: 'Authentication', text: 'Proving the origin of information and the identity of an endpoint or operator — at rest, in transit, and for software binaries' },
  { value: 'authorization', label: 'Authorization', text: 'What an authenticated party is permitted to do, enforced where the decision cannot be bypassed' },
  { value: 'cryptography', label: 'Cryptography', text: 'Algorithms, key lengths and key management; and the discipline of not inventing any of it' },
  { value: 'integrity', label: 'Code, data and execution integrity', text: 'That code, data and commands are what they were, and that running software has not been altered' },
  { value: 'confidentiality', label: 'Confidentiality', text: 'Keeping information from parties who should not read it, in transit and at rest' },
  { value: 'event-detection', label: 'Event detection and logging', text: 'Recording security-relevant events so an incident can be detected and later reconstructed' },
  { value: 'resiliency', label: 'Resiliency and recovery', text: 'Continuing to operate safely under attack, and returning to a known-good state afterwards' },
  { value: 'updatability', label: 'Updatability and patchability', text: 'Delivering a fix to a deployed device securely, and being able to show it arrived' },
];

/**
 * IEC 62304 §5.2.2 a)–l), the content a software requirements specification is expected to
 * cover. Twelve, not nine: f) and j) are the A1:2015 replacements, and i) "methods of
 * operation and maintenance" is a different item from k) "user maintenance requirements".
 */
export type RequirementCategory =
  | 'functional'
  | 'inputs-outputs'
  | 'interfaces'
  | 'alarms'
  | 'security'
  | 'user-interface'
  | 'data-definition'
  | 'installation'
  | 'operation-maintenance'
  | 'it-network'
  | 'user-maintenance'
  | 'regulatory';

/**
 * The twelve, with their letter and the standard's own wording — one list, so the editor,
 * the guide and the schema reference cannot drift apart.
 */
export const REQUIREMENT_CATEGORIES: { value: RequirementCategory; letter: string; label: string; text: string }[] = [
  { value: 'functional', letter: 'a', label: 'Functional', text: 'Functional and capability requirements' },
  { value: 'inputs-outputs', letter: 'b', label: 'Inputs/outputs', text: 'Software system inputs and outputs' },
  { value: 'interfaces', letter: 'c', label: 'Interfaces', text: 'Interfaces between the software system and other systems' },
  { value: 'alarms', letter: 'd', label: 'Alarms', text: 'Software-driven alarms, warnings and operator messages' },
  { value: 'security', letter: 'e', label: 'Security', text: 'Security requirements, including system security and malware protection' },
  { value: 'user-interface', letter: 'f', label: 'User interface', text: 'User interface requirements implemented by software (A1:2015)' },
  { value: 'data-definition', letter: 'g', label: 'Data', text: 'Data definition and database requirements' },
  { value: 'installation', letter: 'h', label: 'Installation', text: 'Installation and acceptance at the operation and maintenance site' },
  { value: 'operation-maintenance', letter: 'i', label: 'Operation', text: 'Requirements related to methods of operation and maintenance' },
  { value: 'it-network', letter: 'j', label: 'IT-network', text: 'Requirements related to IT-network aspects: networked alarms, protocols, and unavailability of network services (A1:2015)' },
  { value: 'user-maintenance', letter: 'k', label: 'User maintenance', text: 'User maintenance requirements' },
  { value: 'regulatory', letter: 'l', label: 'Regulatory', text: 'Regulatory requirements' },
];

export interface SrsDoc {
  schemaVersion: SchemaVersion;
  type: 'srs';
  name: string;
  title: string;
  items: SrsItem[];
}

// A framework-agnostic link from a verification test to the automated test that
// executes it. `runner` and `selector` are opaque to the SpecPad core: a runner
// adapter (or CI emitting a normalized RunRecord) interprets them. References are
// to test *code* (file + selector), so they're matched against a run's results.
export interface AutomationLink {
  runner: string; // opaque runner id, e.g. "vitest", "playwright", "pytest"
  file: string; // path to the test file (tracked in git)
  selector?: string; // runner-interpreted: a test name, a group/describe name, "#15", …; a group matches every test beneath it. Absent = the whole file
}

export interface VtpItem {
  id: string;
  code?: string;
  text: string;
  heading?: boolean;
  level?: number;
  verifies?: string[];
  expected?: string;
  result?: TestResult;
  /**
   * Which verification activity this test belongs to. IEC 62304 treats unit verification
   * (§5.5), integration testing (§5.6) and system testing (§5.7) as three activities with
   * distinct records; one flat register can show requirements are covered by something, but
   * not that each activity was performed. Named in full because `level` is already the
   * hierarchy indent depth on every item.
   */
  verificationLevel?: TestLevel;
  /**
   * What this test does to the system, as distinct from `verificationLevel` (which says at
   * what scope). A requirement proven only by `nominal` tests has been shown to work when
   * nothing goes wrong, which is the weaker half of the claim.
   */
  kind?: TestKind;
  /**
   * Which of FDA's recommended security testing types this is (*Cybersecurity in Medical
   * Devices*, February 2026, §V.C). Present so a reviewer asking "show me your fuzz
   * testing" is answered by a filter rather than by a search.
   */
  securityTest?: SecurityTestType[];
  /** Drafted by a tool and not yet ratified — see `SrsItem.draft`. */
  draft?: boolean;
  notes?: string;
  automation?: AutomationLink[]; // the automated test(s) that execute this verification (empty = manual)
}

export interface VtpDoc {
  schemaVersion: SchemaVersion;
  type: 'vtp';
  name: string;
  title: string;
  items: VtpItem[];
}

// The PRD register: optional, higher-level *product* requirements (user needs / product intent)
// that SRS requirements trace up to via SrsItem.satisfies. Same item shape as the SRS — stable id,
// renameable code, text — so it reuses the diff, table, and governance machinery. A PRD entry is
// product intent, not a code fact; it is the validation/design-control trace anchor. Optional: a
// project without a PRD register pays no PRD governance.

// A PRD item's lifecycle: 'proposed' = approved product intent not yet allocated to requirements
// (roadmap/vision; exempt from coverage); 'implemented' = realized in the product and therefore
// required to trace down to >=1 SRS requirement. Absent is treated as not-yet-implemented (exempt),
// so capturing a vision baseline never manufactures a false coverage gap.
export type PrdStatus = 'proposed' | 'implemented';

export interface PrdItem {
  id: string;
  code?: string;
  text: string;
  heading?: boolean;
  level?: number;
  status?: PrdStatus;
}

export interface PrdDoc {
  schemaVersion: SchemaVersion;
  type: 'prd';
  name: string;
  title: string;
  items: PrdItem[];
}

/**
 * One section of the software detailed design (IEC 62304 5.4; FDA Software Design
 * Specification; IEEE 1016 design view).
 *
 * A section is prose, not a field-per-unit record: `body` is markdown and may embed
 * diagrams the same way the architecture document does. What makes it linkable is the
 * stable `id` — requirements point at it, and the link survives any amount of renaming
 * or rewriting, which is the whole reason the design can stay free-form.
 */
export interface SddSection {
  id: string;
  code?: string;
  /** Section heading — freely renameable, because nothing references it. */
  title: string;
  heading?: boolean;
  level?: number;
  /** Markdown: the design itself. Images and diagrams resolve like the SAD's. */
  body?: string;
  /**
   * What this section is: a software unit (IEC 62304 §5.4.2) or a cross-cutting design
   * view (IEEE 1016). Absent means unit, which is the common case. Risk causes and the
   * unit list §5.4.1 asks for both depend on the distinction.
   */
  kind?: SddSectionKind;
  /** Repository paths this section describes — what makes it checkable against code. */
  source?: string[];
  /**
   * What "verified" means for this unit (IEC 62304 §5.5.3, and §5.5.4's additional criteria
   * at Class C: event sequencing, resource use, fault handling, boundary values).
   *
   * A field rather than a line of prose because §5.5.3 is asked per unit and answered as a
   * list; buried in `body` it cannot be rolled up, governed, or shown to a reviewer.
   */
  acceptance?: string;
  /**
   * Other units this one is segregated from, where the separation is essential to risk
   * control (IEC 62304 §5.3.5). Ids, never codes.
   */
  segregatedFrom?: string[];
  /** Why the segregation holds — A1:2015 asks how effectiveness is ensured, not only that it exists. */
  segregationRationale?: string;
  /** Drafted by a tool and not yet ratified — see `SrsItem.draft`. */
  draft?: boolean;
}

export type SddSectionKind = 'unit' | 'view';

/** The verification activity a test belongs to (IEC 62304 §5.5, §5.6, §5.7). */
export type TestLevel = 'unit' | 'integration' | 'system';

/**
 * What a test does to the system. A well-formed protocol proves a requirement with a
 * nominal case and then attacks it: the boundaries, the refusals, and the load.
 */
export type TestKind = 'nominal' | 'boundary' | 'negative' | 'stress' | 'security';

export const TEST_KINDS: { value: TestKind; label: string; text: string }[] = [
  { value: 'nominal', label: 'Nominal', text: 'The happy path — the behaviour the requirement describes, under the conditions it assumes' },
  { value: 'boundary', label: 'Boundary', text: 'The edges of the accepted range, and which side of each edge is accepted' },
  { value: 'negative', label: 'Negative', text: 'Invalid input, refused operations, and error paths — what the system will not do' },
  { value: 'stress', label: 'Stress', text: 'Volume, concurrency, exhaustion and sustained load' },
  { value: 'security', label: 'Security', text: 'Testing beyond ordinary verification, in a security context (FDA §V.C)' },
];

/**
 * FDA's recommended security testing types (§V.C), which draw on ANSI/ISA 62443-4-1 for the
 * vulnerability-testing group. Recorded per test so the set can be produced on request.
 */
export type SecurityTestType =
  | 'security-requirements'
  | 'threat-mitigation'
  | 'abuse-case'
  | 'malformed-input'
  | 'robustness'
  | 'fuzz'
  | 'attack-surface'
  | 'vulnerability-chaining'
  | 'known-vulnerability-scan'
  | 'composition-analysis'
  | 'static-analysis'
  | 'dynamic-analysis'
  | 'penetration';

export const SECURITY_TEST_TYPES: { value: SecurityTestType; group: string; label: string }[] = [
  { value: 'security-requirements', group: 'Security requirements', label: 'Each security requirement implemented, with boundary analysis and its rationale' },
  { value: 'threat-mitigation', group: 'Threat mitigation', label: 'Each risk control effective against the threat model, and adequate under load' },
  { value: 'abuse-case', group: 'Vulnerability testing', label: 'Abuse and misuse cases' },
  { value: 'malformed-input', group: 'Vulnerability testing', label: 'Malformed and unexpected input' },
  { value: 'robustness', group: 'Vulnerability testing', label: 'Robustness' },
  { value: 'fuzz', group: 'Vulnerability testing', label: 'Fuzz testing' },
  { value: 'attack-surface', group: 'Vulnerability testing', label: 'Attack surface analysis' },
  { value: 'vulnerability-chaining', group: 'Vulnerability testing', label: 'Vulnerability chaining' },
  { value: 'known-vulnerability-scan', group: 'Vulnerability testing', label: 'Closed-box scanning for known vulnerabilities' },
  { value: 'composition-analysis', group: 'Vulnerability testing', label: 'Software composition analysis of binaries' },
  { value: 'static-analysis', group: 'Vulnerability testing', label: 'Static analysis, including hardcoded and default credentials' },
  { value: 'dynamic-analysis', group: 'Vulnerability testing', label: 'Dynamic analysis' },
  { value: 'penetration', group: 'Penetration testing', label: 'Penetration testing, with tester independence, scope, duration and method recorded' },
];

export const TEST_LEVELS: { value: TestLevel; label: string }[] = [
  { value: 'unit', label: 'Unit' },
  { value: 'integration', label: 'Integration' },
  { value: 'system', label: 'System' },
];

/**
 * One entry in the software risk analysis (IEC 62304 §7).
 *
 * The §7 slice only: a hazardous situation software can contribute to, the software
 * items that could cause it, and the requirements controlling it. Hazards, harms,
 * probability estimation, benefit-risk and post-market surveillance belong to the
 * system risk management file the quality system owns; `hazardRef` points at it.
 *
 * There is deliberately no probability field. For software you cannot argue probability
 * down — a defect is present or it is not — so severity drives the analysis.
 */
export interface RiskItem {
  id: string;
  code?: string;
  heading?: boolean;
  level?: number;
  /** The hazardous situation, stated in terms of what the software does or fails to do. */
  text: string;
  /** Identifier of the hazard or hazardous situation in the system risk management file. */
  hazardRef?: string;
  severity?: RiskSeverity;
  /**
   * The sequence of events that turns the software failure into the hazardous situation
   * (IEC 62304 §7.1.5, and §7.3.2 for a sequence a control itself introduces).
   *
   * This is the analysis, not decoration: "the value is wrong" is a defect, while "the value
   * is wrong, no range check rejects it, the clinician reads it as measured, and dosing
   * follows" is a risk. Recording only the endpoint hides every step a control could break.
   */
  sequence?: string;
  /**
   * Ids of the software items that could cause it (§7.1): SDD sections describing a
   * unit, or SOUP components. A cause is whatever could fail, ours or a supplier's.
   */
  causes?: string[];
  /** SRS requirement ids implementing the risk control measures (§7.2, §5.2.2). */
  controls?: string[];
  /** Why no software control is needed, when there is none — e.g. controlled in hardware. */
  justification?: string;
  residual?: ResidualRisk;
  notes?: string;
}

/**
 * Severity of the harm. ISO 14971 leaves the scale to the manufacturer; this is
 * SpecPad's, and a project using a different one maps onto it.
 */
export type RiskSeverity = 'negligible' | 'minor' | 'serious' | 'critical' | 'catastrophic';

/** The judgement recorded after the controls are in place. */
export type ResidualRisk = 'acceptable' | 'unacceptable' | 'not_assessed';

export interface RiskDoc {
  schemaVersion: SchemaVersion;
  type: 'risk';
  name: string;
  title: string;
  items: RiskItem[];
}

/**
 * One third-party software component the product depends on (IEC 62304 SOUP; FDA
 * off-the-shelf software).
 *
 * Covers both regimes: 62304 asks what you *require* of the component (§5.3.3), what it
 * needs to run (§5.3.4), and what is known to be wrong with the exact version you ship
 * (§7.1.2); the FDA guidance asks where it came from, why it is appropriate, what its
 * limits are, and what happens when the vendor stops supporting it.
 *
 * Requirements placed on the component are text here rather than SRS entries: they are
 * requirements on a vendor, and the SRS holds only what this product implements.
 *
 * This is not an SBOM. An SBOM is a recursive inventory of every dependency, generated
 * from the manifests; this is the far smaller set that has actually been assessed.
 */
export interface SoupItem {
  id: string;
  code?: string;
  heading?: boolean;
  level?: number;
  /** The component's name, as its supplier calls it. */
  name: string;
  /** Manufacturer, project or source (§8.1.2). */
  vendor?: string;
  /** The exact version in use, including patch or upgrade designation (§8.1.2). */
  version?: string;
  /** Release date of that version. */
  releaseDate?: string;
  license?: string;
  url?: string;
  /** What it does in this product, and why it is appropriate for the job. */
  purpose?: string;
  /** Functional and performance requirements placed on the component (§5.3.3). */
  requirements?: string;
  /** Hardware and software the component itself needs in order to run (§5.3.4). */
  runtime?: string;
  /** Expected design limitations — what it is known not to do. */
  limitations?: string;
  /** Date the supplier's support for this component ends, where it is known. */
  endOfLife?: string;
  /** Where that end-of-life date came from — a URL or a citation. */
  endOfLifeSource?: string;
  /** SDD section ids for the units that use it. */
  usedBy?: string[];
  /** VTP item ids exercising it, where its behaviour is verified directly. */
  tests?: string[];
  /** Supplier's development and support practices, and the end-of-life contingency. */
  maintenance?: string;
  notes?: string;
}

/**
 * One threat against the product (FDA cybersecurity guidance, February 2026; IEC 81001-5-1;
 * AAMI SW96/TIR57).
 *
 * The threat model and the security risk analysis are one register, because assessing a
 * threat and identifying it are the same act.
 *
 * Assessed on **exploitability**, not probability. Safety risk drops probability because
 * software fails deterministically; security risk replaces it because an attacker
 * chooses when to act, and a defence is worth what it costs to defeat.
 *
 * Where exploiting a threat could harm someone, `safetyRisk` names the risk it creates.
 * That join is what AAMI SW96 exists to make: a security finding with a patient
 * consequence belongs in the safety risk file as well as here.
 */
export interface ThreatItem {
  id: string;
  code?: string;
  heading?: boolean;
  level?: number;
  /** The threat: what an attacker does, and what it gets them. */
  text: string;
  /** What is being attacked — the data, function or property at stake. */
  asset?: string;
  /** Where the attack enters: the interface or trust boundary it crosses. */
  entryPoint?: string;
  category?: ThreatCategory;
  exploitability?: Exploitability;
  /** Severity of the consequence if the threat is realised. */
  impact?: RiskSeverity;
  /** Ids of the design units or components that present this attack surface. */
  causes?: string[];
  /** SRS requirement ids implementing the security controls. */
  controls?: string[];
  /** Why no software control is needed, when there is none. */
  justification?: string;
  /** Risk item ids for the safety risk that exploiting this threat would create. */
  safetyRisk?: string[];
  residual?: ResidualRisk;
  notes?: string;
}

/** STRIDE, the categorisation threat modelling has settled on. */
export type ThreatCategory =
  | 'spoofing'
  | 'tampering'
  | 'repudiation'
  | 'information_disclosure'
  | 'denial_of_service'
  | 'elevation_of_privilege';

/** How readily the threat can be realised — access needed, skill, and opportunity. */
export type Exploitability = 'high' | 'medium' | 'low';

export interface ThreatDoc {
  schemaVersion: SchemaVersion;
  type: 'threat';
  name: string;
  title: string;
  items: ThreatItem[];
}

export interface SoupDoc {
  schemaVersion: SchemaVersion;
  type: 'soup';
  name: string;
  title: string;
  items: SoupItem[];
}

export interface SddDoc {
  schemaVersion: SchemaVersion;
  type: 'sdd';
  name: string;
  title: string;
  items: SddSection[];
}

export type SpecPadDoc = ProjectDoc | SrsDoc | VtpDoc | PrdDoc | SddDoc | RiskDoc | SoupDoc | ThreatDoc
 ;

const stringArray = { type: 'array', items: { type: 'string' } } as const;

export const projectSchema = {
  $id: 'specpad/v1/project',
  type: 'object',
  required: ['schemaVersion', 'type', 'name', 'title', 'documents'],
  properties: {
    schemaVersion: { const: '1.0', description: 'Contract version of this file; "1.0" documents open in the pinned editor build at /v01/.' },
    type: { const: 'project', description: 'Document discriminator; selects the schema this file is validated against.' },
    name: { type: 'string', description: 'Short system name; also the filename stem ([name].proj.json).' },
    title: { type: 'string', description: 'Human-readable project title shown in the editor.' },
    description: { type: 'string', description: 'Optional free-text summary of the system under specification.' },
    editorBaseUrl: { type: 'string', description: 'Optional base URL the generated launcher opens (e.g. "https://specpad.internal.corp" for a self-hosted server). Absent uses the public hosted editor; the version path is always derived from schemaVersion.' },
    editorProjectId: { type: 'string', description: 'Optional project id on a self-hosted server that hosts several projects, so this repository\'s launcher opens its own project. Absent opens the server\'s only project.' },
    safetyClass: { enum: ['A', 'B', 'C'], description: 'The software safety class (IEC 62304 4.3). Declared, not derived: authoring stays at maximum rigor whatever it says, so this records the judgement rather than switching content off. Material beyond the declared class is highlighted as advice, never dropped.' },
    safetyClassRationale: { type: 'string', description: 'Why that class — the injury the software could contribute to, and the reasoning that places it. 4.3 asks for the rationale as much as the classification.' },
    enforce: { ...stringArray, description: 'Advisory governance rules this project has chosen to be held to. Naming a rule here moves its findings from advice into the blocking result, so a team adopts a practice when ready rather than on the day the rule ships.' },
    documents: {
      type: 'array',
      description: 'The SRS and VTP files that make up this project.',
      items: {
        type: 'object',
        required: ['type', 'path', 'title'],
        properties: {
          type: { enum: ['srs', 'vtp', 'prd', 'sdd', 'risk', 'soup', 'threat'], description: 'Which kind of document this entry points at: "srs", "vtp", "prd", "sdd", "risk", "soup", or "threat".' },
          path: { type: 'string', description: 'Path of the document file, relative to the project index.' },
          title: { type: 'string', description: 'Display title for the document.' },
        },
      },
    },
  },
} as const;

export const srsSchema = {
  $id: 'specpad/v1/srs',
  type: 'object',
  required: ['schemaVersion', 'type', 'name', 'title', 'items'],
  properties: {
    schemaVersion: { const: '1.0', description: 'Contract version of this file; "1.0" documents open in the pinned editor build at /v01/.' },
    type: { const: 'srs', description: 'Document discriminator; selects the schema this file is validated against.' },
    name: { type: 'string', description: 'Short system name; also the filename stem ([name].srs.json).' },
    title: { type: 'string', description: 'Human-readable document title.' },
    items: {
      type: 'array',
      description: 'Ordered list of requirements and section headings.',
      items: {
        type: 'object',
        required: ['id', 'text'],
        properties: {
          id: { type: 'string', minLength: 1, description: 'Stable machine identifier, generated once and never changed; all cross-references target it.' },
          code: { type: 'string', description: 'Human-facing label (e.g. "DOC-1"); freely renameable because references never use it.' },
          text: { type: 'string', description: 'The requirement statement.' },
          heading: { type: 'boolean', description: 'True when this item is a section heading rather than a requirement/test.' },
          level: { type: 'integer', minimum: 0, description: 'Indent depth for hierarchy; absent means 0. Headings form dotted section codes.' },
          satisfies: { ...stringArray, description: 'Ids of the PRD product requirements this requirement satisfies — ids, never codes, so renames cannot break the upward trace. Empty/absent unless a PRD register is in use.' },
          design: { ...stringArray, description: 'Ids of the SDD sections that implement this requirement — the downward trace (IEC 62304 5.4; FDA SDS). Ids, never codes, so a section can be retitled or rewritten without breaking the link. Empty/absent unless an SDD is in use.' },
          securityControl: { type: 'array', items: { enum: ['authentication', 'authorization', 'cryptography', 'integrity', 'confidentiality', 'event-detection', 'resiliency', 'updatability'] }, description: 'Which FDA security control categories this requirement implements (Cybersecurity in Medical Devices, February 2026, V.B.1 and Appendix 1). A list, because one requirement often serves several. Distinct from category: 5.2.2 e) says a requirement is a security requirement, this says which control it is.' },
          draft: { type: 'boolean', description: 'Drafted by a tool and not yet ratified by a person. The baseline generator sets it on everything it writes; a reviewer clears it. Without it a scaffold is indistinguishable from a specification.' },
          cites: { ...stringArray, description: 'What this requirement rests on, so it can be checked rather than believed: a clause of a standard, a source construct, a test that pins it. Free text, because the sources a project cites are not SpecPad\'s to enumerate — but present, because a review pass verifying a citation needs something to look up.' },
          category: { type: 'array', items: { enum: ['functional', 'inputs-outputs', 'interfaces', 'alarms', 'security', 'user-interface', 'data-definition', 'installation', 'operation-maintenance', 'it-network', 'user-maintenance', 'regulatory'] }, description: 'Which of IEC 62304 5.2.2 a)-l) this requirement is. A list, because A1:2015 NOTE 10 states that the requirements in a) through l) can overlap. Its worth is coverage: a category with no requirement is a question to answer once, not an omission to discover at review.' },
          hazards: { ...stringArray, description: 'Reserved hazard labels (legacy v1 field; the editor no longer surfaces it).' },
        },
      },
    },
  },
} as const;

export const vtpSchema = {
  $id: 'specpad/v1/vtp',
  type: 'object',
  required: ['schemaVersion', 'type', 'name', 'title', 'items'],
  properties: {
    schemaVersion: { const: '1.0', description: 'Contract version of this file; "1.0" documents open in the pinned editor build at /v01/.' },
    type: { const: 'vtp', description: 'Document discriminator; selects the schema this file is validated against.' },
    name: { type: 'string', description: 'Short system name; also the filename stem ([name].vtp.json).' },
    title: { type: 'string', description: 'Human-readable document title.' },
    items: {
      type: 'array',
      description: 'Ordered list of tests and section headings.',
      items: {
        type: 'object',
        required: ['id', 'text'],
        properties: {
          id: { type: 'string', minLength: 1, description: 'Stable machine identifier, generated once and never changed; all cross-references target it.' },
          code: { type: 'string', description: 'Human-facing label (e.g. "DOC-1"); freely renameable because references never use it.' },
          text: { type: 'string', description: 'The test procedure: what to do to verify the linked requirements.' },
          heading: { type: 'boolean', description: 'True when this item is a section heading rather than a requirement/test.' },
          level: { type: 'integer', minimum: 0, description: 'Indent depth for hierarchy; absent means 0. Headings form dotted section codes.' },
          verifies: { ...stringArray, description: 'Ids of the SRS requirements this test verifies — ids, never codes, so renames cannot break traceability.' },
          expected: { type: 'string', description: 'The expected result that defines a pass.' },
          result: { enum: ['', 'not_tested', 'passed', 'failed'], description: 'Latest recorded outcome for a MANUAL test: "", "not_tested", "passed", or "failed". For automated tests the outcome is derived from a captured run, not stored here. Roll-ups are computed on read.' },
          kind: { enum: ['nominal', 'boundary', 'negative', 'stress', 'security'], description: 'What this test does to the system, as distinct from its level: the happy path, the boundaries, the refusals, sustained load, or testing in a security context. A requirement proven only by nominal tests has been shown to work when nothing goes wrong.' },
          securityTest: { type: 'array', items: { enum: ['security-requirements', 'threat-mitigation', 'abuse-case', 'malformed-input', 'robustness', 'fuzz', 'attack-surface', 'vulnerability-chaining', 'known-vulnerability-scan', 'composition-analysis', 'static-analysis', 'dynamic-analysis', 'penetration'] }, description: "Which of FDA's recommended security testing types this is (Cybersecurity in Medical Devices, February 2026, V.C; vulnerability testing per ANSI/ISA 62443-4-1). Recorded so the set can be produced on request rather than searched for." },
          draft: { type: 'boolean', description: 'Drafted by a tool and not yet ratified by a person. The baseline generator sets it; a reviewer clears it.' },
          verificationLevel: { enum: ['unit', 'integration', 'system'], description: 'Which verification activity this test belongs to: unit verification (IEC 62304 5.5), integration testing (5.6) or system testing (5.7). Without it a register can show requirements are covered by something, but not that each of the three activities was performed.' },
          notes: { type: 'string', description: 'Evidence and context for the recorded result (free text; the machine link lives in automation).' },
          automation: {
            type: 'array',
            description: 'Framework-agnostic links to the automated test(s) that execute this verification. Absent/empty means the test is manual. The result for an automated test is derived from a captured run, never hand-set.',
            items: {
              type: 'object',
              required: ['runner', 'file'],
              properties: {
                runner: { type: 'string', description: 'Opaque test-runner id (e.g. "vitest", "playwright", "pytest"); interpreted by a runner adapter or CI, never by the SpecPad core.' },
                file: { type: 'string', description: 'Path to the test file (tracked in git), relative to the repo root.' },
                selector: { type: 'string', description: 'Runner-interpreted identifier for the test or group of tests within the file (a test name, a group/describe name, "#15", …). A result answers a selector when its name equals it or begins with it at a word boundary, so naming a group matches every test beneath it. Absent matches the whole file.' },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const prdSchema = {
  $id: 'specpad/v1/prd',
  type: 'object',
  required: ['schemaVersion', 'type', 'name', 'title', 'items'],
  properties: {
    schemaVersion: { const: '1.0', description: 'Contract version of this file; "1.0" documents open in the pinned editor build at /v01/.' },
    type: { const: 'prd', description: 'Document discriminator; selects the schema this file is validated against.' },
    name: { type: 'string', description: 'Short system name; also the filename stem ([name].prd.json).' },
    title: { type: 'string', description: 'Human-readable document title.' },
    items: {
      type: 'array',
      description: 'Ordered list of product requirements and section headings.',
      items: {
        type: 'object',
        required: ['id', 'text'],
        properties: {
          id: { type: 'string', minLength: 1, description: 'Stable machine identifier, generated once and never changed; SRS satisfies references target it.' },
          code: { type: 'string', description: 'Human-facing label (e.g. "PROD-1"); freely renameable because references never use it.' },
          text: { type: 'string', description: 'The product requirement / user need statement.' },
          heading: { type: 'boolean', description: 'True when this item is a section heading rather than a product requirement.' },
          level: { type: 'integer', minimum: 0, description: 'Indent depth for hierarchy; absent means 0. Headings form dotted section codes.' },
          status: { enum: ['proposed', 'implemented'], description: 'Lifecycle: "implemented" (realized — must trace down to >=1 SRS requirement, enforced by prd-coverage) or "proposed" (approved intent not yet allocated; roadmap/vision, exempt from coverage). Absent is treated as not-yet-implemented (exempt).' },
        },
      },
    },
  },
} as const;

export const sddSchema = {
  $id: 'specpad/v1/sdd',
  type: 'object',
  required: ['schemaVersion', 'type', 'name', 'title', 'items'],
  properties: {
    schemaVersion: { const: '1.0', description: 'Contract version of this file; "1.0" documents open in the pinned editor build at /v01/.' },
    type: { const: 'sdd', description: 'Document discriminator; selects the schema this file is validated against.' },
    name: { type: 'string', description: 'Short system name; also the filename stem ([name].sdd.json).' },
    title: { type: 'string', description: 'Human-readable document title.' },
    items: {
      type: 'array',
      description: 'Ordered list of detailed-design sections: one per software unit (IEC 62304 5.4.2), plus the cross-cutting design views a per-unit walk cannot express (IEEE 1016 viewpoints).',
      items: {
        type: 'object',
        required: ['id', 'title'],
        properties: {
          id: { type: 'string', minLength: 1, description: 'Stable machine identifier, generated once and never changed; SRS design references target it. This is what lets the section be retitled, reordered, or rewritten without breaking the trace.' },
          code: { type: 'string', description: 'Human-facing label (e.g. "SDD-12"); freely renameable because references never use it.' },
          title: { type: 'string', description: 'Section heading — the software unit or design view this section describes.' },
          heading: { type: 'boolean', description: 'True when this item groups sections rather than describing a design.' },
          level: { type: 'integer', minimum: 0, description: 'Indent depth for hierarchy; absent means 0.' },
          kind: { enum: ['unit', 'view'], description: 'Whether this section describes a software unit (IEC 62304 5.4.2) or a cross-cutting design view (IEEE 1016 viewpoint). Absent means "unit". Only units may be named as the cause of a risk, and the unit list required by 5.4.1 is derived from this.' },
          body: { type: 'string', description: 'The design, as markdown: what the unit hides, its algorithm and data, interface behaviour for valid and invalid input (5.4.3), and unit acceptance criteria (5.5.3). May embed images and diagrams like the architecture document.' },
          source: { ...stringArray, description: 'Repository paths this section describes, so the design can be checked against the code it claims to describe.' },
          draft: { type: 'boolean', description: 'Drafted by a tool and not yet ratified by a person.' },
          acceptance: { type: 'string', description: 'What "verified" means for this unit (IEC 62304 5.5.3; at Class C also 5.5.4 — event sequencing, resource use, fault handling, boundary values). A field rather than a line of prose, because 5.5.3 is asked per unit and buried in the body it cannot be rolled up or shown.' },
          segregatedFrom: { ...stringArray, description: 'Ids of other design sections this unit is segregated from, where the separation is essential to risk control (IEC 62304 5.3.5). Ids, never codes.' },
          segregationRationale: { type: 'string', description: 'Why the segregation holds. A1:2015 asks how effectiveness is ensured, not merely that separation was intended.' },
        },
      },
    },
  },
} as const;

export const riskSchema = {
  $id: 'specpad/v1/risk',
  type: 'object',
  required: ['schemaVersion', 'type', 'name', 'title', 'items'],
  properties: {
    schemaVersion: { const: '1.0', description: 'Contract version of this file; "1.0" documents open in the pinned editor build at /v01/.' },
    type: { const: 'risk', description: 'Document discriminator; selects the schema this file is validated against.' },
    name: { type: 'string', description: 'Short system name; also the filename stem ([name].risk.json).' },
    title: { type: 'string', description: 'Human-readable document title.' },
    items: {
      type: 'array',
      description: 'The software risk analysis (IEC 62304 clause 7): hazardous situations software can contribute to, and section headings. Hazards, harms, probability estimation and benefit-risk belong to the system risk management file, referenced by hazardRef.',
      items: {
        type: 'object',
        required: ['id', 'text'],
        properties: {
          id: { type: 'string', minLength: 1, description: 'Stable machine identifier, generated once and never changed.' },
          code: { type: 'string', description: 'Human-facing label (e.g. "RISK-4"); freely renameable because references never use it.' },
          text: { type: 'string', description: 'The hazardous situation, stated in terms of what the software does or fails to do.' },
          heading: { type: 'boolean', description: 'True when this item is a section heading rather than a risk.' },
          level: { type: 'integer', minimum: 0, description: 'Indent depth for hierarchy; absent means 0.' },
          hazardRef: { type: 'string', description: 'Identifier of the hazard or hazardous situation in the system risk management file, which the quality system owns. SpecPad holds the software slice and references the rest rather than restating it.' },
          severity: { enum: ['negligible', 'minor', 'serious', 'critical', 'catastrophic'], description: 'Severity of the resulting harm. There is deliberately no probability: for software you cannot argue probability down, so severity drives the analysis. ISO 14971 leaves the scale to the manufacturer; a project using a different one maps onto this.' },
          sequence: { type: 'string', description: 'The sequence of events that turns the software failure into the hazardous situation (IEC 62304 7.1.5; 7.3.2 for a sequence a control introduces). The analysis rather than decoration: recording only the endpoint hides every step a control could break.' },
          causes: { ...stringArray, description: 'Ids of the software items that could cause this hazardous situation (IEC 62304 7.1): SDD sections of kind "unit", or SOUP components whose anomalies could contribute (7.1.2). Ids, never codes.' },
          controls: { ...stringArray, description: 'Ids of the SRS requirements implementing the risk control measures (IEC 62304 7.2; 5.2.2 requires a control implemented in software to be a software requirement). Their verifying tests are the evidence the control works (7.3), derived rather than restated.' },
          justification: { type: 'string', description: 'Why no software control is needed, when there is none — for example a risk controlled in hardware, by labelling, or accepted at system level.' },
          residual: { enum: ['acceptable', 'unacceptable', 'not_assessed'], description: 'The judgement recorded once the controls are in place. Absent is treated as not assessed.' },
          notes: { type: 'string', description: 'Free-text analysis notes.' },
        },
      },
    },
  },
} as const;

export const soupSchema = {
  $id: 'specpad/v1/soup',
  type: 'object',
  required: ['schemaVersion', 'type', 'name', 'title', 'items'],
  properties: {
    schemaVersion: { const: '1.0', description: 'Contract version of this file; "1.0" documents open in the pinned editor build at /v01/.' },
    type: { const: 'soup', description: 'Document discriminator; selects the schema this file is validated against.' },
    name: { type: 'string', description: 'Short system name; also the filename stem ([name].soup.json).' },
    title: { type: 'string', description: 'Human-readable document title.' },
    items: {
      type: 'array',
      description: 'The third-party software the product depends on, assessed (IEC 62304 SOUP; FDA off-the-shelf software). Not an SBOM: an SBOM is a recursive inventory of every dependency generated from the manifests, while this is the set that has been assessed.',
      items: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'string', minLength: 1, description: 'Stable machine identifier, generated once and never changed; a risk naming this component as a cause targets it.' },
          code: { type: 'string', description: 'Human-facing label (e.g. "SOUP-3"); freely renameable because references never use it.' },
          name: { type: 'string', description: "The component's name, as its supplier calls it (IEC 62304 8.1.2)." },
          heading: { type: 'boolean', description: 'True when this item is a section heading rather than a component.' },
          level: { type: 'integer', minimum: 0, description: 'Indent depth for hierarchy; absent means 0.' },
          vendor: { type: 'string', description: 'Manufacturer, project or source of the component (IEC 62304 8.1.2; FDA "manufacturer").' },
          version: { type: 'string', description: 'The exact version in use, including patch level or upgrade designation. Exact rather than a range: an anomaly evaluation is only valid for the version it was performed against (IEC 62304 8.1.2; FDA "version level, patch number, upgrade designation").' },
          releaseDate: { type: 'string', description: 'Release date of that version (FDA).' },
          license: { type: 'string', description: 'Licence the component is distributed under.' },
          url: { type: 'string', description: 'Where the component and its documentation come from.' },
          purpose: { type: 'string', description: 'What the component does in this product, and why it is appropriate for the job (FDA: functional role, purpose, and at Enhanced level the justification for selecting it).' },
          requirements: { type: 'string', description: 'The functional and performance requirements placed on the component, necessary for its intended use (IEC 62304 5.3.3). Text rather than SRS entries: these are requirements on a supplier, not behaviour this product implements.' },
          runtime: { type: 'string', description: 'Hardware and software the component itself needs in order to run (IEC 62304 5.3.4; FDA computer system specifications).' },
          limitations: { type: 'string', description: 'Expected design limitations — what the component is known not to do (FDA).' },
          endOfLife: { type: 'string', description: "Date the supplier's support for this component ends, where it is known (FDA: end-of-life support plans and obsolescence). A date rather than prose, so a component already past support can be found rather than read for." },
          endOfLifeSource: { type: 'string', description: 'Where the end-of-life date came from — a URL or citation. An undated claim about a supplier\'s intentions is not evidence.' },
          usedBy: { ...stringArray, description: 'Ids of the SDD sections for the units that use this component.' },
          tests: { ...stringArray, description: "Ids of the VTP items exercising this component, where its behaviour is verified directly (FDA testing)." },
          maintenance: { type: 'string', description: "The supplier's development and support practices, and the plan for when support ends — obsolescence contingency (FDA, Enhanced documentation level)." },
          notes: { type: 'string', description: 'Free-text assessment notes.' },
        },
      },
    },
  },
} as const;

export const threatSchema = {
  $id: 'specpad/v1/threat',
  type: 'object',
  required: ['schemaVersion', 'type', 'name', 'title', 'items'],
  properties: {
    schemaVersion: { const: '1.0', description: 'Contract version of this file; "1.0" documents open in the pinned editor build at /v01/.' },
    type: { const: 'threat', description: 'Document discriminator; selects the schema this file is validated against.' },
    name: { type: 'string', description: 'Short system name; also the filename stem ([name].threat.json).' },
    title: { type: 'string', description: 'Human-readable document title.' },
    items: {
      type: 'array',
      description: 'The threat model and security risk analysis, which are one register: assessing a threat and identifying it are the same act (FDA cybersecurity guidance; IEC 81001-5-1; AAMI SW96).',
      items: {
        type: 'object',
        required: ['id', 'text'],
        properties: {
          id: { type: 'string', minLength: 1, description: 'Stable machine identifier, generated once and never changed.' },
          code: { type: 'string', description: 'Human-facing label (e.g. "THR-4"); freely renameable because references never use it.' },
          text: { type: 'string', description: 'The threat: what an attacker does, and what it gets them.' },
          heading: { type: 'boolean', description: 'True when this item is a section heading rather than a threat.' },
          level: { type: 'integer', minimum: 0, description: 'Indent depth for hierarchy; absent means 0.' },
          asset: { type: 'string', description: 'What is being attacked — the data, function or property at stake.' },
          entryPoint: { type: 'string', description: 'Where the attack enters: the interface or trust boundary it crosses.' },
          category: { enum: ['spoofing', 'tampering', 'repudiation', 'information_disclosure', 'denial_of_service', 'elevation_of_privilege'], description: 'STRIDE category, the classification threat modelling has settled on. Its value is coverage: an entry point with no threat in a category is a prompt to ask why.' },
          exploitability: { enum: ['high', 'medium', 'low'], description: 'How readily the threat can be realised — the access required, the skill, and the opportunity. Exploitability rather than probability: an attacker chooses when to act, so a frequency estimate is meaningless, and a defence is worth what it costs to defeat.' },
          impact: { enum: ['negligible', 'minor', 'serious', 'critical', 'catastrophic'], description: 'Severity of the consequence if the threat is realised, on the same scale as safety severity so the two analyses can be read together.' },
          causes: { ...stringArray, description: 'Ids of the design units or third-party components presenting this attack surface. Ids, never codes.' },
          controls: { ...stringArray, description: 'Ids of the SRS requirements implementing the security controls. A control is a requirement, so its verifying tests are the evidence it works — the same mechanism the safety risk register uses.' },
          justification: { type: 'string', description: 'Why no software control is needed, when there is none — for example a threat accepted, or controlled by the deployment environment.' },
          safetyRisk: { ...stringArray, description: 'Ids of the risk items for the safety risk that exploiting this threat would create. This join is the point of AAMI SW96: a security finding with a patient consequence belongs in the safety risk file as well as here.' },
          residual: { enum: ['acceptable', 'unacceptable', 'not_assessed'], description: 'The judgement recorded once the controls are in place. Absent is treated as not assessed.' },
          notes: { type: 'string', description: 'Free-text analysis notes.' },
        },
      },
    },
  },
} as const;

// ---- Sidecar documents (change-tracking cache; see specpad-change-tracking-design.md) ----
// NOT part of the core proj/srs/vtp contract. Regenerable cache/config files.
// JSON Schema validates STRUCTURE ONLY, exactly like the core docs.
// The skill writes these; it never computes diffs. The editor diffs the snapshots.

export type SidecarType = 'releases' | 'job' | 'jobs' | 'run';

export type JobStatus = 'open' | 'closed';

export type JobType = 'feature' | 'bugfix';

export interface AuthorRef {
  name: string;
  email: string;
}

export interface ReleaseEntry {
  version: string;
  ref: string;
  date: string;
  author: AuthorRef; // the author of the tagged commit (release-granularity attribution)
  snapshot: string | null; // path under docs/specpad/, or null if not yet cached
  /**
   * Defects known to be present when this version shipped, each with the evaluation that
   * made shipping acceptable (IEC 62304 §5.8.2 and §5.8.3).
   *
   * Per release rather than in a register with a lifecycle, because §5.8.3 asks for the
   * evaluation *at release*: the same defect can be acceptable in one version and not the
   * next, and re-stating it is the point rather than duplication.
   */
  anomalies?: ReleaseAnomaly[];
  /**
   * How this version was built (§5.8.5) and what makes that repeatable (§5.8.8): the
   * toolchain and its versions, the environment, and where the build procedure lives.
   */
  build?: string;
}

export interface ReleaseAnomaly {
  /** The defect, in terms of what a user would experience rather than the code at fault. */
  text: string;
  /** Why shipping with it was acceptable — the §5.8.3 evaluation against safety. */
  evaluation?: string;
  /** Where it is tracked, when it lives in an issue tracker named in the references register. */
  ref?: string;
}

export interface ReleasesDoc {
  schemaVersion: SchemaVersion;
  type: 'releases';
  name: string;
  tagPattern: string;
  baseline: string | null; // version whose snapshot the baseline reflects
  releases: ReleaseEntry[];
}

// The active-job marker. `jobs` (preferred) lets one commit be attributed to
// several jobs; `job` is the legacy single form, still read via activeJobIds().
// Entries are job-record ids (with a register) or tracker keys (without one).
export interface JobDoc {
  schemaVersion: SchemaVersion;
  type: 'job';
  jobs?: string[];
  job?: string;
  title?: string;
}

// The jobs register (no-tracker case): SpecPad owns the job *records* (title/description/status).
// It stores NO change associations — which items/commits a job touched is derived from git via the
// `Job:` trailer. See docs/design/specpad-change-tracking-design.md §13.
export interface JobRecord {
  id: string;
  code?: string;
  type?: JobType;
  version?: string;
  owner?: AuthorRef;
  title: string;
  // Release-note-voice summary (1–2 sentences, user-facing changelog altitude).
  description?: string;
  // Engineer-voice detail — root cause, mechanism, files touched, follow-ups.
  // Not shown in release notes; surfaced in the editor's job detail view.
  technical_notes?: string;
  status: JobStatus;
}

export interface JobsDoc {
  schemaVersion: SchemaVersion;
  type: 'jobs';
  name: string;
  jobs: JobRecord[];
}

// One commit attributed to a job (via its `Job:` trailer). Cached per closed job in
// .specpad/jobs/<id>/commits.json — a raw, git-derived, regenerable projection (no schema).
export interface JobCommit {
  hash: string;
  subject: string;
  author: string;
  date: string;
}

// A captured test-run record — normalized, framework-agnostic verification evidence.
// The skill (or CI) runs a suite, parses the runner's machine report, and writes one
// RunRecord per runner, stamped with the commit it ran against. Frozen into the
// release baseline and each closed job's cache (the "key deliverables"). Regenerable
// by re-running, so it lives under .specpad/ like the other captured snapshots.
export type RunStatus = 'passed' | 'failed' | 'skipped';

export interface RunResult {
  file: string;
  selector?: string;
  status: RunStatus;
  durationMs?: number;
}

export interface RunRecord {
  schemaVersion: SchemaVersion;
  type: 'run';
  name: string;
  runner: string; // which runner produced this record (opaque)
  ref: string; // commit SHA the run executed against
  ranAt: string; // YYYY-MM-DD
  summary: { total: number; passed: number; failed: number; skipped: number };
  results: RunResult[];
}

export type SidecarDoc = ReleasesDoc | JobDoc | JobsDoc | RunRecord;

const nullableString = { type: ['string', 'null'] } as const;

const authorRefSchema = {
  type: 'object',
  required: ['name', 'email'],
  properties: {
    name: { type: 'string', description: 'Author display name from git.' },
    email: { type: 'string', description: 'Author email from git.' },
  },
} as const;

export const releasesSchema = {
  $id: 'specpad/v1/releases',
  type: 'object',
  required: ['schemaVersion', 'type', 'name', 'tagPattern', 'baseline', 'releases'],
  properties: {
    schemaVersion: { const: '1.0', description: 'Contract version of this file; "1.0" documents open in the pinned editor build at /v01/.' },
    type: { const: 'releases', description: 'Document discriminator; selects the schema this file is validated against.' },
    name: { type: 'string', description: 'Project name this manifest belongs to.' },
    tagPattern: { type: 'string', description: 'Git tag glob (e.g. "v*") that marks releases of the spec.' },
    baseline: { ...nullableString, description: 'Version whose snapshot the editor diffs the working copy against (the current redline base).' },
    releases: {
      type: 'array',
      description: 'One entry per matching git tag, oldest first.',
      items: {
        type: 'object',
        required: ['version', 'ref', 'date', 'author', 'snapshot'],
        properties: {
          version: { type: 'string', description: 'The release tag name.' },
          ref: { type: 'string', description: 'Commit hash the tag points at.' },
          date: { type: 'string', description: 'Commit date (ISO).' },
          author: { ...authorRefSchema, description: 'Author of the tagged commit (release-granularity attribution).' },
          snapshot: { ...nullableString, description: 'Path of the cached snapshot under docs/specpad/, or null if not yet cached.' },
          anomalies: { type: 'array', description: 'Defects known to be present when this version shipped, each with the evaluation that made shipping acceptable (IEC 62304 5.8.2, 5.8.3).', items: { type: 'object', required: ['text'], properties: { text: { type: 'string', description: 'The defect, in terms of what a user would experience.' }, evaluation: { type: 'string', description: 'Why shipping with it was acceptable — the 5.8.3 evaluation against safety.' }, ref: { type: 'string', description: 'Where it is tracked, when it lives in an issue tracker.' } } } },
          build: { type: 'string', description: 'How this version was built (5.8.5) and what makes that repeatable (5.8.8): toolchain and versions, environment, and where the build procedure lives.' },
        },
      },
    },
  },
} as const;

export const jobSchema = {
  $id: 'specpad/v1/job',
  type: 'object',
  required: ['schemaVersion', 'type'],
  properties: {
    schemaVersion: { const: '1.0', description: 'Contract version of this file; "1.0" documents open in the pinned editor build at /v01/.' },
    type: { const: 'job', description: 'Document discriminator; selects the schema this file is validated against.' },
    jobs: { ...stringArray, description: 'The active work items current changes are attributed to — job-record ids (with a register) or tracker keys. One commit may carry several; the skill writes one Job: trailer per entry.' },
    job: { type: 'string', description: 'Legacy single active work item; readers normalize it into the jobs list via activeJobIds(). Prefer jobs.' },
    title: { type: 'string', description: 'Optional human-readable summary, meaningful only for a single external-tracker job with no register.' },
  },
} as const;

export const jobsSchema = {
  $id: 'specpad/v1/jobs',
  type: 'object',
  required: ['schemaVersion', 'type', 'name', 'jobs'],
  properties: {
    schemaVersion: { const: '1.0', description: 'Contract version of this file; "1.0" documents open in the pinned editor build at /v01/.' },
    type: { const: 'jobs', description: 'Document discriminator; selects the schema this file is validated against.' },
    name: { type: 'string', description: 'Project name this register belongs to.' },
    jobs: {
      type: 'array',
      description: 'The job records owned by this project (used when there is no external tracker).',
      items: {
        type: 'object',
        required: ['id', 'title', 'status'],
        properties: {
          id: { type: 'string', minLength: 1, description: 'Stable machine identifier, generated once and never changed; the Job: commit trailer and all references target it.' },
          code: { type: 'string', description: 'Human-facing label (e.g. "JOB-1"); freely renameable because references never use it.' },
          type: { enum: ['feature', 'bugfix'], description: 'Kind of work — "feature" or "bugfix"; organizes the release-notes Jobs view.' },
          version: { type: 'string', description: 'Release this job shipped in — skill-derived (the release tag whose commits contain the job), not hand-set; absent means Unreleased. The Jobs view groups by its major component.' },
          owner: { ...authorRefSchema, description: 'Who owns the job — set from git (user.name/user.email) when the job is created; reassignable.' },
          title: { type: 'string', description: 'Short human-readable summary of the job.' },
          description: { type: 'string', description: 'Release-note-voice summary of the job — 1–2 sentences a user would read in a changelog. Keep engineer detail (root cause, mechanism, files) in technical_notes instead.' },
          technical_notes: { type: 'string', description: 'Optional engineer-voice detail — root cause, mechanism, files touched, follow-ups. Not shown in the release-notes list; surfaced in the job detail view.' },
          status: { enum: ['open', 'closed'], description: 'Lifecycle state: "open" (may accrue more commits) or "closed" (scope sealed; further work spawns a new job).' },
        },
      },
    },
  },
} as const;

export const runSchema = {
  $id: 'specpad/v1/run',
  type: 'object',
  required: ['schemaVersion', 'type', 'name', 'runner', 'ref', 'ranAt', 'summary', 'results'],
  properties: {
    schemaVersion: { const: '1.0', description: 'Contract version of this file; "1.0" documents open in the pinned editor build at /v01/.' },
    type: { const: 'run', description: 'Document discriminator; selects the schema this file is validated against.' },
    name: { type: 'string', description: 'Project name this run belongs to.' },
    runner: { type: 'string', description: 'Opaque test-runner id that produced this record (e.g. "vitest", "playwright"). One record per runner.' },
    ref: { type: 'string', description: 'Commit SHA the run executed against (the build under test, in SpecPad terms).' },
    ranAt: { type: 'string', description: 'Date the run was captured (YYYY-MM-DD).' },
    summary: {
      type: 'object',
      description: 'Roll-up counts for the whole run.',
      required: ['total', 'passed', 'failed', 'skipped'],
      properties: {
        total: { type: 'integer', minimum: 0, description: 'Total tests in the run.' },
        passed: { type: 'integer', minimum: 0, description: 'Count of passing tests.' },
        failed: { type: 'integer', minimum: 0, description: 'Count of failing tests.' },
        skipped: { type: 'integer', minimum: 0, description: 'Count of skipped/pending tests.' },
      },
    },
    results: {
      type: 'array',
      description: 'Per-test outcomes, matched to VTP automation links by file (+ selector).',
      items: {
        type: 'object',
        required: ['file', 'status'],
        properties: {
          file: { type: 'string', description: 'Test file path relative to the repo root.' },
          selector: { type: 'string', description: 'Runner-interpreted identifier for the specific test (e.g. its full name); absent for file-level results.' },
          status: { enum: ['passed', 'failed', 'skipped'], description: 'Outcome of this test in the run.' },
          durationMs: { type: 'number', minimum: 0, description: 'Execution time in milliseconds, when reported.' },
        },
      },
    },
  },
} as const;
