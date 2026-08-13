/**
 * PlanningView — the Planning tab. What this project follows, how it works, and where the
 * processes it does not hold are kept. Tabbed by standard.
 *
 * The cover states conformity to each standard at a glance, the design controls, the
 * methods the project works by, the processes held in a quality system, and what is
 * deliberately not held here at all. Each remaining tab is one standard, clause by clause.
 *
 * It is called Planning rather than Auditor because that is what it is: the plan-level
 * answer to "what do you follow, how do you work, and where is the rest?" — which is the
 * orientation a reviewer needs first and a new engineer needs most.
 *
 * No clause is ever labelled a gap. Where SpecPad does not hold something the status is
 * `elsewhere` and the row says which system does — a boundary drawn on purpose reads as a
 * decision, not as missing evidence, and a reviewer wants the pointer either way.
 */
import React, { useMemo, useState } from 'react';
import type {
  PrdDoc, SrsDoc, VtpDoc, SddDoc, RiskDoc, SoupDoc, ThreatDoc, ReleasesDoc, JobRecord,
} from '../shared';
import { buildAuditReport } from '../auditReport';
import { buildDesignControls } from '../designControls';
import type { ControlStatus } from '../designControls';
import { buildStandards, CONNECTED_STANDARDS, INTENTIONAL_OMISSIONS, METHODOLOGIES, HELD_ELSEWHERE } from '../standards';
import type { ConformanceStatus } from '../standards';
import type { ViewKey } from './ViewTabs';

interface PlanningViewProps {
  prd: PrdDoc | null;
  srs: SrsDoc | null;
  vtp: VtpDoc | null;
  jobs: JobRecord[];
  releases: ReleasesDoc | null;
  sdd?: SddDoc | null;
  risk?: RiskDoc | null;
  soup?: SoupDoc | null;
  threat?: ThreatDoc | null;
  hasArchitecture: boolean;
  hasSecurityArchitecture?: boolean;
  onNavigate: (key: ViewKey) => void;
}

const STATUS_LABEL: Record<ConformanceStatus, string> = {
  met: 'met',
  partial: 'partial',
  elsewhere: 'held elsewhere',
  'not-applicable': 'n/a',
};
const CONTROL_LABEL: Record<ControlStatus, string> = {
  present: 'present',
  partial: 'partial',
  elsewhere: 'held elsewhere',
};

