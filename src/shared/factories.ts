import { SCHEMA_VERSION } from './schema';
import type { ProjectDoc, SrsDoc, VtpDoc, SrsItem, VtpItem } from './schema';
import { generateId, ID_PREFIX } from './ids';

export function createProjectDoc(name: string, title: string): ProjectDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    type: 'project',
    name,
    title,
    description: '',
    documents: [
      { type: 'srs', path: `${name}.srs.json`, title: 'Requirements' },
      { type: 'vtp', path: `${name}.vtp.json`, title: 'Verification Tests' },
    ],
  };
}

export function createSrsDoc(name: string, title: string): SrsDoc {
  return { schemaVersion: SCHEMA_VERSION, type: 'srs', name, title, items: [] };
}

export function createVtpDoc(name: string, title: string): VtpDoc {
  return { schemaVersion: SCHEMA_VERSION, type: 'vtp', name, title, items: [] };
}

export function createSrsItem(existingIds: Iterable<string>): SrsItem {
  return { id: generateId(ID_PREFIX.requirement, existingIds), text: '' };
}

export function createVtpItem(existingIds: Iterable<string>): VtpItem {
  return {
    id: generateId(ID_PREFIX.test, existingIds),
    text: '',
    verifies: [],
    expected: '',
    result: '',
  };
}
