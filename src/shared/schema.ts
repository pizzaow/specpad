// v1 SpecPad contract: TypeScript types + JSON Schema documents.
// JSON Schema enforces STRUCTURE ONLY. Policy lives in governance.ts.

export const SCHEMA_VERSION = '1.0' as const;
export type SchemaVersion = typeof SCHEMA_VERSION;
export type DocType = 'project' | 'srs' | 'vtp';
export type TestResult = '' | 'not_tested' | 'passed' | 'failed';

export interface ProjectDocRef {
  type: 'srs' | 'vtp';
  path: string;
  title: string;
}

export interface ProjectDoc {
  schemaVersion: SchemaVersion;
  type: 'project';
  name: string;
  title: string;
  description?: string;
  documents: ProjectDocRef[];
}

export interface SrsItem {
  id: string;
  code?: string;
  text: string;
  heading?: boolean;
  level?: number;
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
}

export interface VtpDoc {
  schemaVersion: SchemaVersion;
  type: 'vtp';
  name: string;
  title: string;
  items: VtpItem[];
}

export type SpecPadDoc = ProjectDoc | SrsDoc | VtpDoc;

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
    documents: {
      type: 'array',
      description: 'The SRS and VTP files that make up this project.',
      items: {
        type: 'object',
        required: ['type', 'path', 'title'],
        properties: {
          type: { enum: ['srs', 'vtp'], description: 'Which kind of document this entry points at: "srs" or "vtp".' },
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
          result: { enum: ['', 'not_tested', 'passed', 'failed'], description: 'Latest recorded outcome: "", "not_tested", "passed", or "failed". Roll-ups are computed on read, never stored.' },
          notes: { type: 'string', description: 'Evidence and context for the recorded result (e.g. which automated test covers it).' },
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

export type SidecarType = 'releases' | 'job' | 'jobs';

export type JobStatus = 'open' | 'closed';

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
  title: string;
  description?: string;
  status: JobStatus;
}

export interface JobsDoc {
  schemaVersion: SchemaVersion;
  type: 'jobs';
  name: string;
  jobs: JobRecord[];
}

export type SidecarDoc = ReleasesDoc | JobDoc | JobsDoc;

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
          title: { type: 'string', description: 'Short human-readable summary of the job.' },
          description: { type: 'string', description: 'Optional longer description of the work the job covers.' },
          status: { enum: ['open', 'closed'], description: 'Lifecycle state: "open" (may accrue more commits) or "closed" (scope sealed; further work spawns a new job).' },
        },
      },
    },
  },
} as const;
