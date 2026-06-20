/**
 * ReleasesView — the Releases tab. A release is first-class: a version + its set of
 * jobs + a full-doc snapshot (the design checkpoint the export is generated from).
 * This reads as release notes — newest release first, each with its date/author and
 * the jobs that shipped in it, grouped Features / Bugfixes. Closed jobs not yet in a
 * release appear under "Unreleased".
 */
import React from 'react';
import type { ReleasesDoc, JobRecord, JobType } from '../shared';

interface ReleasesViewProps {
  releases: ReleasesDoc | null;
  jobs: JobRecord[];
}

const typeOf = (j: JobRecord): JobType => j.type ?? 'feature';

const JobLines: React.FC<{ jobs: JobRecord[] }> = ({ jobs }) => {
  const features = jobs.filter((j) => typeOf(j) === 'feature');
  const bugfixes = jobs.filter((j) => typeOf(j) === 'bugfix');
  const group = (label: string, list: JobRecord[]) =>
    list.length === 0 ? null : (
      <>
        <h6>{label}</h6>
        <ul className="list-unstyled" style={{ marginLeft: 8 }}>
          {list.map((j) => (
            <li key={j.id} style={{ padding: '3px 0' }}>
              {j.code && <span className="text-muted" style={{ marginRight: 6 }}>{j.code}</span>}
              <strong>{j.title || <em>(untitled)</em>}</strong>
              {j.owner && <span className="text-muted"> · {j.owner.name}</span>}
              {j.description && <div className="text-muted" style={{ marginTop: 1 }}>{j.description}</div>}
            </li>
          ))}
        </ul>
      </>
    );
  return <>{group('Features', features)}{group('Bugfixes', bugfixes)}</>;
};

const ReleasesView: React.FC<ReleasesViewProps> = ({ releases, jobs }) => {
  if (!releases || releases.releases.length === 0) {
    return <div className="alert alert-info">No releases yet — tag a version and run a refresh.</div>;
  }
  const closed = jobs.filter((j) => j.status === 'closed');
  const unreleased = closed.filter((j) => !j.version);
  const newestFirst = [...releases.releases].reverse();

  return (
    <div className="releases-view">
      <h3 style={{ marginTop: 0 }}>Releases</h3>

      {unreleased.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <h4 style={{ borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Unreleased</h4>
          <JobLines jobs={unreleased} />
        </section>
      )}

      {newestFirst.map((rel) => {
        const relJobs = closed.filter((j) => j.version === rel.version);
        return (
          <section key={rel.version} style={{ marginBottom: 18 }}>
            <h4 style={{ borderBottom: '1px solid #ddd', paddingBottom: 4 }}>
              {rel.version}
              <span className="text-muted" style={{ fontSize: '0.8em', fontWeight: 'normal' }}>
                {' · '}{rel.date}{rel.author ? ` · ${rel.author.name}` : ''}
                {rel.snapshot ? ' · snapshot cached' : ''}
              </span>
            </h4>
            {relJobs.length > 0 ? <JobLines jobs={relJobs} /> : <p className="text-muted">No tracked jobs in this release.</p>}
          </section>
        );
      })}
    </div>
  );
};

export default ReleasesView;
