/**
 * AuditView — the Auditor tab. A reviewer's-eye view of the open project's
 * design-control evidence: a coverage summary, the PRD → requirement → test
 * traceability matrix (with verification results and unverified-requirement
 * flags), and a gap list from the shared governance check plus the proposed-PRD
 * roadmap. Read-only and computed live; it asserts nothing the documents don't.
 */
import React, { useMemo } from 'react';
import type { PrdDoc, SrsDoc, VtpDoc } from '../shared';
import { buildAuditReport } from '../auditReport';
import type { TestRollup } from '../auditReport';

interface AuditViewProps {
  prd: PrdDoc | null;
  srs: SrsDoc | null;
  vtp: VtpDoc | null;
}

const ROLLUP_LABEL: Record<TestRollup, string> = {
  passed: '✓ passed',
  failed: '✗ failed',
  not_tested: '• not tested',
  no_test: '⚠ no test',
};
const ROLLUP_CLASS: Record<TestRollup, string> = {
  passed: 'text-success',
  failed: 'text-danger',
  not_tested: 'text-muted',
  no_test: 'text-danger',
};

const Stat: React.FC<{ label: string; value: React.ReactNode; muted?: boolean }> = ({ label, value, muted }) => (
  <div style={{ display: 'inline-block', minWidth: 150, marginRight: 18, marginBottom: 10 }}>
    <div style={{ fontSize: '1.6em', fontWeight: 600 }} className={muted ? 'text-muted' : undefined}>{value}</div>
    <div className="text-muted" style={{ fontSize: '0.85em' }}>{label}</div>
  </div>
);

const AuditView: React.FC<AuditViewProps> = ({ prd, srs, vtp }) => {
  const report = useMemo(() => buildAuditReport({ prd, srs, vtp }), [prd, srs, vtp]);

  if (!srs) {
    return <div className="alert alert-info">Open a project with a requirements document to see the auditor view.</div>;
  }

  const { coverage: c, trace, roadmap, violations } = report;
  const reqPct = c.requirements.total ? Math.round((c.requirements.verified / c.requirements.total) * 100) : 0;

  return (
    <div className="audit-view">
      <h3 style={{ marginTop: 0 }}>Auditor view</h3>
      <p className="text-muted" style={{ marginTop: -6 }}>
        Design-control evidence for this project, computed live from its documents. SpecPad produces
        evidence that <em>supports</em> design controls; it is not itself a quality-management system
        and does not constitute a determination of regulatory compliance.
      </p>

      <section style={{ marginBottom: 18 }}>
        <h4 style={{ borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Coverage</h4>
        <Stat label="requirements verified" value={`${c.requirements.verified}/${c.requirements.total}`} />
        <Stat label="verification coverage" value={`${reqPct}%`} />
        <Stat label="tests passed" value={c.tests.passed} />
        <Stat label="tests failed" value={c.tests.failed} muted={c.tests.failed === 0} />
        <Stat label="tests not tested" value={c.tests.notTested} muted={c.tests.notTested === 0} />
        {report.hasPrd && (
          <>
            <Stat label="implemented PRDs satisfied" value={`${c.productRequirements.implementedSatisfied}/${c.productRequirements.implemented}`} />
            <Stat label="roadmap (proposed) PRDs" value={c.productRequirements.proposed} muted />
          </>
        )}
      </section>

      <section style={{ marginBottom: 18 }}>
        <h4 style={{ borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Traceability matrix</h4>
        <p className="text-muted" style={{ fontSize: '0.85em', marginTop: -2 }}>
          {report.hasPrd ? 'Product requirement → requirement → verification.' : 'Requirement → verification (no PRD register).'}
          {' '}Source &amp; release attribution per change is in the Jobs and Releases tabs.
        </p>
        <table className="table table-condensed audit-trace">
          <thead>
            <tr>
              {report.hasPrd && <th>Product req</th>}
              <th>Requirement</th>
              <th>Verified by</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {trace.map((row) => (
              <tr key={row.req.id} className={row.rollup === 'no_test' ? 'danger' : undefined}>
                {report.hasPrd && (
                  <td>
                    {row.prds.map((p) => <span key={p.id} className="label label-default" style={{ marginRight: 4 }}>{p.code ?? p.id}</span>)}
                    {row.danglingPrdRefs.map((id) => <span key={id} className="label label-danger" style={{ marginRight: 4 }} title="unresolved PRD reference">{id}?</span>)}
                  </td>
                )}
                <td>
                  {row.req.code && <span className="text-muted" style={{ marginRight: 6 }}>{row.req.code}</span>}
                  {row.req.text}
                </td>
                <td>
                  {row.tests.length === 0
                    ? <span className="text-danger">— none —</span>
                    : row.tests.map((t) => <span key={t.id} className="label label-default" style={{ marginRight: 4 }}>{t.code ?? t.id}</span>)}
                </td>
                <td className={ROLLUP_CLASS[row.rollup]}>{ROLLUP_LABEL[row.rollup]}</td>
              </tr>
            ))}
            {trace.length === 0 && (
              <tr><td colSpan={report.hasPrd ? 4 : 3} className="text-muted">No requirements yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h4 style={{ borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Gaps &amp; findings</h4>
        {violations.length === 0 ? (
          <p className="text-success">✓ Governance-clean — every requirement is verified, every reference resolves, every test declares an expected result.</p>
        ) : (
          <ul className="list-unstyled">
            {violations.map((v, i) => (
              <li key={i} style={{ padding: '2px 0' }}>
                <span className="label label-warning" style={{ marginRight: 6 }}>{v.rule}</span>
                {v.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.hasPrd && roadmap.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <h4 style={{ borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Roadmap (proposed product requirements)</h4>
          <p className="text-muted" style={{ fontSize: '0.85em', marginTop: -2 }}>
            Approved product intent not yet allocated to requirements — exempt from coverage, shown so gaps are explicit.
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
