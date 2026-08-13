/**
 * SecurityControlsView — the Controls tab: the requirements that defend the product,
 * grouped by the FDA security control categories (Cybersecurity in Medical Devices,
 * February 2026, §V.B.1 and Appendix 1).
 *
 * The grouping is the argument. "We have security requirements" is not a coverage claim;
 * "here is what we have under authentication, authorization, cryptography, integrity,
 * confidentiality, event detection, resiliency and updatability" is. So a category with
 * nothing under it is shown rather than hidden — it is a question to answer once, in the
 * same way an empty §5.2.2 category is.
 *
 * Every control also shows the threats it answers and whether it is verified, because FDA
 * asks for requirements *and* acceptance criteria per category, and a control nobody tests
 * is a claim.
 */
import React, { useMemo } from 'react';
import type { SrsDoc, SrsItem, ThreatDoc, VtpDoc, RunRecord } from '../shared';
import { SECURITY_CONTROLS } from '../shared';
import type { ViewKey } from './ViewTabs';

interface SecurityControlsViewProps {
  srs: SrsDoc | null;
  threat: ThreatDoc | null;
  vtp: VtpDoc | null;
  run?: RunRecord | null;
  onNavigate?: (key: ViewKey) => void;
}

const SecurityControlsView: React.FC<SecurityControlsViewProps> = ({ srs, threat, vtp, onNavigate }) => {
  const model = useMemo(() => {
    const reqs = (srs?.items ?? []).filter((i) => !i.heading);
    const byId = new Map(reqs.map((r) => [r.id, r]));
    const threats = (threat?.items ?? []).filter((t) => !t.heading);
    const tests = (vtp?.items ?? []).filter((t) => !t.heading);

    /** Threats each requirement is named as controlling. */
    const answers = new Map<string, { code: string; text: string }[]>();
    for (const t of threats) {
      for (const id of t.controls ?? []) {
        if (!answers.has(id)) answers.set(id, []);
        answers.get(id)!.push({ code: t.code ?? t.id, text: t.text });
      }
    }
    const verified = (id: string) => tests.some((t) => (t.verifies ?? []).includes(id));

    const groups = SECURITY_CONTROLS.map((c) => ({
      ...c,
      requirements: reqs.filter((r) => (r.securityControl ?? []).includes(c.value)),
    }));

    // A requirement the threat model leans on but which says nothing about which control
    // it is. Surfaced rather than dropped: these are exactly the ones the coverage
    // argument is built from.
    const unclassified = [...answers.keys()]
      .map((id) => byId.get(id))
      .filter((r): r is SrsItem => !!r && (r.securityControl ?? []).length === 0);

    return { groups, answers, verified, unclassified, threatCount: threats.length };
  }, [srs, threat, vtp]);

  if (!srs) {
    return <div className="alert alert-info">Open a project with a requirements document to see the security controls.</div>;
  }

  const covered = model.groups.filter((g) => g.requirements.length > 0).length;

  return (
    <div className="controls-view">
      <h3 style={{ marginTop: 0 }}>Security controls</h3>
      <p className="text-muted" style={{ marginTop: -6 }}>
        The requirements that defend this product, grouped by the categories FDA expects an adequate
        set to draw from (<em>Cybersecurity in Medical Devices</em>, February 2026, §V.B.1). A control is
        a requirement, so each is verified by the ordinary trace rather than by a separate argument.
        <strong> {covered} of {model.groups.length} categories have a control.</strong>
      </p>

      {model.unclassified.length > 0 && (
        <div className="alert alert-warning" style={{ padding: '8px 12px' }}>
          <strong>{model.unclassified.length} requirement(s)</strong> are named as controls by the threat
          model but do not say which control category they implement, so they are missing from the
          coverage below:{' '}
          {model.unclassified.map((r) => r.code ?? r.id).join(', ')}.
        </div>
      )}

      {model.groups.map((g) => (
        <section key={g.value} style={{ marginBottom: 16 }}>
          <h4 style={{ borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 4 }}>
            {g.label}{' '}
            <span className="text-muted" style={{ fontWeight: 'normal', fontSize: '0.8em' }}>
              {g.requirements.length > 0 ? `${g.requirements.length} control${g.requirements.length === 1 ? '' : 's'}` : 'none'}
            </span>
          </h4>
          <p className="text-muted" style={{ fontSize: '0.85em', margin: '2px 0 6px' }}>{g.text}</p>

          {g.requirements.length === 0 ? (
            <p className="text-muted" style={{ fontStyle: 'italic', margin: 0 }}>
              No control in this category. That is a question to answer once — either a control is
              missing, or there is a reason this product needs none.
            </p>
          ) : (
            <table className="table table-condensed">
              <tbody>
                {g.requirements.map((r) => {
                  const answered = model.answers.get(r.id) ?? [];
                  return (
                    <tr key={r.id}>
                      <td style={{ width: 90 }}>
                        <strong>{r.code ?? r.id}</strong>
                      </td>
                      <td>
                        {r.text}
                        {answered.length > 0 && (
                          <div className="text-muted" style={{ fontSize: '0.85em', marginTop: 2 }}>
                            Answers {answered.map((a) => a.code).join(', ')}
                          </div>
                        )}
                      </td>
                      <td style={{ width: 110, textAlign: 'center' }}>
                        <span className={`dc-status ${model.verified(r.id) ? 'present' : 'partial'}`}>
                          {model.verified(r.id) ? 'verified' : 'no test'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {model.threatCount === 0 && (
        <p className="text-muted">
          No threat model is loaded, so no control shows the threat it answers.{' '}
          {onNavigate && (
            <button className="btn btn-link btn-xs" style={{ padding: 0 }} onClick={() => onNavigate('threat')}>
              Open Threats
            </button>
          )}
        </p>
      )}
    </div>
  );
};

export default SecurityControlsView;
