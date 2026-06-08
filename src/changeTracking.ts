/**
 * changeTracking — pure editor-side derivation of redline + attribution.
 * No I/O, no React. Built on the shared diff primitive so the editor's view of
 * "what changed" is identical to the contract's. Attribution is DERIVED from the
 * raw snapshots the skill cached — never stored (see specpad-change-tracking-design.md).
 */
import type { SrsDoc, VtpDoc, SrsItem, VtpItem, AuthorRef } from './shared';
import { diffDocs, diffItems } from './shared';
import type { ItemChange } from './shared';

type AnyDoc = SrsDoc | VtpDoc;
type AnyItem = SrsItem | VtpItem;

export interface RedlineEntry {
  status: 'added' | 'modified';
  changedFields?: string[];
}

export interface RedlineView {
  /** Working-doc items that are new or changed vs the baseline, keyed by id. */
  byId: Map<string, RedlineEntry>;
  /** Items present in the baseline but absent from the working doc. */
  removed: ItemChange<AnyItem>[];
}

/** Diff the working doc against a baseline snapshot (the latest release). */
export function buildRedline(baseline: AnyDoc | null, working: AnyDoc): RedlineView {
  const byId = new Map<string, RedlineEntry>();
  if (!baseline) return { byId, removed: [] };
  const diff = diffDocs(baseline, working);
  for (const c of diff.added) byId.set(c.id, { status: 'added' });
  for (const c of diff.modified) {
    byId.set(c.id, { status: 'modified', changedFields: c.changedFields });
  }
  return { byId, removed: diff.removed };
}

export interface SnapshotInput {
  version: string;
  author: AuthorRef;
  doc: AnyDoc;
}

export interface AttributionView {
  addedIn: string;
  /** True when addedIn is the OLDEST cached snapshot — the item may be older still. */
  addedBoundary: boolean;
  lastChangedIn: string;
  /** Author of the lastChangedIn release. */
  author: AuthorRef;
}

/**
 * Derive per-item attribution from cached snapshots, ordered OLDEST → NEWEST.
 * Everything in the oldest snapshot is a "boundary" add (could predate the cache).
 * Each later snapshot's adds/modifies advance the record; removals drop it.
 */
export function computeAttribution(snapshots: SnapshotInput[]): Map<string, AttributionView> {
  const out = new Map<string, AttributionView>();
  if (snapshots.length === 0) return out;

  const [first, ...rest] = snapshots;
  for (const item of first.doc.items) {
    out.set(item.id, {
      addedIn: first.version,
      addedBoundary: true,
      lastChangedIn: first.version,
      author: first.author,
    });
  }

  let prev = first;
  for (const snap of rest) {
    const diff = diffItems(prev.doc.items, snap.doc.items);
    for (const c of diff.added) {
      out.set(c.id, {
        addedIn: snap.version,
        addedBoundary: false,
        lastChangedIn: snap.version,
        author: snap.author,
      });
    }
    for (const c of diff.modified) {
      const cur = out.get(c.id);
      if (cur) {
        cur.lastChangedIn = snap.version;
        cur.author = snap.author;
      } else {
        out.set(c.id, {
          addedIn: snap.version,
          addedBoundary: false,
          lastChangedIn: snap.version,
          author: snap.author,
        });
      }
    }
    for (const c of diff.removed) out.delete(c.id);
    prev = snap;
  }
  return out;
}
