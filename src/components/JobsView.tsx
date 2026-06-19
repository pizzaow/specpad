/**
 * JobsView — the Jobs tab. Two areas:
 *  - "In progress" (open jobs) — what's being worked on; the active one shows live
 *    work in the spec tabs. Others' open jobs have no detail until they're closed.
 *  - "Released" (closed jobs) — release notes, grouped by major version
 *    (unversioned under "Unreleased"), then Features / Bugfixes, description beneath.
 *
 * Selecting a job opens a separate detail view. For a CLOSED job the detail renders
 * the job's SRS/VTP changes from its committed before/after cache (diffed here); an
 * open job's per-job changes aren't materialized until it closes.
 *
 * `version` is skill-derived (the release containing the job); `owner` is set from
 * git at creation. The register still stores records only — the change-set is the
 * git-derived, frozen-on-close cache.
 */
import React, { useState } from 'react';
import type { JobsDoc, JobRecord, JobType, DocDiff, ItemChange, SrsItem, VtpItem, JobCommit } from '../shared';
import { createJobsDoc, createJobRecord } from '../shared';

type JobDiff = { srs?: DocDiff<SrsItem | VtpItem>; vtp?: DocDiff<SrsItem | VtpItem> };

interface JobsViewProps {
  doc: JobsDoc | null;
  projectName: string;
  activeIds: string[];
  jobDiffs?: Record<string, JobDiff>;
  jobCommits?: Record<string, JobCommit[]>;
  onChange: (next: JobsDoc) => void;
  onSetActive: (ids: string[]) => void;
  readOnly?: boolean;
}

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
  if (!isNaN(na) && !isNaN(nb)) return nb - na;
  return a < b ? 1 : -1;
}

const typeOf = (j: JobRecord): JobType => j.type ?? 'feature';
const ownerOf = (j: JobRecord): string => (j.owner ? j.owner.name : '');

const JobsView: React.FC<JobsViewProps> = ({ doc, projectName, activeIds, jobDiffs, jobCommits, onChange, onSetActive, readOnly }) => {
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
    const diff = jobDiffs?.[selected.id];
    const commits = jobCommits?.[selected.id] ?? [];
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
            <p className="form-control-static text-muted">{selected.version || 'Unreleased'} <small>(derived from git)</small></p>
          </Field>
          <Field label="Owner">
            <p className="form-control-static">{selected.owner ? `${selected.owner.name} <${selected.owner.email}>` : <span className="text-muted">unassigned</span>}</p>
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

        <h4 style={{ marginTop: 20 }}>Changes</h4>
        {selected.status !== 'closed' ? (
          <p className="text-muted">In progress — this job's SRS/VTP changes are materialized once it is closed.</p>
        ) : diff && (diff.srs || diff.vtp) ? (
          <>
            <DiffList label="Requirements (SRS)" diff={diff.srs} />
            <DiffList label="Verification tests (VTP)" diff={diff.vtp} />
            {isEmptyDiff(diff.srs) && isEmptyDiff(diff.vtp) && <p className="text-muted">No SRS/VTP changes in this job.</p>}
          </>
        ) : (
          <p className="text-muted">No cached changes for this job — run <code>specpad refresh</code>.</p>
        )}

        {selected.status === 'closed' && commits.length > 0 && (
          <>
            <h4 style={{ marginTop: 20 }}>Commits ({commits.length})</h4>
            <ul className="list-unstyled" style={{ marginLeft: 8 }}>
              {commits.map((c) => (
                <li key={c.hash} style={{ padding: '2px 0' }}>
                  <code className="text-muted">{c.hash.slice(0, 9)}</code> {c.subject}
                  <span className="text-muted"> · {c.author} · {c.date}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  // ---- List view -----------------------------------------------------------
  const open = jobs.filter((j) => j.status === 'open');
  const closed = jobs.filter((j) => j.status === 'closed');

  const groups = new Map<string, JobRecord[]>();
  for (const j of closed) {
    const key = majorLabel(j.version);
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(j);
  }
  const orderedGroups = [...groups.keys()].sort(groupOrder);

  const row = (j: JobRecord) => (
    <li key={j.id} className="jobs-note" role="button" tabIndex={0} style={{ cursor: 'pointer', padding: '6px 0' }}
      onClick={() => setSelectedId(j.id)}>
      <div>
        {j.code && <span className="text-muted" style={{ marginRight: 6 }}>{j.code}</span>}
        <strong>{j.title || <em>(untitled)</em>}</strong>
        {activeIds.includes(j.id) && <span className="label label-primary" style={{ marginLeft: 6 }}>active</span>}
        {ownerOf(j) && <span className="text-muted" style={{ marginLeft: 6 }}>· {ownerOf(j)}</span>}
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

      <section className="jobs-inprogress" style={{ marginBottom: 18 }}>
        <h4 style={{ borderBottom: '1px solid #ddd', paddingBottom: 4 }}>In progress</h4>
        {open.length === 0 ? (
          <p className="text-muted">No open jobs.</p>
        ) : (
          <ul className="list-unstyled" style={{ marginLeft: 8 }}>{open.map(row)}</ul>
        )}
      </section>

      <section className="jobs-released">
        <h4 style={{ borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Released</h4>
        {closed.length === 0 ? (
          <p className="text-muted">No closed jobs yet.</p>
        ) : (
          orderedGroups.map((g) => {
            const inGroup = groups.get(g)!;
            const features = inGroup.filter((j) => typeOf(j) === 'feature');
            const bugfixes = inGroup.filter((j) => typeOf(j) === 'bugfix');
            return (
              <div key={g} style={{ marginBottom: 14 }}>
                <h5 style={{ fontWeight: 'bold' }}>{g}</h5>
                {features.length > 0 && (<><h6>Features</h6><ul className="list-unstyled" style={{ marginLeft: 8 }}>{features.map(row)}</ul></>)}
                {bugfixes.length > 0 && (<><h6>Bugfixes</h6><ul className="list-unstyled" style={{ marginLeft: 8 }}>{bugfixes.map(row)}</ul></>)}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};

const isEmptyDiff = (d?: DocDiff<SrsItem | VtpItem>) => !d || (!d.added.length && !d.modified.length && !d.removed.length);

type Change = ItemChange<SrsItem | VtpItem>;

const label = (c: Change) => {
  const item = c.after ?? c.before;
  if (!item) return '';
  return item.code ? `${item.code} — ${item.text}` : item.text;
};

const DiffList: React.FC<{ label: string; diff?: DocDiff<SrsItem | VtpItem> }> = ({ label: heading, diff }) => {
  if (isEmptyDiff(diff)) return null;
  const visible = (cs: Change[]) => cs.filter((c) => !(c.after ?? c.before)?.heading);
  const added = visible(diff!.added);
  const modified = visible(diff!.modified);
  const removed = visible(diff!.removed);
  if (!added.length && !modified.length && !removed.length) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <strong>{heading}</strong>
      <ul className="list-unstyled" style={{ marginLeft: 8 }}>
        {added.map((c) => <li key={c.id} className="text-success">+ {label(c)}</li>)}
        {modified.map((c) => <li key={c.id} className="text-warning">~ {label(c)}{c.changedFields?.length ? ` (${c.changedFields.join(', ')})` : ''}</li>)}
        {removed.map((c) => <li key={c.id} className="text-danger" style={{ textDecoration: 'line-through' }}>− {label(c)}</li>)}
      </ul>
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
