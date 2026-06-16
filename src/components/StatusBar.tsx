/**
 * StatusBar — the editor footer. Left: the document path. Right: a live
 * validation summary (clean = green; problems = red, click to expand details).
 * Runs the same shared validate/checkGovernance the skill uses, so they agree.
 */
import React, { useMemo, useState } from 'react';
import type { ProjectDoc, SrsDoc, VtpDoc, JobsDoc, JobDoc } from '../shared';
import { validate, checkGovernance } from '../shared';

interface StatusBarProps {
  path: string;
  srsDoc: SrsDoc | null;
  vtpDoc: VtpDoc | null;
  projectDoc: ProjectDoc | null;
  jobsDoc?: JobsDoc | null;
  job?: JobDoc | null;
  demo?: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({ path, srsDoc, vtpDoc, projectDoc, jobsDoc, job, demo }) => {
  const [open, setOpen] = useState(false);

  const structural = useMemo(
    () => [projectDoc, srsDoc, vtpDoc, jobsDoc].filter(Boolean).flatMap((d) => validate(d).map((e) => e.message)),
    [projectDoc, srsDoc, vtpDoc, jobsDoc],
  );
  const governance = useMemo(
    () => checkGovernance({ project: projectDoc, srs: srsDoc, vtp: vtpDoc, jobs: jobsDoc, job }).map((v) => v.message),
    [projectDoc, srsDoc, vtpDoc, jobsDoc, job],
  );

  const errors = structural.length;
  const warnings = governance.length;
  const clean = errors === 0 && warnings === 0;

  return (
    <div className="status-bar">
      <span className="status-path">{path}</span>
      {demo && <span className="status-demo">Demo — read-only</span>}
      <span className="status-spacer" />
      {clean ? (
        <span className="status-ok">✓ No problems found</span>
      ) : (
        <span className="status-problems" role="button" tabIndex={0} onClick={() => setOpen((o) => !o)}>
          ⚠ {errors} error{errors === 1 ? '' : 's'} · {warnings} warning{warnings === 1 ? '' : 's'} {open ? '▾' : '▴'}
        </span>
      )}
      {open && !clean && (
        <div className="status-details">
          {structural.map((m, i) => <div key={`e${i}`} className="status-error">• {m}</div>)}
          {governance.map((m, i) => <div key={`w${i}`} className="status-warning">• {m}</div>)}
        </div>
      )}
    </div>
  );
};

export default StatusBar;
