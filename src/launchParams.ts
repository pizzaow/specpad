/**
 * Launch parameters carried by the generated launcher (docs/specpad/index.html).
 *
 * The launcher redirects to the hosted editor with params in the URL *fragment*
 * (after `#`) so the local folder path in `dir` is never sent to the server.
 * Older launchers used the query string, so we fall back to that.
 */
export type OpenView = 'srs' | 'vtp' | 'testing';

export interface LaunchParams {
  name?: string;
  open?: OpenView;
  dir?: string; // the launcher's own folder path, used only to correlate locally
}

export function parseLaunchParams(loc: Location = window.location): LaunchParams {
  const fromHash = loc.hash && loc.hash.length > 1 ? loc.hash.slice(1) : '';
  const raw = fromHash || loc.search.replace(/^\?/, '');
  const p = new URLSearchParams(raw);
  const open = p.get('open');
  return {
    name: p.get('name') || undefined,
    open: open === 'srs' || open === 'vtp' || open === 'testing' ? open : undefined,
    dir: p.get('dir') || undefined,
  };
}
