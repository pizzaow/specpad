/**
 * JobControl — set the active-job marker (<name>.job.json), folded into commit
 * trailers by the skill. Two modes:
 *  - register-aware: when the project has a jobs register, pick an OPEN record
 *    (the marker stores its stable id); closed records are excluded.
 *  - free-text: with no register, enter a tracker key + optional title (the
 *    original behavior, kept for the no-register / external-tracker case).
 */
import React, { useState } from 'react';
import type { JobDoc, JobRecord } from '../shared';

interface JobControlProps {
  job: JobDoc | null;
  onSet: (job: string, title: string) => void;
  jobs?: JobRecord[];
}

const JobControl: React.FC<JobControlProps> = ({ job, onSet, jobs }) => {
  const open = (jobs ?? []).filter((j) => j.status === 'open');
  const [jobId, setJobId] = useState(job?.job ?? '');
  const [title, setTitle] = useState(job?.title ?? '');
  const [picked, setPicked] = useState(job?.job ?? '');

  if (jobs && jobs.length > 0) {
    const current = open.some((j) => j.id === picked) ? picked : open[0]?.id ?? '';
    const record = open.find((j) => j.id === current);
    return (
      <div className="ct-job-control form-inline" style={{ marginBottom: 10 }}>
        <strong style={{ marginRight: 8 }}>Active job:</strong>
        <select
          className="form-control input-sm"
          value={current}
          onChange={(e) => setPicked(e.target.value)}
          style={{ marginRight: 6 }}
          aria-label="Active job"
        >
          {open.map((j) => (
            <option key={j.id} value={j.id}>{j.code ? `${j.code} — ${j.title}` : j.title}</option>
          ))}
        </select>
        <button
          className="btn btn-default btn-sm"
          disabled={!record}
          onClick={() => record && onSet(record.id, record.title)}
        >
          Set active
        </button>
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
      <button className="btn btn-default btn-sm" disabled={!jobId.trim()} onClick={() => onSet(jobId.trim(), title.trim())}>
        Set job
      </button>
    </div>
  );
};

export default JobControl;
