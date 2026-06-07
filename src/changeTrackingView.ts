/**
 * changeTrackingView — pure presentation helpers for the editor's change-tracking UI.
 * No React. Map the Plan-3a derivations (RedlineEntry / AttributionView) and the
 * manifest into display strings, CSS classes, and a snapshot-load order.
 */
import type { RedlineEntry, AttributionView, SnapshotInput } from './changeTracking';
import type { ReleasesDoc } from './shared';
import type { SnapshotLocation } from './localFileApi';

/** Bootstrap contextual row class for a redline status (heading always wins). */
export function rowStatusClass(heading: boolean | undefined, rl: RedlineEntry | undefined): string {
  if (heading) return 'info';
  if (rl?.status === 'added') return 'success';
  if (rl?.status === 'modified') return 'warning';
  return '';
}

/** Whether a given field's cell should be flagged as changed. */
export function isCellChanged(rl: RedlineEntry | undefined, field: string): boolean {
  return rl?.status === 'modified' && (rl.changedFields?.includes(field) ?? false);
}

/** Compact attribution label. Boundary adds show "≤v"; undefined → "new". */
export function attributionLabel(a: AttributionView | undefined): string {
  if (!a) return 'new';
  const added = a.addedBoundary ? `≤${a.addedIn}` : a.addedIn;
  const who = a.author?.name ?? '';
  if (a.lastChangedIn === a.addedIn) {
    return who ? `${added} · ${who}` : added;
  }
  return who
    ? `added ${added} · changed ${a.lastChangedIn} · ${who}`
    : `added ${added} · changed ${a.lastChangedIn}`;
}

/** A cached release ready to load: version, author, and its snapshot location. */
export interface CachedRelease {
  version: string;
  author: SnapshotInput['author'];
  location: SnapshotLocation;
}

/**
 * The cached releases from a manifest, in manifest order (oldest → newest), each
 * mapped to the snapshot location to load. The baseline version maps to 'baseline';
 * other cached versions map to their snapshots dir. Uncached releases are dropped.
 */
export function cachedReleases(releases: ReleasesDoc | null): CachedRelease[] {
  if (!releases) return [];
  return releases.releases
    .filter((r) => r.snapshot)
    .map((r) => ({
      version: r.version,
      author: r.author,
      location: r.version === releases.baseline ? 'baseline' : { version: r.version },
    }));
}
