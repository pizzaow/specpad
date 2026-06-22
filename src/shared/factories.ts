import { SCHEMA_VERSION } from './schema';
import type { ProjectDoc, ProjectDocRef, SrsDoc, VtpDoc, PrdDoc, SrsItem, VtpItem, PrdItem, JobsDoc, JobRecord } from './schema';
import { generateId, ID_PREFIX } from './ids';
import { REGISTER_TYPES } from './docTypes';

// The default document set is the registry's register types (prd/srs/vtp today), so a new project
// gets the full design-control set and a future pillar is included by registering it.
export function createProjectDoc(name: string, title: string): ProjectDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    type: 'project',
    name,
    title,
    description: '',
    documents: REGISTER_TYPES.map((d) => ({
      type: d.type as ProjectDocRef['type'],
      path: `${name}.${d.type}.json`,
      title: d.label,
    })),
  };
}

export function createSrsDoc(name: string, title: string): SrsDoc {
  return { schemaVersion: SCHEMA_VERSION, type: 'srs', name, title, items: [] };
}

export function createVtpDoc(name: string, title: string): VtpDoc {
  return { schemaVersion: SCHEMA_VERSION, type: 'vtp', name, title, items: [] };
}

export function createSrsItem(existingIds: Iterable<string>, level = 0): SrsItem {
  const item: SrsItem = { id: generateId(ID_PREFIX.requirement, existingIds), text: '' };
  if (level > 0) item.level = level;
  return item;
}

export function createVtpItem(existingIds: Iterable<string>, level = 0): VtpItem {
  const item: VtpItem = {
    id: generateId(ID_PREFIX.test, existingIds),
    text: '',
    verifies: [],
    expected: '',
    result: '',
  };
  if (level > 0) item.level = level;
  return item;
}

export function createPrdDoc(name: string, title: string): PrdDoc {
  return { schemaVersion: SCHEMA_VERSION, type: 'prd', name, title, items: [] };
}

export function createPrdItem(existingIds: Iterable<string>, level = 0): PrdItem {
  const item: PrdItem = { id: generateId(ID_PREFIX.product, existingIds), text: '', status: 'proposed' };
  if (level > 0) item.level = level;
  return item;
}

export function createJobsDoc(name: string): JobsDoc {
  return { schemaVersion: SCHEMA_VERSION, type: 'jobs', name, jobs: [] };
}

export function createJobRecord(existingIds: Iterable<string>, title = ''): JobRecord {
  return { id: generateId(ID_PREFIX.job, existingIds), title, status: 'open' };
}
