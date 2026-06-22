/**
 * docTypes — the document-type registry: the single source of truth for the
 * *content* document types SpecPad tracks. Validation, the schema reference, the
 * snapshot/diff loaders, and (in prose) the skill all derive from this, so adding
 * a new pillar (e.g. SOUP/SBOM, cybersecurity, SDD) is one registration here plus
 * a schema — it then flows into release/baseline snapshots, per-job diffs, the
 * redline, and the generator with no other code changes.
 *
 * Sidecars (project index, releases, job marker, jobs register) are infrastructure,
 * not content documents, so they live outside this registry (see validate.ts).
 */
import { srsSchema, vtpSchema, prdSchema } from './schema';

// register: id-keyed JSON with an `items[]` array (diffable by the shared diffItems).
// prose: tracked markdown/text (line-diffed). asset: binary-ish file (coarse, changed/yes-no).
export type DocTypeKind = 'register' | 'prose' | 'asset';

export interface DocTypeSpec {
  type: string; // discriminator + filename infix: <name>.<type>.json for register types
  label: string; // human label (editor tab / reference heading)
  kind: DocTypeKind;
  optional: boolean; // required for a project? srs/vtp required; prd and future pillars optional
  inBaseline: boolean; // captured in the release/baseline snapshot and per-job before/after cache
  generate: 'always' | 'optional' | 'never'; // does the baseline generator draft it
  schema?: Record<string, unknown>; // JSON Schema (register types)
}

// The content document types. Order is the default editor/authoring order.
export const DOC_TYPES: DocTypeSpec[] = [
  { type: 'prd', label: 'Product Requirements', kind: 'register', optional: true, inBaseline: true, generate: 'optional', schema: prdSchema as Record<string, unknown> },
  { type: 'srs', label: 'Requirements', kind: 'register', optional: false, inBaseline: true, generate: 'always', schema: srsSchema as Record<string, unknown> },
  { type: 'vtp', label: 'Verification Tests', kind: 'register', optional: false, inBaseline: true, generate: 'always', schema: vtpSchema as Record<string, unknown> },
];

/** All id-keyed register types (srs, vtp, prd, …) — the diffable/redline-able docs. */
export const REGISTER_TYPES: DocTypeSpec[] = DOC_TYPES.filter((d) => d.kind === 'register');

export function docTypeFor(type: string): DocTypeSpec | undefined {
  return DOC_TYPES.find((d) => d.type === type);
}

export function isRegisterType(type: string): boolean {
  return docTypeFor(type)?.kind === 'register';
}

/** Register types present in a project index (proj.json documents[]), in registry order. */
export function registerTypesInIndex(documentTypes: Iterable<string>): DocTypeSpec[] {
  const present = new Set(documentTypes);
  return REGISTER_TYPES.filter((d) => present.has(d.type));
}
