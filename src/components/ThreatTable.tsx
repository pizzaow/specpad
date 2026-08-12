/**
 * ThreatTable — the Threats tab: the threat model and security risk analysis.
 *
 * Exploitability sits where a probability would in a safety table, and the pairing with
 * impact is what a reader scans for: a highly exploitable threat with a serious
 * consequence is the row that matters, whatever the residual column says.
 *
 * The Controlled column derives from the tests of the controlling requirements, exactly
 * as the risk table does — a control is a requirement in both registers, so the evidence
 * it works is the same evidence.
 */
import React, { useMemo, useState } from 'react';
import type {
  Exploitability, RiskDoc, RiskSeverity, ResidualRisk, SddDoc, SoupDoc, SrsDoc,
  ThreatCategory, ThreatDoc, ThreatItem, VtpDoc, RunRecord,
} from '../shared';
import { createThreatItem, verificationOutcome } from '../shared';
import RowMenu from './RowMenu';
import RefPicker from './RefPicker';
import type { RefOption } from './RefPicker';

interface ThreatTableProps {
  doc: ThreatDoc;
  sddDoc?: SddDoc | null;
  soupDoc?: SoupDoc | null;
  srsDoc?: SrsDoc | null;
  vtpDoc?: VtpDoc | null;
  riskDoc?: RiskDoc | null;
  run?: RunRecord | null;
  onChange: (doc: ThreatDoc) => void;
  readOnly?: boolean;
}

const CATEGORIES: ThreatCategory[] = [
  'spoofing', 'tampering', 'repudiation', 'information_disclosure', 'denial_of_service', 'elevation_of_privilege',
];
const EXPLOITABILITY: Exploitability[] = ['low', 'medium', 'high'];
const SEVERITIES: RiskSeverity[] = ['negligible', 'minor', 'serious', 'critical', 'catastrophic'];
const RESIDUALS: ResidualRisk[] = ['not_assessed', 'acceptable', 'unacceptable'];

const label = (v: string) => v.replace(/_/g, ' ');

type ControlState = 'verified' | 'failing' | 'incomplete' | 'unverified' | 'none';
const CONTROL: Record<ControlState, { text: string; className: string; title: string }> = {
  verified: { text: 'verified', className: 'label label-success', title: 'Every controlling requirement is verified by a passing test.' },
  failing: { text: 'failing', className: 'label label-danger', title: 'A test verifying a controlling requirement failed — this threat is not defended.' },
  incomplete: { text: 'not run', className: 'label label-warning', title: 'A test verifying a controlling requirement has not been executed.' },
  unverified: { text: 'no test', className: 'label label-danger', title: 'A controlling requirement has no verifying test.' },
  none: { text: 'no control', className: 'label label-default', title: 'No software control; see the justification.' },
};

