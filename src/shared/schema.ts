// v1 SpecPad contract: TypeScript types + JSON Schema documents.
// JSON Schema enforces STRUCTURE ONLY. Policy lives in governance.ts.

export const SCHEMA_VERSION = '1.0' as const;
export type SchemaVersion = typeof SCHEMA_VERSION;
export type DocType = 'project' | 'srs' | 'vtp' | 'prd' | 'sdd' | 'risk' | 'soup';
export type TestResult = '' | 'not_tested' | 'passed' | 'failed';

export interface ProjectDocRef {
  type: 'srs' | 'vtp' | 'prd' | 'sdd' | 'risk' | 'soup';
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
  documents: ProjectDocRef[];
}

export interface SrsItem {
  id: string;
  code?: string;
  text: string;
  heading?: boolean;
  level?: number;
  satisfies?: string[]; // ids of PRD items this requirement satisfies (upward trace; ids, never codes)
  design?: string[]; // ids of SDD sections implementing this requirement (downward trace; ids, never codes)
  tags?: string[];
  hazards?: string[];
}

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
  notes?: string;
  tags?: string[];
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
  tags?: string[];
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
  tags?: string[];
}

export type SddSectionKind = 'unit' | 'view';

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
  tags?: string[];
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
  tags?: string[];
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

export type SpecPadDoc = ProjectDoc | SrsDoc | VtpDoc | PrdDoc | SddDoc | RiskDoc | SoupDoc;

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
    documents: {
      type: 'array',
      description: 'The SRS and VTP files that make up this project.',
      items: {
        type: 'object',
        required: ['type', 'path', 'title'],
        properties: {
          type: { enum: ['srs', 'vtp', 'prd', 'sdd', 'risk', 'soup'], description: 'Which kind of document this entry points at: "srs", "vtp", "prd", "sdd", "risk", or "soup".' },
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
          tags: { ...stringArray, description: 'Free-form labels for filtering and grouping.' },
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
          notes: { type: 'string', description: 'Evidence and context for the recorded result (free text; the machine link lives in automation).' },
          tags: { ...stringArray, description: 'Free-form labels for filtering and grouping.' },
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
          tags: { ...stringArray, description: 'Free-form labels for filtering and grouping.' },
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
          tags: { ...stringArray, description: 'Free-form labels; "draft" marks a generated section awaiting author review.' },
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
          causes: { ...stringArray, description: 'Ids of the software items that could cause this hazardous situation (IEC 62304 7.1): SDD sections of kind "unit", or SOUP components whose anomalies could contribute (7.1.2). Ids, never codes.' },
          controls: { ...stringArray, description: 'Ids of the SRS requirements implementing the risk control measures (IEC 62304 7.2; 5.2.2 requires a control implemented in software to be a software requirement). Their verifying tests are the evidence the control works (7.3), derived rather than restated.' },
          justification: { type: 'string', description: 'Why no software control is needed, when there is none — for example a risk controlled in hardware, by labelling, or accepted at system level.' },
          residual: { enum: ['acceptable', 'unacceptable', 'not_assessed'], description: 'The judgement recorded once the controls are in place. Absent is treated as not assessed.' },
          notes: { type: 'string', description: 'Free-text analysis notes.' },
          tags: { ...stringArray, description: 'Free-form labels for filtering and grouping.' },
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
          tags: { ...stringArray, description: 'Free-form labels for filtering and grouping.' },
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
