/**
 * RiskTable — the Risk tab: the software risk analysis (IEC 62304 §7).
 *
 * A table rather than a document, because a risk record is fields: a hazardous
 * situation, its severity, what could cause it, and what controls it.
 *
 * The column that earns the view is **Controlled**. A control is a requirement, so
 * whether the control actually works is the state of that requirement's tests in the
 * captured run — derived here, never stored. A risk whose control has a failing or
 * unexecuted test is not a controlled risk, however the residual column reads.
 */
import React, { useMemo, useState } from 'react';
import type { RiskDoc, RiskItem, RiskSeverity, ResidualRisk, SddDoc, SrsDoc, VtpDoc, RunRecord } from '../shared';
import { createRiskItem, verificationOutcome } from '../shared';
import RowMenu from './RowMenu';
import RefPicker from './RefPicker';
import type { RefOption } from './RefPicker';

interface RiskTableProps {
  doc: RiskDoc;
  /** Candidates for `causes` — only sections describing a software unit (§7.1). */
  sddDoc?: SddDoc | null;
  /** Candidates for `controls`, and the requirements whose tests are the evidence. */
  srsDoc?: SrsDoc | null;
  vtpDoc?: VtpDoc | null;
  run?: RunRecord | null;
  onChange: (doc: RiskDoc) => void;
  readOnly?: boolean;
}

const SEVERITIES: RiskSeverity[] = ['negligible', 'minor', 'serious', 'critical', 'catastrophic'];
const RESIDUALS: ResidualRisk[] = ['not_assessed', 'acceptable', 'unacceptable'];

/** How well the controls of one risk are demonstrated to work. Derived, never stored. */
type ControlState = 'verified' | 'failing' | 'incomplete' | 'unverified' | 'none';

const CONTROL_LABEL: Record<ControlState, { text: string; className: string; title: string }> = {
  verified: { text: 'verified', className: 'label label-success', title: 'Every controlling requirement is verified by a passing test.' },
  failing: { text: 'failing', className: 'label label-danger', title: 'A test verifying a controlling requirement failed — this risk is not controlled.' },
  incomplete: { text: 'not run', className: 'label label-warning', title: 'A test verifying a controlling requirement has not been executed.' },
  unverified: { text: 'no test', className: 'label label-danger', title: 'A controlling requirement has no verifying test, so nothing demonstrates the control works.' },
  none: { text: 'no control', className: 'label label-default', title: 'No software control; see the justification.' },
};

