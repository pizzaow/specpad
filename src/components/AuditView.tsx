/**
 * AuditView — the Auditor tab. An orientation index for a reviewer: a scope
 * statement, the design-control map (each formal element → citation, status, and
 * a link to the tab that holds the evidence), and the roadmap. It points to the
 * Traceability tab rather than containing the matrix. Computed live.
 */
import React, { useMemo } from 'react';
import type { PrdDoc, SrsDoc, VtpDoc, ReleasesDoc, JobRecord } from '../shared';
import { buildAuditReport } from '../auditReport';
import { buildDesignControls } from '../designControls';
import type { ControlStatus } from '../designControls';
import type { ViewKey } from './ViewTabs';

interface AuditViewProps {
  prd: PrdDoc | null;
  srs: SrsDoc | null;
  vtp: VtpDoc | null;
  jobs: JobRecord[];
  releases: ReleasesDoc | null;
  hasArchitecture: boolean;
  onNavigate: (key: ViewKey) => void;
}

const STATUS_LABEL: Record<ControlStatus, string> = { present: 'present', partial: 'partial', gap: 'gap' };

const AuditView: React.FC<AuditViewProps> = ({ prd, srs, vtp, jobs, releases, hasArchitecture, onNavigate }) => {
  const controls = useMemo(
    () => buildDesignControls({ prd, srs, vtp, jobs, releases, hasArchitecture }),
    [prd, srs, vtp, jobs, releases, hasArchitecture],
  );
  const roadmap = useMemo(() => buildAuditReport({ prd, srs, vtp }).roadmap, [prd, srs, vtp]);

  if (!srs) {
    return <div className="alert alert-info">Open a project with a requirements document to see the auditor view.</div>;
  }

  return (
    <div className="audit-view">
      <h3 style={{ marginTop: 0 }}>Auditor view</h3>
      <p className="text-muted" style={{ marginTop: -6 }}>
        How this project's evidence maps to design controls (IEC 62304 / FDA 21 CFR 820.30), and where each
        part lives. SpecPad produces evidence that <em>supports</em> design controls; it is not itself a
        quality-management system and does not constitute a determination of regulatory compliance.
      </p>

      <section style={{ marginBottom: 18 }}>
        <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Design controls</h4>
        <table className="table table-condensed dc-table">
          <tbody>
            {controls.map((el) => (
              <tr key={el.key}>
                <td style={{ width: '26%' }}>
                  <div className="dc-name">{el.name}</div>
                  <div className="dc-cite">{el.cite}</div>
                </td>
                <td>
                  {el.statement}
                  <div className="text-muted" style={{ fontSize: '0.85em', marginTop: 2 }}>{el.detail}</div>
                </td>
                <td style={{ width: 90, textAlign: 'center' }}>
                  <span className={`dc-status ${el.status}`}>{STATUS_LABEL[el.status]}</span>
                </td>
                <td style={{ width: 90, textAlign: 'right' }}>
                  {el.link && (
                    <button className="btn btn-link btn-xs" onClick={() => onNavigate(el.link!)}>View →</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-muted" style={{ fontSize: '0.85em' }}>
          Per-requirement coverage and the gap list are on the{' '}
          <button className="btn btn-link btn-xs" style={{ padding: 0 }} onClick={() => onNavigate('trace')}>Traceability</button>{' '}
          tab.
        </p>
      </section>

      {roadmap.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Roadmap (proposed product requirements)</h4>
          <p className="text-muted" style={{ fontSize: '0.85em', marginTop: -2 }}>
            Approved product intent not yet allocated to requirements — shown so gaps are explicit.
          </p>
          <ul className="list-unstyled">
            {roadmap.map((p) => (
              <li key={p.id} style={{ padding: '2px 0' }}>
                {p.code && <span className="text-muted" style={{ marginRight: 6 }}>{p.code}</span>}
                {p.text}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default AuditView;
