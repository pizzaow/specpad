import Ajv from 'ajv';
import type { ValidateFunction } from 'ajv';
import { projectSchema, releasesSchema, jobSchema, jobsSchema } from './schema';
import { DOC_TYPES } from './docTypes';

export interface ValidationError {
  path: string;
  message: string;
}

const ajv = new Ajv({ allErrors: true, strict: false });

// Content document types come from the registry; the rest are infrastructure sidecars.
const validators: Record<string, ValidateFunction> = {
  project: ajv.compile(projectSchema as object),
  releases: ajv.compile(releasesSchema as object),
  job: ajv.compile(jobSchema as object),
  jobs: ajv.compile(jobsSchema as object),
};
for (const d of DOC_TYPES) {
  if (d.schema) validators[d.type] = ajv.compile(d.schema as object);
}

/** Structural validation only. Returns [] when the document is well-formed. */
export function validate(doc: unknown): ValidationError[] {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return [{ path: '', message: 'Document must be a JSON object' }];
  }
  const type = (doc as { type?: unknown }).type;
  const validator = typeof type === 'string' ? validators[type] : undefined;
  if (!validator) {
    return [{ path: '/type', message: `Unknown document type: ${JSON.stringify(type)}` }];
  }
  if (validator(doc)) return [];
  return (validator.errors ?? []).map((e) => {
    const path = e.instancePath || '/';
    return { path, message: `${path} ${e.message ?? 'is invalid'}`.trim() };
  });
}
