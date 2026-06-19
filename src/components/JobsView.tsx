/**
 * JobsView — the Jobs tab, presented as release notes. The list groups jobs by
 * major version (unversioned under "Unreleased"), then by type into Features and
 * Bugfixes, with each job's description beneath its title. Selecting a job opens a
 * separate detail view (record editor + active-job control); the SRS/VTP changes
 * for a job will live there too. The register stores records only — a job's
 * change-set is derived from git, never stored here.
 */
import React, { useState } from 'react';
import type { JobsDoc, JobRecord, JobType } from '../shared';
import { createJobsDoc, createJobRecord } from '../shared';

interface JobsViewProps {
  doc: JobsDoc | null;
  projectName: string;
  activeIds: string[];
  onChange: (next: JobsDoc) => void;
  onSetActive: (ids: string[]) => void;
  readOnly?: boolean;
}

/** Major-version group label for a job: "v1" from "1.2"/"v1.x", else "Unreleased". */
function majorLabel(version?: string): string {
  const v = (version ?? '').trim();
  if (!v) return 'Unreleased';
  const major = v.replace(/^v/i, '').split('.')[0];
  return /^\d+$/.test(major) ? `v${major}` : v;
}

function groupOrder(a: string, b: string): number {
  if (a === 'Unreleased') return -1;
  if (b === 'Unreleased') return 1;
  const na = parseInt(a.replace(/^v/i, ''), 10);
  const nb = parseInt(b.replace(/^v/i, ''), 10);
  if (!isNaN(na) && !isNaN(nb)) return nb - na; // newest major first
  return a < b ? 1 : -1;
}

const typeOf = (j: JobRecord): JobType => j.type ?? 'feature';

