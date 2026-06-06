/**
 * ValidationPanel — live structural + governance feedback.
 * Runs the SAME shared module the skill's rules mirror, so UI and skill agree.
 */
import React, { useMemo } from 'react';
import type { ProjectDoc, SrsDoc, VtpDoc } from '../shared';
import { validate, checkGovernance } from '../shared';

interface ValidationPanelProps {
  srsDoc: SrsDoc | null;
  vtpDoc: VtpDoc | null;
  projectDoc: ProjectDoc | null;
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({ srsDoc, vtpDoc, projectDoc }) => {
  const structural = useMemo(() => {
    const docs = [projectDoc, srsDoc, vtpDoc].filter(Boolean);
    return docs.flatMap((d) => validate(d).map((e) => e.message));
  }, [projectDoc, srsDoc, vtpDoc]);

  const governance = useMemo(
    () => checkGovernance({ project: projectDoc, srs: srsDoc, vtp: vtpDoc }),
    [projectDoc, srsDoc, vtpDoc]
  );

  if (structural.length === 0 && governance.length === 0) {
    return <div className="alert alert-success" style={{ marginTop: 10 }}>✓ No problems found.</div>;
  }

  return (
    <div style={{ marginTop: 10 }}>
      {structural.length > 0 && (
        <div className="alert alert-danger">
          <strong>Structural errors</strong>
          <ul>{structural.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}
      {governance.length > 0 && (
        <div className="alert alert-warning">
          <strong>Governance warnings</strong>
          <ul>{governance.map((v, i) => <li key={i}>{v.message}</li>)}</ul>
        </div>
      )}
    </div>
  );
};

export default ValidationPanel;
