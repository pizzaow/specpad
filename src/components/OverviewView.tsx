/**
 * OverviewView — the editor's Home. An engineer's status home for the open
 * project: a coverage/health headline, the in-progress jobs, the latest release,
 * and quick jumps into the authoring views. Read-only; computed from the loaded
 * documents (coverage via the shared buildAuditReport).
 */
import React from 'react';
import type { PrdDoc, SrsDoc, VtpDoc, ReleasesDoc, JobRecord } from '../shared';
import { buildAuditReport } from '../auditReport';
import type { ViewKey } from './ViewTabs';

interface OverviewViewProps {
  projectName: string;
  prd: PrdDoc | null;
  srs: SrsDoc | null;
  vtp: VtpDoc | null;
  releases: ReleasesDoc | null;
  jobs: JobRecord[];
  onNavigate: (key: ViewKey) => void;
}

const Metric: React.FC<{ value: React.ReactNode; label: string; tone?: 'ok' | 'danger'; accent?: boolean }> = ({ value, label, tone, accent }) => (
  <div className={`metric-card${accent ? ' is-accent' : ''}`}>
    <div className={`metric-value${tone ? ` tone-${tone}` : ''}`}>{value}</div>
    <div className="metric-label">{label}</div>
  </div>
);

const OverviewView: React.FC<OverviewViewProps> = ({ projectName, prd, srs, vtp, releases, jobs, onNavigate }) => {
  const report = buildAuditReport({ prd, srs, vtp });
  const { requirements } = report.coverage;
  const findings = report.violations.length;
  const openJobs = jobs.filter((j) => j.status === 'open');
  const relList = releases?.releases ?? [];
  const latest = relList.length ? relList[relList.length - 1] : null;
  const latestJobs = latest ? jobs.filter((j) => j.status === 'closed' && j.version === latest.version).length : 0;

  return (
    <div className="overview">
      <h2>{projectName || 'SpecPad'}</h2>
      <p className="overview-sub">
        Project overview — the status of the documentation you're maintaining{latest ? <> · latest release <strong>{latest.version}</strong></> : null}.
      </p>

      <div className="overview-metrics">
        <Metric
          accent
          value={`${requirements.verified}/${requirements.total}`}
          label="requirements verified"
        />
        <Metric
          value={findings}
          label={findings === 1 ? 'open governance finding' : 'open governance findings'}
          tone={findings === 0 ? 'ok' : 'danger'}
        />
        <Metric value={report.coverage.tests.passed} label="tests passed" tone="ok" />
        <Metric value={latest ? latest.version : 'Unreleased'} label="latest release" />
      </div>

      <div className="overview-cols">
        <div className="overview-col">
          <h4>In progress</h4>
          {openJobs.length === 0 ? (
            <p className="text-muted">No open jobs — set one before changing the spec.</p>
          ) : (
            <ul className="list-unstyled" style={{ margin: 0 }}>
              {openJobs.map((j) => (
                <li key={j.id} style={{ padding: '4px 0' }}>
                  {j.code && <span className="label label-default" style={{ marginRight: 6 }}>{j.code}</span>}
                  <strong>{j.title || <em>(untitled)</em>}</strong>
                  {j.owner && <span className="text-muted"> · {j.owner.name}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="overview-col">
          <h4>Latest release</h4>
          {latest ? (
            <p style={{ margin: 0 }}>
              <strong>{latest.version}</strong>
              <span className="text-muted"> · {latest.date}{latest.author ? ` · ${latest.author.name}` : ''}</span>
              <br />
              <span className="text-muted">{latestJobs} {latestJobs === 1 ? 'job' : 'jobs'} shipped</span>
            </p>
          ) : (
            <p className="text-muted" style={{ margin: 0 }}>No releases yet — tag a version and refresh.</p>
          )}
        </div>
      </div>

      <div className="overview-jump">
        <button className="btn btn-primary btn-sm" onClick={() => onNavigate('srs')}>Open requirements</button>
        <button className="btn btn-default btn-sm" onClick={() => onNavigate('vtp')}>Verification tests</button>
        <button className="btn btn-default btn-sm" onClick={() => onNavigate('audit')}>Auditor view</button>
        <button className="btn btn-default btn-sm" onClick={() => onNavigate('jobs')}>Jobs</button>
      </div>
    </div>
  );
};

export default OverviewView;
