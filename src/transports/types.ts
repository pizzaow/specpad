/**
 * The transport contract (EDR-1).
 *
 * Everything the editor needs from storage, reduced to file-level operations: list
 * the documents, read a JSON file, read a text file, write a text file. Every higher
 * concept — "load the SRS", "load a snapshot", "save the job marker" — is built on
 * these in `src/fileApi.ts`, so a new transport implements four methods rather than
 * twenty-five loaders.
 *
 * Implementations: `local` (File System Access API), `demo` (read-only HTTP), and
 * `remote` (a SpecPad server). No view depends on which one is active.
 */
import type { SpecPadDoc } from '../shared';
import { REGISTER_TYPES } from '../shared';

// 'proj' (the project index) plus every register document type in the registry.
export type DocKind = string;

export interface DocumentListItem {
  type: DocKind;
  name: string;
  filename: string;
}

export type SnapshotLocation = 'baseline' | { version: string };

export interface FileApi {
  /** True when the transport cannot accept writes at all (the hosted demo). */
  readonly readOnly: boolean;
  /** The open project's short name, or '' when nothing is open. */
  projectName(): string;
  /** Whether a project is currently open on this transport. */
  isOpen(): boolean;
  listDocuments(): Promise<DocumentListItem[]>;
  /**
   * Read a JSON file addressed by path segments relative to the project directory.
   * Resolves to null when the file is absent; throws for any other failure.
   */
  readJson(path: string[]): Promise<SpecPadDoc | null>;
  /**
   * Read a text file. Resolves to null when the file cannot be resolved at all — a
   * missing file, a missing directory, or a name the underlying store rejects. One bad
   * diagram reference must never abort opening a project (DGM-4).
   */
  readText(path: string[]): Promise<string | null>;
  /** Write a text file, creating it if needed. Throws on a read-only transport. */
  writeText(path: string[], content: string): Promise<void>;
}

// ---- Pure helpers: the on-disk document-file conventions, shared by all transports ----

/** Naming convention: [name].[type].json (e.g. AcmeApp.srs.json). */
const DOC_FILENAME_RE = new RegExp(
  `^(.+?)\\.(proj|${REGISTER_TYPES.map((d) => d.type).join('|')})\\.json$`,
);

/** Classify a `[name].[type].json` filename; null for non-document files. */
export function classifyDocFilename(filename: string): DocumentListItem | null {
  const m = filename.match(DOC_FILENAME_RE);
  if (!m) return null;
  return { type: m[2] as DocKind, name: m[1], filename };
}

export function serializeDocument(doc: unknown): string {
  return JSON.stringify(doc, null, 2) + '\n';
}

export function parseDocument(text: string): SpecPadDoc {
  return JSON.parse(text) as SpecPadDoc;
}

/** The .specpad path segments for a snapshot location. */
export function snapshotDirSegments(location: SnapshotLocation): string[] {
  return location === 'baseline'
    ? ['.specpad', 'baseline']
    : ['.specpad', 'snapshots', location.version];
}

/** Pick the project name out of a document list: the proj file wins, else the first entry. */
export function projectNameFrom(documents: DocumentListItem[]): string {
  const proj = documents.find((d) => d.type === 'proj');
  return proj ? proj.name : (documents[0]?.name ?? '');
}
