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
    schemaVersion: { const: '1.0' },
    type: { const: 'project' },
    name: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    documents: {
      type: 'array',
      items: {
        type: 'object',
        required: ['type', 'path', 'title'],
        properties: {
          type: { enum: ['srs', 'vtp'] },
          path: { type: 'string' },
          title: { type: 'string' },
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
    schemaVersion: { const: '1.0' },
    type: { const: 'srs' },
    name: { type: 'string' },
    title: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'text'],
        properties: {
          id: { type: 'string', minLength: 1 },
          code: { type: 'string' },
          text: { type: 'string' },
          heading: { type: 'boolean' },
          level: { type: 'integer', minimum: 0 },
          tags: stringArray,
          hazards: stringArray,
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
    schemaVersion: { const: '1.0' },
    type: { const: 'vtp' },
    name: { type: 'string' },
    title: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'text'],
        properties: {
          id: { type: 'string', minLength: 1 },
          code: { type: 'string' },
          text: { type: 'string' },
          heading: { type: 'boolean' },
          level: { type: 'integer', minimum: 0 },
          verifies: stringArray,
          expected: { type: 'string' },
          result: { enum: ['', 'not_tested', 'passed', 'failed'] },
          notes: { type: 'string' },
          tags: stringArray,
        },
      },
    },
  },
} as const;

// ---- Sidecar documents (change-tracking cache; see specpad-change-tracking-design.md) ----
// NOT part of the core proj/srs/vtp contract. Regenerable cache/config files.
// JSON Schema validates STRUCTURE ONLY, exactly like the core docs.
// The skill writes these; it never computes diffs. The editor diffs the snapshots.

export type SidecarType = 'releases' | 'job';

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

export interface JobDoc {
  schemaVersion: SchemaVersion;
  type: 'job';
  job: string;
  title?: string;
}

export type SidecarDoc = ReleasesDoc | JobDoc;

const nullableString = { type: ['string', 'null'] } as const;

const authorRefSchema = {
  type: 'object',
  required: ['name', 'email'],
  properties: { name: { type: 'string' }, email: { type: 'string' } },
} as const;

export const releasesSchema = {
  $id: 'specpad/v1/releases',
  type: 'object',
  required: ['schemaVersion', 'type', 'name', 'tagPattern', 'baseline', 'releases'],
  properties: {
    schemaVersion: { const: '1.0' },
    type: { const: 'releases' },
    name: { type: 'string' },
    tagPattern: { type: 'string' },
    baseline: nullableString,
    releases: {
      type: 'array',
      items: {
        type: 'object',
        required: ['version', 'ref', 'date', 'author', 'snapshot'],
        properties: {
          version: { type: 'string' },
          ref: { type: 'string' },
          date: { type: 'string' },
          author: authorRefSchema,
          snapshot: nullableString,
        },
      },
    },
  },
} as const;

export const jobSchema = {
  $id: 'specpad/v1/job',
  type: 'object',
  required: ['schemaVersion', 'type', 'job'],
  properties: {
    schemaVersion: { const: '1.0' },
    type: { const: 'job' },
    job: { type: 'string' },
    title: { type: 'string' },
  },
} as const;
