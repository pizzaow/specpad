import { describe, it, expect } from 'vitest';
import { projectSchema, srsSchema, vtpSchema, prdSchema, releasesSchema, jobSchema, jobsSchema } from '../schema';

// The reference page is generated from these schemas; a field without a
// description renders an empty cell and means the contract is under-documented.
// Recursively assert every property (including nested object/array-item
// properties) carries a non-empty description.
type AnySchema = Record<string, any>;

function missingDescriptions(schema: AnySchema, path: string): string[] {
  const missing: string[] = [];
  const props = schema.properties as Record<string, AnySchema> | undefined;
  if (!props) return missing;
  for (const [key, prop] of Object.entries(props)) {
    const here = `${path}.${key}`;
    if (typeof prop.description !== 'string' || prop.description.trim() === '') {
      missing.push(here);
    }
    if (prop.properties) missing.push(...missingDescriptions(prop, here));
    if (prop.items?.properties) missing.push(...missingDescriptions(prop.items, `${here}[]`));
  }
  return missing;
}

describe('schema field descriptions', () => {
  it.each([
    ['project', projectSchema],
    ['srs', srsSchema],
    ['vtp', vtpSchema],
    ['prd', prdSchema],
    ['releases', releasesSchema],
    ['job', jobSchema],
    ['jobs', jobsSchema],
  ])('%s schema describes every field', (_name, schema) => {
    expect(missingDescriptions(schema as AnySchema, _name)).toEqual([]);
  });
});