const JobsView: React.FC<JobsViewProps> = ({ doc, projectName, activeIds, onChange, onSetActive, readOnly }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const jobs = doc?.jobs ?? [];
  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  const replace = (next: JobRecord[]) => onChange({ ...(doc ?? createJobsDoc(projectName)), jobs: next });

  const addJob = () => {
    const job = createJobRecord(jobs.map((j) => j.id));
    const nextNum = jobs.reduce((max, j) => {
      const m = /^JOB-(\d+)$/.exec(j.code ?? '');
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0) + 1;
    job.code = `JOB-${nextNum}`;
    job.type = 'feature';
    job.title = 'New job';
    replace([...jobs, job]);
    setSelectedId(job.id);
  };

  const updateSelected = (patch: Partial<JobRecord>) => {
    if (!selected) return;
    replace(jobs.map((j) => (j.id === selected.id ? { ...j, ...patch } : j)));
  };

  const setActive = (id: string, on: boolean) =>
    onSetActive(on ? [...activeIds, id] : activeIds.filter((x) => x !== id));

  if (!doc && readOnly) {
    return <div className="alert alert-info">No jobs register for this project.</div>;
  }

  // ---- Detail view ---------------------------------------------------------
  if (selected) {
    const isActive = activeIds.includes(selected.id);
    return (
      <div className="jobs-detail">
        <button className="btn btn-link" style={{ paddingLeft: 0 }} onClick={() => setSelectedId(null)}>← All jobs</button>
        <h3 style={{ marginTop: 4 }}>
          {selected.code && <span className="text-muted" style={{ marginRight: 8 }}>{selected.code}</span>}
          {selected.title || <em>(untitled)</em>}
        </h3>
        <div className="form-horizontal" style={{ maxWidth: 720 }}>
          <Field label="Code">
            <input type="text" className="form-control" value={selected.code ?? ''} disabled={readOnly}
              placeholder="JOB-1" onChange={(e) => updateSelected({ code: e.target.value })} />
          </Field>
          <Field label="Type">
            <select className="form-control" value={typeOf(selected)} disabled={readOnly} aria-label="Job type"
              onChange={(e) => updateSelected({ type: e.target.value as JobType })}>
              <option value="feature">feature</option>
              <option value="bugfix">bugfix</option>
            </select>
          </Field>
          <Field label="Version">
            <input type="text" className="form-control" value={selected.version ?? ''} disabled={readOnly}
              placeholder="e.g. 1.2 (blank = Unreleased)" onChange={(e) => updateSelected({ version: e.target.value })} />
          </Field>
          <Field label="Title">
            <input type="text" className="form-control" value={selected.title} disabled={readOnly}
              onChange={(e) => updateSelected({ title: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className="form-control" rows={4} value={selected.description ?? ''} disabled={readOnly}
              onChange={(e) => updateSelected({ description: e.target.value })} />
          </Field>
          <Field label="Status">
            <select className="form-control" value={selected.status} disabled={readOnly} aria-label="Job status"
              onChange={(e) => updateSelected({ status: e.target.value as JobRecord['status'] })}>
              <option value="open">open</option>
              <option value="closed">closed</option>
            </select>
          </Field>
          {!readOnly && (
            <Field label="">
              {isActive ? (
                <>
                  <span className="text-muted" style={{ marginRight: 8 }}>
                    {selected.status === 'closed' ? 'Active but closed — remove it from the active set.' : 'Active.'}
                  </span>
                  <button className="btn btn-default btn-sm" onClick={() => setActive(selected.id, false)}>Remove from active</button>
                </>
              ) : selected.status === 'closed' ? (
                <span className="text-muted">A closed job can't be made active — reopen it or start a new job.</span>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={() => setActive(selected.id, true)}>Add to active jobs</button>
              )}
            </Field>
          )}
        </div>
        <p className="text-muted" style={{ marginTop: 16 }}>
          The SRS/VTP changes for this job will appear here.
        </p>
      </div>
    );
  }

  // ---- List view (release notes) ------------------------------------------
  const groups = new Map<string, JobRecord[]>();
  for (const j of jobs) {
    const key = majorLabel(j.version);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(j);
  }
  const orderedGroups = [...groups.keys()].sort(groupOrder);

  const jobRow = (j: JobRecord) => (
    <li key={j.id} className="jobs-note" role="button" tabIndex={0} style={{ cursor: 'pointer', padding: '6px 0' }}
      onClick={() => setSelectedId(j.id)}>
      <div>
        {j.code && <span className="text-muted" style={{ marginRight: 6 }}>{j.code}</span>}
        <strong>{j.title || <em>(untitled)</em>}</strong>
        {activeIds.includes(j.id) && <span className="label label-primary" style={{ marginLeft: 6 }}>active</span>}
        {j.status === 'closed' && <span className="label label-default" style={{ marginLeft: 6 }}>closed</span>}
      </div>
      {j.description && <div className="text-muted" style={{ marginTop: 2 }}>{j.description}</div>}
    </li>
  );

  return (
    <div className="jobs-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Jobs</h3>
        {!readOnly && <button className="btn btn-default btn-xs" onClick={addJob}>+ New job</button>}
      </div>
      {jobs.length === 0 ? (
        <p className="text-muted">No jobs yet.{!readOnly && ' Add one to start tracking work.'}</p>
      ) : (
        orderedGroups.map((g) => {
          const inGroup = groups.get(g)!;
          const features = inGroup.filter((j) => typeOf(j) === 'feature');
          const bugfixes = inGroup.filter((j) => typeOf(j) === 'bugfix');
          return (
            <section key={g} className="jobs-release" style={{ marginBottom: 18 }}>
              <h4 style={{ borderBottom: '1px solid #ddd', paddingBottom: 4 }}>{g}</h4>
              {features.length > 0 && (
                <>
                  <h5>Features</h5>
                  <ul className="list-unstyled" style={{ marginLeft: 8 }}>{features.map(jobRow)}</ul>
                </>
              )}
              {bugfixes.length > 0 && (
                <>
                  <h5>Bugfixes</h5>
                  <ul className="list-unstyled" style={{ marginLeft: 8 }}>{bugfixes.map(jobRow)}</ul>
                </>
              )}
            </section>
          );
        })
      )}
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="form-group">
    <label className="col-sm-2 control-label">{label}</label>
    <div className="col-sm-10">{children}</div>
  </div>
);

export default JobsView;
