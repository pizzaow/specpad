/**
 * Demo transport — read-only, HTTP-backed. Every read fetches from a base URL and
 * every write throws. An HTTP "directory" cannot be listed, so a manifest.json
 * substitutes for the directory listing.
 */
import type { SpecPadDoc } from '../shared';
import type { FileApi, DocumentListItem } from './types';
import { classifyDocFilename, parseDocument, projectNameFrom } from './types';

export const READ_ONLY_DEMO = 'This is a read-only demo — changes cannot be saved';

export class DemoTransport implements FileApi {
  readonly readOnly = true;
  private baseUrl: string;
  private documents: DocumentListItem[] = [];
  private name = '';

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }

  projectName(): string {
    return this.name;
  }

  isOpen(): boolean {
    return true;
  }

  async listDocuments(): Promise<DocumentListItem[]> {
    return this.documents;
  }

  async readJson(path: string[]): Promise<SpecPadDoc | null> {
    const rel = path.join('/');
    const res = await fetch(this.baseUrl + rel, { cache: 'no-cache' });
    // S3 behind CloudFront OAC has GetObject but not ListBucket, so missing keys come
    // back 403 AccessDenied, not 404. Both mean "absent" for optional files.
    if (res.status === 404 || res.status === 403) return null;
    if (!res.ok) throw new Error(`Demo fetch failed (HTTP ${res.status}): ${rel}`);
    return parseDocument(await res.text());
  }

  async readText(path: string[]): Promise<string | null> {
    try {
      const res = await fetch(this.baseUrl + path.join('/'), { cache: 'no-cache' });
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  }

  async writeText(): Promise<void> {
    throw new Error(READ_ONLY_DEMO);
  }

  /** Fetch the manifest and classify its documents — the demo's "open project". */
  async open(): Promise<{ name: string; documents: DocumentListItem[] }> {
    const res = await fetch(`${this.baseUrl}manifest.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Could not load the demo manifest (HTTP ${res.status})`);
    const manifest = (await res.json()) as { documents: string[] };
    if (!Array.isArray(manifest.documents)) {
      throw new Error('Demo manifest is malformed: missing "documents" array');
    }
    this.documents = manifest.documents
      .map(classifyDocFilename)
      .filter((d): d is DocumentListItem => d !== null);
    this.name = projectNameFrom(this.documents);
    return { name: this.name, documents: this.documents };
  }
}
