/**
 * Where the launcher sends you (EDR-4).
 *
 * `docs/specpad/index.html` is a generated redirect: a double-clicked `file://` page
 * cannot grant File System Access, but an https page can. By default it points at the
 * public hosted editor; a company running its own SpecPad server sets `editorBaseUrl`
 * in the project index so everyone on that repo lands on their server instead.
 *
 * The version path is derived from the contract version, never hand-written: a "1.0"
 * document opens in the /v01/ build, and old version paths stay live forever, so a file
 * always opens in an editor that understands it.
 */
import { SCHEMA_VERSION } from './schema';

export const DEFAULT_EDITOR_BASE = 'https://specpad.com';

/** Editor build path for a contract version: "1.0" → "/v01/". */
export function editorVersionPath(schemaVersion: string = SCHEMA_VERSION): string {
  const major = schemaVersion.split('.')[0];
  if (!/^\d+$/.test(major)) {
    throw new Error(`Cannot derive an editor path from schemaVersion "${schemaVersion}"`);
  }
  return `/v${major.padStart(2, '0')}/`;
}

/**
 * The versioned editor URL for a project. An absent or blank base falls back to the
 * public hosted editor, so an existing project keeps working untouched.
 */
export function editorUrl(
  baseUrl: string | undefined | null,
  schemaVersion: string = SCHEMA_VERSION,
): string {
  const base = (baseUrl ?? '').trim() || DEFAULT_EDITOR_BASE;
  return base.replace(/\/+$/, '') + editorVersionPath(schemaVersion);
}
