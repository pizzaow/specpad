/**
 * TraceabilityView — the Traceability tab: the whole chain the registers now describe,
 * one row per requirement.
 *
 *   need → requirement → design → verification, with the risks and threats that made the
 *   requirement necessary resolved backwards onto it.
 *
 * Columns appear only for registers the project actually has, so a project with no design
 * or no threat model sees the matrix it earned rather than a wall of dashes.
 *
 * Coverage is reported in two parts on purpose. Breadth — is every requirement verified —
 * was always here. Depth — does it reach a design, does it say which §5.2.2 category it is,
 * were all three verification activities performed — is new, and is where a register that
 * looks complete usually turns out not to be.
 */
import React, { useMemo } from 'react';
import type { PrdDoc, SrsDoc, VtpDoc, SddDoc, RiskDoc, ThreatDoc, RunRecord } from '../shared';
import { buildAuditReport } from '../auditReport';
import type { TestRollup } from '../auditReport';

interface TraceabilityViewProps {
  prd: PrdDoc | null;
  srs: SrsDoc | null;
  vtp: VtpDoc | null;
  sdd?: SddDoc | null;
  risk?: RiskDoc | null;
  threat?: ThreatDoc | null;
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

const TraceabilityView: React.FC<TraceabilityViewProps> = ({ prd, srs, vtp, sdd, risk, threat, run }) => {
  const report = useMemo(
    () => buildAuditReport({ prd, srs, vtp, sdd, risk, threat }, run ?? null),
    [prd, srs, vtp, sdd, risk, threat, run],
  );

  if (!srs) {
    return <div className="alert alert-info">Open a project with a requirements document to see traceability.</div>;
  }

  const { coverage: c, trace, violations, has, depth } = report;
  const reqPct = c.requirements.total ? Math.round((c.requirements.verified / c.requirements.total) * 100) : 0;
  const total = c.requirements.total;
  const cols = 3 + (has.prd ? 1 : 0) + (has.sdd ? 1 : 0) + (has.risk || has.threat ? 1 : 0);

  return (
    <div className="audit-view">
      <h3 style={{ marginTop: 0 }}>Traceability</h3>
      <p className="text-muted" style={{ marginTop: -6 }}>
        {[has.prd && 'need', 'requirement', has.sdd && 'design', 'verification'].filter(Boolean).join(' → ')}
        {(has.risk || has.threat) && ', with the risks and threats each requirement controls'}.
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
        <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Depth of the record</h4>
        <p className="text-muted" style={{ fontSize: '0.85em', marginTop: -2 }}>
          Breadth above says every requirement is verified. These say how much is behind each one —
          the questions a reviewer asks after the coverage percentage.
        </p>
        <div className="overview-metrics">
          {has.sdd && <Stat label="reach a design section" value={`${depth.designed}/${total}`} muted={depth.designed === total} />}
          <Stat label="declare a §5.2.2 category" value={`${depth.categorised}/${total}`} muted={depth.categorised === total} />
          {(has.risk || has.threat) && <Stat label="control a risk or threat" value={depth.controlling} />}
          <Stat label="unit tests" value={depth.levels.unit} />
          <Stat label="integration tests" value={depth.levels.integration} muted={depth.levels.integration === 0} />
          <Stat label="system tests" value={depth.levels.system} />
          {depth.unlevelled > 0 && <Stat label="tests with no level" value={depth.unlevelled} />}
        </div>
        {depth.levels.integration === 0 && depth.levels.unit + depth.levels.system > 0 && (
          <p className="text-muted" style={{ fontSize: '0.85em' }}>
            No test is recorded as integration testing. IEC 62304 §5.6 treats it as its own activity —
            worth confirming that is true rather than unrecorded.
          </p>
        )}
      </section>

      <section style={{ marginBottom: 18 }}>
        <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Matrix</h4>
        <table className="table table-condensed audit-trace">
          <thead>
            <tr>
              {has.prd && <th>Need</th>}
              <th>Requirement</th>
              {has.sdd && <th>Design</th>}
              {(has.risk || has.threat) && <th>Controls</th>}
              <th>Verified by</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {trace.map((row) => (
              <tr key={row.req.id} className={row.rollup === 'no_test' ? 'danger' : undefined}>
                {has.prd && (
                  <td>
                    {row.prds.map((p) => <span key={p.id} className="label label-default" style={{ marginRight: 4 }}>{p.code ?? p.id}</span>)}
                    {row.danglingPrdRefs.map((id) => <span key={id} className="label label-danger" style={{ marginRight: 4 }} title="unresolved PRD reference">{id}?</span>)}
                  </td>
                )}
                <td>
                  {row.req.code && <span className="text-muted" style={{ marginRight: 6 }}>{row.req.code}</span>}
                  {row.req.text}
                  {(row.req.category ?? []).length > 0 && (
                    <div className="text-muted" style={{ fontSize: '0.8em', marginTop: 2 }}>
                      {(row.req.category ?? []).join(' · ')}
                    </div>
                  )}
                </td>
                {has.sdd && (
                  <td>
                    {row.designs.length === 0
                      ? <span className="text-muted">—</span>
                      : row.designs.map((d) => <span key={d.id} className="label label-default" style={{ marginRight: 4 }}>{d.code ?? d.title}</span>)}
                    {row.danglingDesignRefs.map((id) => <span key={id} className="label label-danger" style={{ marginRight: 4 }} title="unresolved design reference">{id}?</span>)}
                  </td>
                )}
                {(has.risk || has.threat) && (
                  <td>
                    {row.risks.length === 0 && row.threats.length === 0 && <span className="text-muted">—</span>}
                    {row.risks.map((k) => <span key={k.id} className="label label-warning" style={{ marginRight: 4 }} title={k.text}>{k.code ?? k.id}</span>)}
                    {row.threats.map((x) => <span key={x.id} className="label label-warning" style={{ marginRight: 4 }} title={x.text}>{x.code ?? x.id}</span>)}
                  </td>
                )}
                <td>
                  {row.tests.length === 0
                    ? <span className="text-danger">— none —</span>
                    : row.tests.map((t) => <span key={t.id} className="label label-default" style={{ marginRight: 4 }}>{t.code ?? t.id}</span>)}
                </td>
                <td className={ROLLUP_CLASS[row.rollup]}>{ROLLUP_LABEL[row.rollup]}</td>
              </tr>
            ))}
            {trace.length === 0 && (
              <tr><td colSpan={cols} className="text-muted">No requirements yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Gaps &amp; findings</h4>
        {violations.length === 0 ? (
          <p className="text-success">✓ Governance-clean across every register the project holds — every requirement verified and reaching a design, every reference resolving, every risk and threat controlled or justified.</p>
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
