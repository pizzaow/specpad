/**
 * TestingView — the Results tab: the verification **evidence chain**, viewable end
 * to end. Each test shows VTP → the requirement(s) it verifies → its automation
 * link(s) (the automated test that executes it) → the outcome. Automated tests
 * derive their status from the loaded run record (not a hand-set field); manual
 * tests (no automation links) keep a recorded result. The automation linkage is
 * editable here and saved to the VTP doc. Heading rows are skipped.
 */
import React, { useMemo, useState } from 'react';
import type { VtpDoc, VtpItem, SrsDoc, TestResult, RunRecord, AutomationLink, VerificationStatus } from '../shared';
import { verificationOutcome, rollup } from '../shared';

interface TestingViewProps {
  doc: VtpDoc;
  srsDoc?: SrsDoc | null;
  run?: RunRecord | null;
  onChange: (doc: VtpDoc) => void;
  readOnly?: boolean;
}

const MANUAL_RESULTS: TestResult[] = ['', 'not_tested', 'passed', 'failed'];

const STATUS_LABEL: Record<VerificationStatus, { text: string; cls: string }> = {
  passed: { text: 'passed', cls: 'success' },
  failed: { text: 'failed', cls: 'danger' },
  not_run: { text: 'not run', cls: 'warning' },
  skipped: { text: 'skipped', cls: 'default' },
  not_tested: { text: 'not tested', cls: 'default' },
  unset: { text: '—', cls: 'default' },
};

