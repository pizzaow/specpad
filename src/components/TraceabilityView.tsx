/**
 * TraceabilityView — the Traceability tab. The per-requirement matrix
 * (PRD → requirement → verification) with a result roll-up and unverified-row
 * flags, a coverage summary, and the governance gap list. Read-only; computed
 * live via the shared buildAuditReport (so it agrees with the skill).
 */
import React, { useMemo } from 'react';
import type { PrdDoc, SrsDoc, VtpDoc, RunRecord } from '../shared';
import { buildAuditReport } from '../auditReport';
import type { TestRollup } from '../auditReport';

interface TraceabilityViewProps {
  prd: PrdDoc | null;
  srs: SrsDoc | null;
  vtp: VtpDoc | null;
  run?: RunRecord | null;
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

const Stat: React.FC<{ label: string; value: React.ReactNode; muted?: boolean; accent?: boolean }> = ({ label, value, muted, accent }) => (
  <div className={`metric-card${accent ? ' is-accent' : ''}`} style={{ flex: '1 1 140px' }}>
    <div className={`metric-value${muted ? ' text-muted' : ''}`} style={{ fontSize: '1.7em' }}>{value}</div>
    <div className="metric-label">{label}</div>
  </div>
);

const TraceabilityView: React.FC<TraceabilityViewProps> = ({ prd, srs, vtp, run }) => {
  const report = useMemo(() => buildAuditReport({ prd, srs, vtp }, run ?? null), [prd, srs, vtp, run]);

  if (!srs) {
    return <div className="alert alert-info">Open a project with a requirements document to see traceability.</div>;
  }

  const { coverage: c, trace, violations } = report;
  const reqPct = c.requirements.total ? Math.round((c.requirements.verified / c.requirements.total) * 100) : 0;

  return (
    <div className="audit-view">
      <h3 style={{ marginTop: 0 }}>Traceability</h3>
      <p className="text-muted" style={{ marginTop: -6 }}>
        {report.hasPrd ? 'Product requirement → requirement → verification.' : 'Requirement → verification (no PRD register).'}
        {' '}Source &amp; release attribution per change is in the Jobs and Releases tabs.
      </p>

      <section style={{ marginBottom: 18 }}>
        <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Coverage</h4>
        <div className="overview-metrics">
          <Stat accent label="requirements verified" value={`${c.requirements.verified}/${c.requirements.total}`} />
          <Stat label="verification coverage" value={`${reqPct}%`} />
          <Stat label="tests passed" value={c.tests.passed} />
          <Stat label="tests failed" value={c.tests.failed} muted={c.tests.failed === 0} />
          <Stat label="tests not tested" value={c.tests.notTested} muted={c.tests.notTested === 0} />
          {report.hasPrd && (
            <Stat label="implemented PRDs satisfied" value={`${c.productRequirements.implementedSatisfied}/${c.productRequirements.implemented}`} />
          )}
        </div>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Matrix</h4>
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
        <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Gaps &amp; findings</h4>
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
    </div>
  );
};

export default TraceabilityView;
