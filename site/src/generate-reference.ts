/**
 * Generates the schema reference page from the LIVE contract module.
 * Field tables come from the JSON Schemas (description annotations required —
 * missing one fails the build); governance rules come from GOVERNANCE_RULES.
 * Run via: tsx site/src/generate-reference.ts  (first step of build:site)
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import {
  projectSchema, srsSchema, vtpSchema, releasesSchema, jobSchema,
} from '../../src/shared/schema';
import { GOVERNANCE_RULES } from '../../src/shared/governance';

type AnySchema = Record<string, unknown>;

const DEFAULT_SCHEMAS: Record<string, AnySchema> = {
  project: projectSchema as AnySchema,
  srs: srsSchema as AnySchema,
  vtp: vtpSchema as AnySchema,
  releases: releasesSchema as AnySchema,
  job: jobSchema as AnySchema,
};

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function typeLabel(prop: AnySchema): string {
  if (prop['const'] !== undefined) return `const ${JSON.stringify(prop['const'])}`;
  if (prop['enum']) return (prop['enum'] as unknown[]).map((v) => JSON.stringify(v)).join(' | ');
  if (prop['type'] === 'array') {
    const items = prop['items'] as AnySchema | undefined;
    return items?.['properties'] ? 'array of objects' : `array of ${items?.['type'] ?? 'any'}`;
  }
  if (Array.isArray(prop['type'])) return (prop['type'] as string[]).join(' | ');
  return (prop['type'] as string | undefined) ?? 'any';
}

interface Row { field: string; type: string; required: boolean; description: string }

function collectRows(schema: AnySchema, prefix: string, out: Row[]): void {
  const required = new Set<string>((schema['required'] as string[] | undefined) ?? []);
  const properties = (schema['properties'] ?? {}) as Record<string, AnySchema>;
  for (const [key, prop] of Object.entries(properties)) {
    const field = prefix ? `${prefix}.${key}` : key;
    if (typeof prop['description'] !== 'string' || !(prop['description'] as string).trim()) {
      throw new Error(`Schema field "${field}" has no description — the reference page would be incomplete.`);
    }
    out.push({ field, type: typeLabel(prop), required: required.has(key), description: prop['description'] as string });
    if (prop['properties']) collectRows(prop, field, out);
    const items = prop['items'] as AnySchema | undefined;
    if (items?.['properties']) collectRows(items, `${field}[]`, out);
  }
}

function fieldTable(name: string, schema: AnySchema): string {
  const rows: Row[] = [];
  collectRows(schema, '', rows);
  const body = rows.map((r) => `
      <tr>
        <td><code>${esc(r.field)}</code></td>
        <td><code>${esc(r.type)}</code></td>
        <td>${r.required ? 'required' : 'optional'}</td>
        <td>${esc(r.description)}</td>
      </tr>`).join('');
  return `
    <section id="schema-${name}">
      <h3><code>${name}</code></h3>
      <table>
        <thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>${body}
        </tbody>
      </table>
    </section>`;
}

function governanceList(): string {
  return GOVERNANCE_RULES.map((r) => `
    <section class="rule" id="rule-${r.id}">
      <h3><code>${r.id}</code> — ${esc(r.title)}</h3>
      <p>${esc(r.description)}</p>
    </section>`).join('');
}

export function renderReference(opts?: { schemas?: Record<string, AnySchema> }): string {
  const schemas = opts?.schemas ?? DEFAULT_SCHEMAS;
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const template = fs.readFileSync(path.join(dir, 'reference-template.html'), 'utf8');
  const tables = Object.entries(schemas).map(([n, s]) => fieldTable(n, s)).join('\n');
  return template
    .replace('<!-- @FIELD_TABLES -->', () => tables)
    .replace('<!-- @GOVERNANCE_RULES -->', () => governanceList());
}

// Script entry: write the page for the site build.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.join(dir, '..', 'reference');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), renderReference());
  // eslint-disable-next-line no-console
  console.log('generated site/reference/index.html');
}