const PlanningView: React.FC<PlanningViewProps> = ({
  prd, srs, vtp, sdd, risk, soup, threat, jobs, releases,
  hasArchitecture, hasSecurityArchitecture, onNavigate,
}) => {
  const [tab, setTab] = useState('overview');

  const controls = useMemo(
    () => buildDesignControls({ prd, srs, vtp, sdd, risk, jobs, releases, hasArchitecture }),
    [prd, srs, vtp, sdd, risk, jobs, releases, hasArchitecture],
  );
  const standards = useMemo(
    () => buildStandards({ prd, srs, vtp, sdd, risk, soup, threat, releases, jobs, hasArchitecture, hasSecurityArchitecture }),
    [prd, srs, vtp, sdd, risk, soup, threat, releases, jobs, hasArchitecture, hasSecurityArchitecture],
  );
  const roadmap = useMemo(() => buildAuditReport({ prd, srs, vtp }).roadmap, [prd, srs, vtp]);

  if (!srs) {
    return <div className="alert alert-info">Open a project with a requirements document to see the planning view.</div>;
  }

  const tabs = [
    { id: 'overview', label: 'Conformity' },
    ...standards.map((s) => ({ id: s.id, label: s.label })),
    { id: 'connected', label: 'Connected standards' },
  ];
  const current = standards.find((s) => s.id === tab);

  /** A one-line count of where a standard's clauses stand, for the cover. */
  const tally = (id: string) => {
    const s = standards.find((x) => x.id === id)!;
    const n = (st: ConformanceStatus) => s.clauses.filter((c) => c.status === st).length;
    return { met: n('met'), partial: n('partial'), elsewhere: n('elsewhere'), total: s.clauses.length };
  };

  return (
    <div className="audit-view">
      <h3 style={{ marginTop: 0 }}>Planning</h3>
      <p className="text-muted" style={{ marginTop: -6 }}>
        What this project follows, how it works, and where the processes it does not hold are kept.
        SpecPad produces evidence that <em>supports</em> design controls; it is not itself a
        quality-management system and does not constitute a determination of regulatory compliance.
      </p>

      <ul className="nav nav-tabs" style={{ marginBottom: 14 }}>
        {tabs.map((t) => (
          <li key={t.id} className={tab === t.id ? 'active' : undefined}>
            <a href="#" onClick={(e) => { e.preventDefault(); setTab(t.id); }}>{t.label}</a>
          </li>
        ))}
      </ul>

      {tab === 'overview' && (
        <>
          <section style={{ marginBottom: 20 }}>
            <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Conformity at a glance</h4>
            <table className="table table-condensed dc-table">
              <tbody>
                {standards.map((s) => {
                  const t = tally(s.id);
                  return (
                    <tr key={s.id}>
                      <td style={{ width: '26%' }}>
                        <div className="dc-name">{s.label}</div>
                        <div className="dc-cite">{s.cite}</div>
                      </td>
                      <td>
                        {s.scope}
                        <div className="text-muted" style={{ fontSize: '0.85em', marginTop: 2 }}>
                          {t.met} met · {t.partial} partial · {t.elsewhere} held elsewhere, of {t.total} clauses
                        </div>
                      </td>
                      <td style={{ width: 90, textAlign: 'right' }}>
                        <button className="btn btn-link btn-xs" onClick={() => setTab(s.id)}>Open →</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section style={{ marginBottom: 20 }}>
            <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Design controls</h4>
            <p className="text-muted" style={{ fontSize: '0.85em', marginTop: -2 }}>
              The formal elements of ISO 13485 §7.3, which the FDA's Quality Management System
              Regulation has incorporated by reference into 21 CFR Part 820 since 2 February 2026.
            </p>
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
                    <td style={{ width: 110, textAlign: 'center' }}>
                      <span className={`dc-status ${el.status}`}>{CONTROL_LABEL[el.status]}</span>
                    </td>
                    <td style={{ width: 90, textAlign: 'right' }}>
                      {el.link && <button className="btn btn-link btn-xs" onClick={() => onNavigate(el.link!)}>View →</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted" style={{ fontSize: '0.85em' }}>
              Per-requirement coverage is on the{' '}
              <button className="btn btn-link btn-xs" style={{ padding: 0 }} onClick={() => onNavigate('trace')}>Traceability</button>{' '}
              tab.
            </p>
          </section>

          <section style={{ marginBottom: 20 }}>
            <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Methodologies applied</h4>
            <p className="text-muted" style={{ fontSize: '0.85em', marginTop: -2 }}>
              Not standards this project conforms to — techniques it has chosen. A reviewer reads these
              to know what kind of evidence to expect; an engineer joining reads them to know how to work.
            </p>
            <table className="table table-condensed dc-table">
              <tbody>
                {METHODOLOGIES.map((m) => (
                  <tr key={m.area}>
                    <td style={{ width: '18%' }}><div className="dc-name">{m.area}</div></td>
                    <td>
                      {m.method}
                      <div className="text-muted" style={{ fontSize: '0.85em', marginTop: 2 }}>{m.why}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ marginBottom: 20 }}>
            <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Processes held elsewhere</h4>
            <p className="text-muted" style={{ fontSize: '0.85em', marginTop: -2 }}>
              Required of the project, and kept in the quality system or the issue tracker rather than
              here. Named by the kind of system that holds each: which document, and its number, is the
              quality system's business and changes on its own schedule.
            </p>
            <table className="table table-condensed dc-table">
              <tbody>
                {HELD_ELSEWHERE.map((h) => (
                  <tr key={h.process}>
                    <td style={{ width: '22%' }}>
                      <div className="dc-name">{h.process}</div>
                      <div className="dc-cite">{h.cite}</div>
                    </td>
                    <td>{h.where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ marginBottom: 20 }}>
            <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Deliberately not held here</h4>
            <p className="text-muted" style={{ fontSize: '0.85em', marginTop: -2 }}>
              Boundaries drawn on purpose. Each is a decision with a reason, not an omission to be found.
            </p>
            <dl className="audit-omissions">
              {INTENTIONAL_OMISSIONS.map((o) => (
                <React.Fragment key={o.title}>
                  <dt>{o.title}</dt>
                  <dd className="text-muted">{o.reason}</dd>
                </React.Fragment>
              ))}
            </dl>
          </section>

          {roadmap.length > 0 && (
            <section>
              <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Roadmap (proposed product requirements)</h4>
              <p className="text-muted" style={{ fontSize: '0.85em', marginTop: -2 }}>
                Approved product intent not yet allocated to requirements — shown so it is explicit.
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
        </>
      )}

      {current && (
        <section>
          <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>{current.cite}</h4>
          <p className="text-muted" style={{ fontSize: '0.9em' }}>{current.scope}</p>
          <table className="table table-condensed dc-table">
            <tbody>
              {current.clauses.map((c) => (
                <tr key={c.clause}>
                  <td style={{ width: '22%' }}>
                    <div className="dc-name">{c.title}</div>
                    <div className="dc-cite">{c.clause}</div>
                  </td>
                  <td>{c.detail}</td>
                  <td style={{ width: 110, textAlign: 'center' }}>
                    <span className={`dc-status ${c.status}`}>{STATUS_LABEL[c.status]}</span>
                  </td>
                  <td style={{ width: 90, textAlign: 'right' }}>
                    {c.link && <button className="btn btn-link btn-xs" onClick={() => onNavigate(c.link!)}>View →</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'connected' && (
        <section>
          <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>Standards around this one</h4>
          <p className="text-muted" style={{ fontSize: '0.9em' }}>
            SpecPad does not implement these. They govern the project SpecPad's records belong to, and a
            reviewer needs to know which side of each boundary a given record sits on.
          </p>
          <dl className="audit-omissions">
            {CONNECTED_STANDARDS.map((s) => (
              <React.Fragment key={s.cite}>
                <dt>{s.cite}</dt>
                <dd>
                  <div>{s.role}</div>
                  <div className="text-muted" style={{ marginTop: 2 }}>{s.relationship}</div>
                </dd>
              </React.Fragment>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
};

export default PlanningView;
