/**
 * StatusBar — the editor footer. Left: the document path. Right: a live
 * validation summary (clean = green; problems = red, click to expand details).
 * Runs the same shared validate/checkGovernance the skill uses, so they agree.
 *
 * Advice is counted and shown apart from problems. It is deliberately not folded into the
 * warning count: an advisory does not fail the project, and a footer that says "312
 * warnings" on a clean register is one nobody reads.
 */
import React, { useMemo, useState } from 'react';
import type { ProjectDoc, SrsDoc, VtpDoc, PrdDoc, SddDoc, RiskDoc, SoupDoc, ThreatDoc, JobsDoc, JobDoc } from '../shared';
import { validate, checkGovernance, checkAdvice } from '../shared';

interface StatusBarProps {
  path: string;
  srsDoc: SrsDoc | null;
  vtpDoc: VtpDoc | null;
  projectDoc: ProjectDoc | null;
  prdDoc?: PrdDoc | null;
  sddDoc?: SddDoc | null;
  riskDoc?: RiskDoc | null;
  soupDoc?: SoupDoc | null;
  threatDoc?: ThreatDoc | null;
  jobsDoc?: JobsDoc | null;
  job?: JobDoc | null;
  demo?: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({ path, srsDoc, vtpDoc, projectDoc, prdDoc, sddDoc, riskDoc, soupDoc, threatDoc, jobsDoc, job, demo }) => {
  const [open, setOpen] = useState(false);

  const structural = useMemo(
    () => [projectDoc, srsDoc, vtpDoc, prdDoc, sddDoc, riskDoc, soupDoc, threatDoc, jobsDoc].filter(Boolean).flatMap((d) => validate(d).map((e) => e.message)),
    [projectDoc, srsDoc, vtpDoc, prdDoc, sddDoc, riskDoc, soupDoc, threatDoc, jobsDoc],
  );
  const governance = useMemo(
    () => checkGovernance({ project: projectDoc, srs: srsDoc, vtp: vtpDoc, prd: prdDoc, sdd: sddDoc, risk: riskDoc, soup: soupDoc, threat: threatDoc, jobs: jobsDoc, job }).map((v) => v.message),
    [projectDoc, srsDoc, vtpDoc, prdDoc, sddDoc, riskDoc, soupDoc, threatDoc, jobsDoc, job],
  );
  const advice = useMemo(
    () => checkAdvice({ project: projectDoc, srs: srsDoc, vtp: vtpDoc, prd: prdDoc, sdd: sddDoc, risk: riskDoc, soup: soupDoc, threat: threatDoc }).map((v) => v.message),
    [projectDoc, srsDoc, vtpDoc, prdDoc, sddDoc, riskDoc, soupDoc, threatDoc],
  );

  const errors = structural.length;
  const warnings = governance.length;
  const clean = errors === 0 && warnings === 0;
  const advised = advice.length;

  return (
    <div className="status-bar">
      <span className="status-path">{path}</span>
      {demo && (
        <span className="status-demo" title="Edits live in this browser only and are lost on reload; Save downloads the file.">
          Demo — sandbox, nothing is saved
        </span>
      )}
      <span className="status-spacer" />
      {clean ? (
        <span className="status-ok">✓ No problems found</span>
      ) : null}
      {advised > 0 && (
        <span
          className="status-advice"
          role="button"
          tabIndex={0}
          title="Advice does not fail the project. Adopt a rule by naming it in the project index's enforce list."
          onClick={() => setOpen((o) => !o)}
        >
          {advised} suggestion{advised === 1 ? '' : 's'}
        </span>
      )}
      {!clean && (
        <span className="status-problems" role="button" tabIndex={0} onClick={() => setOpen((o) => !o)}>
          ⚠ {errors} error{errors === 1 ? '' : 's'} · {warnings} warning{warnings === 1 ? '' : 's'} {open ? '▾' : '▴'}
        </span>
      )}
      {open && (errors + warnings + advised > 0) && (
        <div className="status-details">
          {structural.map((m, i) => <div key={`e${i}`} className="status-error">• {m}</div>)}
          {governance.map((m, i) => <div key={`w${i}`} className="status-warning">• {m}</div>)}
          {advice.map((m, i) => <div key={`a${i}`} className="status-advice-item">• {m}</div>)}
        </div>
      )}
    </div>
  );
};

export default StatusBar;