const ThreatTable: React.FC<ThreatTableProps> = ({
  doc, sddDoc, soupDoc, srsDoc, vtpDoc, riskDoc, run, onChange, readOnly,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ index: number; field: 'code' | 'text' } | null>(null);
  const [editValue, setEditValue] = useState('');

  const update = (items: ThreatItem[]) => onChange({ ...doc, items });
  const setField = (index: number, patch: Partial<ThreatItem>) => {
    const items = doc.items.slice();
    items[index] = { ...items[index], ...patch };
    update(items);
  };

  // Attack surface is a unit or a component: an attacker does not care whose code it is.
  const surfaceOptions: RefOption[] = useMemo(
    () => [
      ...(sddDoc?.items ?? [])
        .filter((s) => !s.heading && (s.kind ?? 'unit') === 'unit')
        .map((s) => ({ id: s.id, code: s.code, text: s.title })),
      ...(soupDoc?.items ?? [])
        .filter((c) => !c.heading)
        .map((c) => ({ id: c.id, code: c.code, text: c.name })),
    ],
    [sddDoc, soupDoc],
  );
  const controlOptions: RefOption[] = useMemo(
    () => (srsDoc?.items ?? []).filter((i) => !i.heading).map((i) => ({ id: i.id, code: i.code, text: i.text })),
    [srsDoc],
  );
  const riskOptions: RefOption[] = useMemo(
    () => (riskDoc?.items ?? []).filter((r) => !r.heading).map((r) => ({ id: r.id, code: r.code, text: r.text })),
    [riskDoc],
  );

  const srsById = useMemo(() => new Map((srsDoc?.items ?? []).map((i) => [i.id, i])), [srsDoc]);
  const testsByReq = useMemo(() => {
    const map = new Map<string, VtpDoc['items']>();
    for (const test of vtpDoc?.items ?? []) {
      if (test.heading) continue;
      for (const ref of test.verifies ?? []) {
        const list = map.get(ref);
        if (list) list.push(test);
        else map.set(ref, [test]);
      }
    }
    return map;
  }, [vtpDoc]);

  const controlState = (threat: ThreatItem): ControlState => {
    const controls = threat.controls ?? [];
    if (controls.length === 0) return 'none';
    let worst: ControlState = 'verified';
    for (const id of controls) {
      const tests = testsByReq.get(id) ?? [];
      if (tests.length === 0) return 'unverified';
      for (const test of tests) {
        const { status } = verificationOutcome(test, run ?? null);
        if (status === 'failed') return 'failing';
        if (status === 'not_run' || status === 'skipped') worst = 'incomplete';
      }
    }
    return worst;
  };

  const startEdit = (index: number, field: 'code' | 'text') => {
    if (readOnly) return;
    setEditing({ index, field });
    setEditValue(doc.items[index][field] ?? '');
  };
  const commitEdit = () => {
    if (!editing) return;
    setField(editing.index, { [editing.field]: editValue } as Partial<ThreatItem>);
    setEditing(null);
  };
  const renderCell = (index: number, field: 'code' | 'text') => {
    if (editing?.index === index && editing.field === field) {
      const common = {
        className: 'form-control',
        autoFocus: true,
        value: editValue,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditValue(e.target.value),
        onBlur: commitEdit,
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Escape') setEditing(null); },
        'aria-label': field === 'code' ? 'Threat code' : 'Threat',
      };
      return field === 'text' ? <textarea {...common} rows={3} /> : <input type="text" {...common} />;
    }
    return (
      <div
        className="editable-cell"
        style={{ cursor: readOnly ? 'default' : 'pointer', minHeight: 20, whiteSpace: 'pre-wrap' }}
        onClick={() => startEdit(index, field)}
      >
        {doc.items[index][field] || <span style={{ color: '#ccc' }}>(empty)</span>}
      </div>
    );
  };

  const fresh = (level = 0) => createThreatItem(doc.items.map((i) => i.id), level);
  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const select = <T extends string>(
    index: number, key: keyof ThreatItem, name: string, options: T[], value: string | undefined, blank?: string,
  ) => (
    <select
      className="form-control input-sm"
      aria-label={`${name} of ${doc.items[index].code || doc.items[index].id}`}
      value={value ?? ''}
      disabled={readOnly}
      onChange={(e) => setField(index, { [key]: (e.target.value || undefined) as never } as Partial<ThreatItem>)}
    >
      {blank !== undefined && <option value="">{blank}</option>}
      {options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
    </select>
  );

  return (
    <div className="threat-table-container">
      <div style={{ marginBottom: 10 }}>
        <h2>{doc.title || 'Threats'}</h2>
        <strong>Document:</strong> {doc.name}
        <p className="text-muted" style={{ marginTop: 4, marginBottom: 0 }}>
          The threat model and security risk analysis, which are one register. Rated on
          <strong> exploitability</strong> rather than probability: an attacker chooses when to act.
        </p>
      </div>

      <table className="table table-condensed threat-table">
        <thead>
          <tr>
            <th style={{ width: 80 }}>Code</th>
            <th>Threat</th>
            <th style={{ width: 130 }}>Category</th>
            <th style={{ width: 110 }}>Exploitability</th>
            <th style={{ width: 110 }}>Impact</th>
            <th style={{ width: 150 }}>Controls</th>
            <th style={{ width: 90 }}>Controlled</th>
            <th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, index) => {
            const menu = !readOnly && (
              <RowMenu
                noun="threat"
                onAddAbove={() => update([...doc.items.slice(0, index), fresh(item.level), ...doc.items.slice(index)])}
                onAddBelow={() => update([...doc.items.slice(0, index + 1), fresh(item.level), ...doc.items.slice(index + 1)])}
                onAddChild={() => update([...doc.items.slice(0, index + 1), fresh((item.level ?? 0) + 1), ...doc.items.slice(index + 1)])}
                onAddHeading={() => update([...doc.items.slice(0, index + 1), { ...fresh(item.level), heading: true, text: 'New group' }, ...doc.items.slice(index + 1)])}
                onIndent={() => setField(index, { level: (item.level ?? 0) + 1 })}
                onOutdent={() => setField(index, { level: Math.max(0, (item.level ?? 0) - 1) })}
                onDelete={() => window.confirm(`Delete "${item.code || item.text}"?`) && update(doc.items.filter((i) => i.id !== item.id))}
                onViewInfo={() => toggle(item.id)}
                canOutdent={(item.level ?? 0) > 0}
              />
            );

            if (item.heading) {
              return (
                <tr key={item.id} className="threat-heading-row">
                  <td colSpan={7} style={{ fontWeight: 'bold', paddingLeft: 8 + (item.level ?? 0) * 16 }}>
                    {renderCell(index, 'text')}
                  </td>
                  <td>{menu}</td>
                </tr>
              );
            }

            const state = controlState(item);
            const open = expanded.has(item.id);
            const severe = item.exploitability === 'high' && (item.impact === 'critical' || item.impact === 'catastrophic');

            return (
              <React.Fragment key={item.id}>
                <tr className={severe ? 'danger' : undefined}>
                  <td style={{ paddingLeft: 8 + (item.level ?? 0) * 16 }}>{renderCell(index, 'code')}</td>
                  <td>{renderCell(index, 'text')}</td>
                  <td>{select(index, 'category', 'Category', CATEGORIES, item.category, '—')}</td>
                  <td>{select(index, 'exploitability', 'Exploitability', EXPLOITABILITY, item.exploitability, '—')}</td>
                  <td>{select(index, 'impact', 'Impact', SEVERITIES, item.impact, '—')}</td>
                  <td>
                    <RefPicker
                      label={`Requirements controlling ${item.code || item.id}`}
                      value={item.controls ?? []}
                      options={controlOptions}
                      onChange={(ids) => setField(index, { controls: ids })}
                      readOnly={readOnly}
                      empty="None"
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-link btn-xs"
                      aria-label={`Show detail for ${item.code || item.id}`}
                      onClick={() => toggle(item.id)}
                    >
                      <span className={CONTROL[state].className} title={CONTROL[state].title}>{CONTROL[state].text}</span>{' '}
                      {open ? '▾' : '▸'}
                    </button>
                  </td>
                  <td>{menu}</td>
                </tr>

                {open && (
                  <tr className="srs-tests-row">
                    <td />
                    <td colSpan={7}>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span style={{ flex: '1 1 240px' }}>
                          <strong>Asset:</strong>{' '}
                          {readOnly ? (item.asset || '—') : (
                            <input
                              className="form-control input-sm"
                              aria-label={`Asset of ${item.code || item.id}`}
                              value={item.asset ?? ''}
                              onChange={(e) => setField(index, { asset: e.target.value })}
                            />
                          )}
                        </span>
                        <span style={{ flex: '1 1 240px' }}>
                          <strong>Entry point:</strong>{' '}
                          {readOnly ? (item.entryPoint || '—') : (
                            <input
                              className="form-control input-sm"
                              aria-label={`Entry point of ${item.code || item.id}`}
                              value={item.entryPoint ?? ''}
                              onChange={(e) => setField(index, { entryPoint: e.target.value })}
                            />
                          )}
                        </span>
                        <span style={{ flex: '0 0 160px' }}>
                          <strong>Residual:</strong>{' '}
                          {select(index, 'residual', 'Residual risk', RESIDUALS, item.residual ?? 'not_assessed')}
                        </span>
                      </div>

                      <div style={{ marginBottom: 6 }}>
                        <strong>Attack surface:</strong>{' '}
                        <RefPicker
                          label={`Attack surface of ${item.code || item.id}`}
                          value={item.causes ?? []}
                          options={surfaceOptions}
                          onChange={(ids) => setField(index, { causes: ids })}
                          readOnly={readOnly}
                          empty="No unit or component recorded"
                        />
                      </div>

                      <div style={{ marginBottom: 6 }}>
                        <strong>Safety risk created:</strong>{' '}
                        <RefPicker
                          label={`Safety risks created by ${item.code || item.id}`}
                          value={item.safetyRisk ?? []}
                          options={riskOptions}
                          onChange={(ids) => setField(index, { safetyRisk: ids })}
                          readOnly={readOnly}
                          empty="None — no patient consequence"
                        />
                      </div>

                      {(item.controls ?? []).length === 0 ? (
                        <div style={{ marginBottom: 6 }}>
                          <strong>No software control.</strong>{' '}
                          {item.justification
                            ? <span>{item.justification}</span>
                            : <em className="text-danger">No justification recorded.</em>}
                        </div>
                      ) : (
                        <ul className="list-unstyled" style={{ marginBottom: 6 }}>
                          {(item.controls ?? []).map((id) => {
                            const req = srsById.get(id);
                            const tests = testsByReq.get(id) ?? [];
                            return (
                              <li key={id}>
                                <strong>{req?.code ?? id}</strong>
                                {req ? <span> — {req.text}</span> : <span className="text-danger"> (unresolved)</span>}
                                {tests.length === 0 ? (
                                  <div className="text-danger" style={{ marginLeft: 16 }}>
                                    No verifying test — nothing demonstrates this control works.
                                  </div>
                                ) : (
                                  <ul className="list-unstyled" style={{ marginLeft: 16 }}>
                                    {tests.map((t) => {
                                      const { status } = verificationOutcome(t, run ?? null);
                                      return (
                                        <li key={t.id}>
                                          {t.code || t.id}
                                          <span
                                            className={`label label-${status === 'passed' ? 'success' : status === 'failed' ? 'danger' : 'default'}`}
                                            style={{ marginLeft: 6 }}
                                          >
                                            {label(status)}
                                          </span>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}

                      {item.notes && <div className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>{item.notes}</div>}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {!readOnly && doc.items.length === 0 && (
        <button className="btn btn-default btn-xs" onClick={() => update([fresh()])}>+ Threat</button>
      )}
    </div>
  );
};

export default ThreatTable;
