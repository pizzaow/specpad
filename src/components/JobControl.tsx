/**
 * JobControl — set the active-job marker (<name>.job.json), folded into commit
 * trailers by the skill. Two modes:
 *  - register-aware: when the project has a jobs register, check any number of
 *    OPEN records (the marker stores their stable ids); closed records aren't
 *    offered, so you can't activate one by accident.
 *  - free-text: with no register, enter a single tracker key + optional title
 *    (the original behavior, kept for the external-tracker case).
 */
import React, { useState } from 'react';
import type { JobDoc, JobRecord } from '../shared';

interface JobControlProps {
  job: JobDoc | null;
  onSet: (ids: string[], title?: string) => void;
  jobs?: JobRecord[];
  activeIds?: string[];
}

const JobControl: React.FC<JobControlProps> = ({ job, onSet, jobs, activeIds }) => {
  const open = (jobs ?? []).filter((j) => j.status === 'open');
  const [jobId, setJobId] = useState(job?.job ?? '');
  const [title, setTitle] = useState(job?.title ?? '');
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set((activeIds ?? []).filter((id) => open.some((j) => j.id === id))),
  );

  if (jobs && jobs.length > 0) {
    const toggle = (id: string) =>
      setChecked((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    return (
      <div className="ct-job-control" style={{ marginBottom: 10 }}>
        <strong style={{ display: 'block', marginBottom: 6 }}>Active jobs:</strong>
        {open.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>No open jobs — add one in the Jobs tab.</p>
        ) : (
          <>
            {open.map((j) => (
              <label key={j.id} style={{ display: 'block', fontWeight: 'normal', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={checked.has(j.id)}
                  onChange={() => toggle(j.id)}
                  style={{ marginRight: 6 }}
                />
                {j.code ? `${j.code} — ${j.title}` : j.title}
              </label>
            ))}
            <button
              className="btn btn-default btn-sm"
              style={{ marginTop: 6 }}
              onClick={() => onSet(open.filter((j) => checked.has(j.id)).map((j) => j.id))}
            >
              Set active
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="ct-job-control form-inline" style={{ marginBottom: 10 }}>
      <strong style={{ marginRight: 8 }}>Current job:</strong>
      <input
        type="text"
        className="form-control input-sm"
        placeholder="Job id (e.g. PROJ-123)"
        value={jobId}
        onChange={(e) => setJobId(e.target.value)}
        style={{ marginRight: 6 }}
      />
      <input
        type="text"
        className="form-control input-sm"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ marginRight: 6 }}
      />
      <button className="btn btn-default btn-sm" disabled={!jobId.trim()} onClick={() => onSet([jobId.trim()], title.trim())}>
        Set job
      </button>
    </div>
  );
};

export default JobControl;