const RiskTable: React.FC<RiskTableProps> = ({ doc, sddDoc, srsDoc, vtpDoc, run, onChange, readOnly }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ index: number; field: 'code' | 'text' } | null>(null);
  const [editValue, setEditValue] = useState('');

  const update = (items: RiskItem[]) => onChange({ ...doc, items });

  // Only a software unit may cause a risk; a design view describes structure across
  // units and cannot fail on its own.
  const causeOptions: RefOption[] = useMemo(
    () =>
      (sddDoc?.items ?? [])
        .filter((s) => !s.heading && (s.kind ?? 'unit') === 'unit')
        .map((s) => ({ id: s.id, code: s.code, text: s.title })),
    [sddDoc],
  );
  const controlOptions: RefOption[] = useMemo(
    () => (srsDoc?.items ?? []).filter((i) => !i.heading).map((i) => ({ id: i.id, code: i.code, text: i.text })),
    [srsDoc],
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

  /** Roll the controls' verification up to one state (§7.3). */
  const controlState = (risk: RiskItem): ControlState => {
    const controls = risk.controls ?? [];
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

  const setField = (index: number, patch: Partial<RiskItem>) => {
    const items = doc.items.slice();
    items[index] = { ...items[index], ...patch };
    update(items);
  };

  const startEdit = (index: number, field: 'code' | 'text') => {
    if (readOnly) return;
    setEditing({ index, field });
    setEditValue(doc.items[index][field] ?? '');
  };
  const commitEdit = () => {
    if (!editing) return;
    setField(editing.index, { [editing.field]: editValue } as Partial<RiskItem>);
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
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Escape') setEditing(null);
          if (e.key === 'Enter' && field === 'code') commitEdit();
        },
        'aria-label': field === 'code' ? 'Risk code' : 'Hazardous situation',
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

  const insert = (at: number, item: RiskItem) => update([...doc.items.slice(0, at), item, ...doc.items.slice(at)]);
  const fresh = (level = 0) => createRiskItem(doc.items.map((i) => i.id), level);
  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  return (
    <div className="risk-table-container">
      <div style={{ marginBottom: 10 }}>
        <h2>{doc.title || 'Risk'}</h2>
        <strong>Document:</strong> {doc.name}
        <p className="text-muted" style={{ marginTop: 4, marginBottom: 0 }}>
          The software risk analysis (IEC 62304 §7). Hazards, harms and probability live in the system
          risk management file; a control is a requirement, and its tests are the evidence it works.
        </p>
      </div>

      <table className="table table-condensed risk-table">
        <thead>
          <tr>
            <th style={{ width: 90 }}>Code</th>
            <th>Hazardous situation</th>
            <th style={{ width: 110 }}>Severity</th>
            <th style={{ width: 150 }}>Causes</th>
            <th style={{ width: 170 }}>Controls</th>
            <th style={{ width: 90 }}>Controlled</th>
            <th style={{ width: 120 }}>Residual</th>
            <th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, index) => {
            if (item.heading) {
              return (
                <tr key={item.id} className="risk-heading-row">
                  <td colSpan={7} style={{ fontWeight: 'bold', paddingLeft: 8 + (item.level ?? 0) * 16 }}>
                    {renderCell(index, 'text')}
                  </td>
                  <td>
                    {!readOnly && (
                      <RowMenu
                        noun="risk"
                        onAddAbove={() => insert(index, fresh(item.level))}
                        onAddBelow={() => insert(index + 1, fresh(item.level))}
                        onAddChild={() => insert(index + 1, fresh((item.level ?? 0) + 1))}
                        onAddHeading={() => insert(index + 1, { ...fresh(item.level), heading: true, text: 'New group' })}
                        onIndent={() => setField(index, { level: (item.level ?? 0) + 1 })}
                        onOutdent={() => setField(index, { level: Math.max(0, (item.level ?? 0) - 1) })}
                        onDelete={() => window.confirm(`Delete "${item.text}"?`) && update(doc.items.filter((i) => i.id !== item.id))}
                        onViewInfo={() => toggle(item.id)}
                        canOutdent={(item.level ?? 0) > 0}
                      />
                    )}
                  </td>
                </tr>
              );
            }

            const state = controlState(item);
            const open = expanded.has(item.id);

            return (
              <React.Fragment key={item.id}>
                <tr>
                  <td style={{ paddingLeft: 8 + (item.level ?? 0) * 16 }}>{renderCell(index, 'code')}</td>
                  <td>{renderCell(index, 'text')}</td>
                  <td>
                    <select
                      className="form-control input-sm"
                      aria-label={`Severity of ${item.code || item.id}`}
                      value={item.severity ?? ''}
                      disabled={readOnly}
                      onChange={(e) => setField(index, { severity: (e.target.value || undefined) as RiskSeverity })}
                    >
                      <option value="">—</option>
                      {SEVERITIES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <RefPicker
                      label={`Software items causing ${item.code || item.id}`}
                      value={item.causes ?? []}
                      options={causeOptions}
                      onChange={(ids) => setField(index, { causes: ids })}
                      readOnly={readOnly}
                      empty="None"
                    />
                  </td>
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
                      aria-label={`Show control detail for ${item.code || item.id}`}
                      onClick={() => toggle(item.id)}
                    >
                      <span className={CONTROL_LABEL[state].className} title={CONTROL_LABEL[state].title}>
                        {CONTROL_LABEL[state].text}
                      </span>{' '}
                      {open ? '▾' : '▸'}
                    </button>
                  </td>
                  <td>
                    <select
                      className="form-control input-sm"
                      aria-label={`Residual risk of ${item.code || item.id}`}
                      value={item.residual ?? 'not_assessed'}
                      disabled={readOnly}
                      onChange={(e) => setField(index, { residual: e.target.value as ResidualRisk })}
                    >
                      {RESIDUALS.map((r) => (
                        <option key={r} value={r}>{r.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {!readOnly && (
                      <RowMenu
                        noun="risk"
                        onAddAbove={() => insert(index, fresh(item.level))}
                        onAddBelow={() => insert(index + 1, fresh(item.level))}
                        onAddChild={() => insert(index + 1, fresh((item.level ?? 0) + 1))}
                        onAddHeading={() => insert(index + 1, { ...fresh(item.level), heading: true, text: 'New group' })}
                        onIndent={() => setField(index, { level: (item.level ?? 0) + 1 })}
                        onOutdent={() => setField(index, { level: Math.max(0, (item.level ?? 0) - 1) })}
                        onDelete={() => window.confirm(`Delete "${item.code || item.id}"?`) && update(doc.items.filter((i) => i.id !== item.id))}
                        onViewInfo={() => toggle(item.id)}
                        canOutdent={(item.level ?? 0) > 0}
                      />
                    )}
                  </td>
                </tr>

                {open && (
                  <tr className="srs-tests-row">
                    <td />
                    <td colSpan={7}>
                      {(item.controls ?? []).length === 0 ? (
                        <div style={{ marginBottom: 6 }}>
                          <strong>No software control.</strong>{' '}
                          {item.justification ? (
                            <span>{item.justification}</span>
                          ) : (
                            <em className="text-danger">No justification recorded.</em>
                          )}
                        </div>
                      ) : (
                        <ul className="list-unstyled" style={{ marginBottom: 6 }}>
                          {(item.controls ?? []).map((id) => {
                            const req = srsById.get(id);
                            const tests = testsByReq.get(id) ?? [];
                            return (
                              <li key={id} style={{ marginBottom: 4 }}>
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
                                            {status.replace('_', ' ')}
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

                      {item.hazardRef && (
                        <div className="text-muted">
                          System risk file: <code>{item.hazardRef}</code>
                        </div>
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
        <button className="btn btn-default btn-xs" onClick={() => update([fresh()])}>+ Risk</button>
      )}
    </div>
  );
};

export default RiskTable;
