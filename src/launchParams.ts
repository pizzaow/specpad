/**
 * Launch parameters carried by the generated launcher (docs/specpad/index.html).
 *
 * The launcher redirects to the hosted editor with params in the URL *fragment*
 * (after `#`) so the local folder path in `dir` is never sent to the server.
 * Older launchers used the query string, so we fall back to that.
 * `demo` is not a launcher param — it always arrives in the query string
 * (specpad.com/v01/?demo), so it is read from `loc.search` directly and is
 * never masked by a fragment; it is presence-based (any value enables it).
 */
export type OpenView = 'srs' | 'vtp' | 'testing';

export interface LaunchParams {
  name?: string;
  open?: OpenView;
  dir?: string; // the launcher's own folder path, used only to correlate locally
  demo: boolean; // read-only hosted demo (specpad.com/v01/?demo)
}

export function parseLaunchParams(loc: Location = window.location): LaunchParams {
  const fromHash = loc.hash && loc.hash.length > 1 ? loc.hash.slice(1) : '';
  const fromSearch = loc.search.replace(/^\?/, '');
  const raw = fromHash || fromSearch;
  const p = new URLSearchParams(raw);
  const search = new URLSearchParams(fromSearch);
  const open = p.get('open');
  return {
    name: p.get('name') || undefined,
    open: open === 'srs' || open === 'vtp' || open === 'testing' ? open : undefined,
    dir: p.get('dir') || undefined,
    demo: search.has('demo') || p.has('demo'),
  };
}
