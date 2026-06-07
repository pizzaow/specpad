/**
 * VersionTimeline — read-only release history from the change-tracking manifest.
 * Renders nothing when there is no manifest (degraded state handled by the parent).
 */
import React from 'react';
import type { ReleasesDoc } from '../shared';

interface VersionTimelineProps {
  releases: ReleasesDoc | null;
}

const VersionTimeline: React.FC<VersionTimelineProps> = ({ releases }) => {
  if (!releases || releases.releases.length === 0) return null;
  const rows = [...releases.releases].reverse();
  return (
    <div className="panel panel-default ct-timeline">
      <div className="panel-heading"><strong>Version history</strong></div>
      <ul className="list-group">
        {rows.map((r) => (
          <li key={r.version} className="list-group-item">
            <strong>{r.version}</strong>
            {r.version === releases.baseline && <span className="label label-info" style={{ marginLeft: 6 }}>baseline</span>}
            <span className="text-muted" style={{ marginLeft: 8 }}>{r.date} · {r.author.name}</span>
            {!r.snapshot && <span className="text-muted" style={{ marginLeft: 8 }}>(not cached)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default VersionTimeline;