const TestingView: React.FC<TestingViewProps> = ({ doc, srsDoc, run, onChange, readOnly }) => {
  const data = doc;
  const update = (items: VtpItem[]) => onChange({ ...doc, items });
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const srsById = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of srsDoc?.items ?? []) m.set(it.id, it.code || it.text || it.id);
    return m;
  }, [srsDoc]);

  const testable = useMemo(
    () => data.items.map((item, index) => ({ item, index })).filter((r) => !r.item.heading),
    [data],
  );
  const counts = useMemo(() => rollup(data.items, run ?? null), [data.items, run]);

  const setResult = (index: number, result: TestResult) => {
    const items = data.items.slice();
    items[index] = { ...items[index], result };
    update(items);
  };
  const commitNotes = (index: number) => {
    const items = data.items.slice();
    items[index] = { ...items[index], notes: editValue };
    update(items);
    setEditingNotes(null);
  };
  const setLinks = (index: number, links: AutomationLink[]) => {
    const items = data.items.slice();
    const next: VtpItem = { ...items[index] };
    if (links.length) next.automation = links; else delete next.automation;
    items[index] = next;
    update(items);
  };
  const patchLink = (index: number, li: number, patch: Partial<AutomationLink>) => {
    const links = (data.items[index].automation ?? []).map((l, i) => (i === li ? { ...l, ...patch } : l));
    setLinks(index, links);
  };
  const addLink = (index: number) => setLinks(index, [...(data.items[index].automation ?? []), { runner: 'vitest', file: '' }]);
  const removeLink = (index: number, li: number) => setLinks(index, (data.items[index].automation ?? []).filter((_, i) => i !== li));

  return (
    <div className="testing-view-container">
      <div style={{ marginBottom: 10 }}>
        <h2>Results — {data.title || 'Verification Tests'}</h2>
        <strong>Document:</strong> {data.name}
        <div style={{ marginTop: 10 }}>
          <span className="label label-success">Passed: {counts.passed}</span>{' '}
          <span className="label label-danger">Failed: {counts.failed}</span>{' '}
          <span className="label label-warning">Not run: {counts.not_run}</span>{' '}
          <span className="label label-default">Skipped: {counts.skipped}</span>{' '}
          <span className="label label-default">Manual: {counts.manual}</span>
        </div>
        {run ? (
          <p className="text-muted" style={{ marginTop: 8, marginBottom: 0 }}>
            Automated results from run <code>{run.runner}</code> @ <code>{run.ref.slice(0, 9)}</code> · {run.ranAt}
            {' '}({run.summary.passed}/{run.summary.total} passed). Manual tests are recorded below.
          </p>
        ) : (
          <p className="text-muted" style={{ marginTop: 8, marginBottom: 0 }}>
            No captured run loaded — automated tests show “not run”. Capture one with <code>specpad-verify</code>.
          </p>
        )}
      </div>
      <table className="table table-bordered table-striped">
        <thead>
          <tr>
            <th style={{ width: 90 }}>Code</th>
            <th>Test</th>
            <th style={{ width: 120 }}>Verifies</th>
            <th style={{ width: 300 }}>Automated test (runner · file · selector)</th>
            <th style={{ width: 110 }}>Result</th>
            <th style={{ width: 160 }}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {testable.map(({ item, index }) => {
            const outcome = verificationOutcome(item, run ?? null);
            const badge = STATUS_LABEL[outcome.status];
            const rowCls = outcome.status === 'passed' ? 'success' : outcome.status === 'failed' ? 'danger' : outcome.status === 'not_run' ? 'warning' : '';
            const links = item.automation ?? [];
            return (
              <tr key={item.id} className={rowCls}>
                <td><strong>{item.code || item.id}</strong></td>
                <td style={{ fontSize: '0.9em' }}>{item.text}</td>
                <td style={{ fontSize: '0.85em' }}>
                  {(item.verifies ?? []).length === 0
                    ? <span className="text-muted">—</span>
                    : (item.verifies ?? []).map((ref) => (
                      <span key={ref} className={`label ${srsById.has(ref) ? 'label-default' : 'label-danger'}`} style={{ marginRight: 4 }}>
                        {srsById.get(ref) ?? `${ref}?`}
                      </span>
                    ))}
                </td>
                <td style={{ fontSize: '0.85em' }}>
                  {links.length === 0 && <span className="text-muted">manual</span>}
                  {links.map((l, li) => {
                    const lo = outcome.links[li];
                    return (
                      <div key={li} style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 3 }}>
                        {readOnly ? (
                          <span><code>{l.runner}</code> · {l.file}{l.selector ? <> · “{l.selector}”</> : null}</span>
                        ) : (
                          <>
                            <input className="form-control input-sm" style={{ width: 72 }} value={l.runner} title="runner"
                              onChange={(e) => patchLink(index, li, { runner: e.target.value })} />
                            <input className="form-control input-sm" style={{ flex: 1, minWidth: 90 }} value={l.file} title="test file" placeholder="path/to/test"
                              onChange={(e) => patchLink(index, li, { file: e.target.value })} />
                            <input className="form-control input-sm" style={{ width: 80 }} value={l.selector ?? ''} title="selector (optional)" placeholder="selector"
                              onChange={(e) => patchLink(index, li, { selector: e.target.value || undefined })} />
                            <button type="button" className="btn btn-link btn-xs text-danger" title="Remove link" onClick={() => removeLink(index, li)}>✕</button>
                          </>
                        )}
                        {lo && lo.status === 'missing' && <span className="label label-warning" title="no matching result in the run">no run match</span>}
                      </div>
                    );
                  })}
                  {!readOnly && (
                    <button type="button" className="btn btn-default btn-xs" onClick={() => addLink(index)}>+ link</button>
                  )}
                </td>
                <td>
                  {outcome.automated ? (
                    <span className={`label label-${badge.cls}`} title="derived from the captured run">{badge.text}</span>
                  ) : (
                    <select className="form-control input-sm" aria-label={`Result for ${item.code ?? item.id}`} value={item.result ?? ''} disabled={readOnly}
                      onChange={(e) => setResult(index, e.target.value as TestResult)}>
                      {MANUAL_RESULTS.map((r) => <option key={r} value={r}>{r === '' ? '—' : r}</option>)}
                    </select>
                  )}
                </td>
                <td>
                  {editingNotes === index ? (
                    <textarea className="form-control" rows={2} autoFocus value={editValue}
                      onChange={(e) => setEditValue(e.target.value)} onBlur={() => commitNotes(index)} />
                  ) : (
                    <div className="editable-cell" style={{ cursor: readOnly ? 'default' : 'pointer', minHeight: 20, fontSize: '0.85em', whiteSpace: 'pre-wrap' }}
                      onClick={() => { if (!readOnly) { setEditingNotes(index); setEditValue(item.notes ?? ''); } }}>
                      {item.notes || <span style={{ color: '#ccc' }}>(empty)</span>}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {testable.length === 0 && <div className="alert alert-info">No tests to record.</div>}
    </div>
  );
};

export default TestingView;
