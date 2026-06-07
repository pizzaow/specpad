/**
 * JobControl — view/set the current-job marker (<name>.job.json). The job is folded
 * into commit trailers by the skill, linking spec edits to a dev unit.
 */
import React, { useState } from 'react';
import type { JobDoc } from '../shared';

interface JobControlProps {
  job: JobDoc | null;
  onSet: (job: string, title: string) => void;
}

const JobControl: React.FC<JobControlProps> = ({ job, onSet }) => {
  const [jobId, setJobId] = useState(job?.job ?? '');
  const [title, setTitle] = useState(job?.title ?? '');
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
