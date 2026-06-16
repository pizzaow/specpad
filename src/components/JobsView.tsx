/**
 * JobsView — the Jobs tab: a master/detail editor over the jobs register
 * (<name>.jobs.json). Left: every job record with its status; right: the editor
 * for the selected record (code, title, description, status) plus "Set as active
 * job". The register stores records only — which SRS/VTP items and commits a job
 * touched is derived from git via the Job: trailer, never stored here.
 *
 * A closed job's scope is sealed: it cannot be made the active job (the shared
 * `active-job-open` governance rule). Reopen it, or start a new job for new work.
 */
import React, { useState } from 'react';
import type { JobsDoc, JobRecord } from '../shared';
import { createJobsDoc, createJobRecord } from '../shared';

interface JobsViewProps {
  doc: JobsDoc | null;
  projectName: string;
  activeJobId: string | null;
  onChange: (next: JobsDoc) => void;
  onSetActive: (id: string, title: string) => void;
  readOnly?: boolean;
}

const JobsView: React.FC<JobsViewProps> = ({
  doc,
  projectName,
  activeJobId,
  onChange,
  onSetActive,
  readOnly,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const jobs = doc?.jobs ?? [];
  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  const replace = (next: JobRecord[]) => {
    const base = doc ?? createJobsDoc(projectName);
    onChange({ ...base, jobs: next });
  };

  const addJob = () => {
    const job = createJobRecord(jobs.map((j) => j.id));
    job.code = `JOB-${jobs.length + 1}`;
    job.title = 'New job';
    replace([...jobs, job]);
    setSelectedId(job.id);
  };

  const updateSelected = (patch: Partial<JobRecord>) => {
    if (!selected) return;
    replace(jobs.map((j) => (j.id === selected.id ? { ...j, ...patch } : j)));
  };

  if (!doc && readOnly) {
    return <div className="alert alert-info">No jobs register for this project.</div>;
  }

  return (
    <div className="jobs-view" style={{ display: 'flex', gap: 16 }}>
      <div className="jobs-list" style={{ flex: '0 0 280px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong>Jobs</strong>
          {!readOnly && (
            <button className="btn btn-default btn-xs" onClick={addJob}>+ New job</button>
          )}
        </div>
        {jobs.length === 0 ? (
          <p className="text-muted">No jobs yet.{!readOnly && ' Add one to start tracking work.'}</p>
        ) : (
          <ul className="list-group">
            {jobs.map((j) => (
              <li
                key={j.id}
                className={`list-group-item${j.id === selectedId ? ' active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(j.id)}
                style={{ cursor: 'pointer' }}
              >
                <span>
                  {j.code && <span className="text-muted" style={{ marginRight: 6 }}>{j.code}</span>}
                  {j.title || <em>(untitled)</em>}
                </span>
                <span style={{ float: 'right' }}>
                  {j.id === activeJobId && <span className="label label-primary" style={{ marginRight: 4 }}>active</span>}
                  <span className={`label label-${j.status === 'open' ? 'success' : 'default'}`}>{j.status}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="jobs-detail" style={{ flex: 1 }}>
        {!selected ? (
          <p className="text-muted">Select a job to view or edit it.</p>
        ) : (
          <div className="form-horizontal">
            <div className="form-group">
              <label className="col-sm-2 control-label">Code</label>
              <div className="col-sm-10">
                <input
                  type="text"
                  className="form-control"
                  value={selected.code ?? ''}
                  disabled={readOnly}
                  placeholder="JOB-1"
                  onChange={(e) => updateSelected({ code: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="col-sm-2 control-label">Title</label>
              <div className="col-sm-10">
                <input
                  type="text"
                  className="form-control"
                  value={selected.title}
                  disabled={readOnly}
                  onChange={(e) => updateSelected({ title: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="col-sm-2 control-label">Description</label>
              <div className="col-sm-10">
                <textarea
                  className="form-control"
                  rows={4}
                  value={selected.description ?? ''}
                  disabled={readOnly}
                  onChange={(e) => updateSelected({ description: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="col-sm-2 control-label">Status</label>
              <div className="col-sm-10">
                <select
                  className="form-control"
                  value={selected.status}
                  disabled={readOnly}
                  onChange={(e) => updateSelected({ status: e.target.value as JobRecord['status'] })}
                  aria-label="Job status"
                >
                  <option value="open">open</option>
                  <option value="closed">closed</option>
                </select>
              </div>
            </div>
            {!readOnly && (
              <div className="form-group">
                <div className="col-sm-offset-2 col-sm-10">
                  {selected.id === activeJobId ? (
                    <span className="text-muted">This is the active job.</span>
                  ) : selected.status === 'closed' ? (
                    <span className="text-muted">A closed job can't be made active — reopen it or start a new job.</span>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onSetActive(selected.id, selected.title)}
                    >
                      Set as active job
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobsView;
