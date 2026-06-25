/**
 * TestingView — the Results tab: verification outcomes, grouped into **Manual** and
 * **Automated** sections. Automated tests derive their status from the loaded run
 * record (the evidence chain VTP item → automation link → run result); their linkage
 * is shown read-only and becomes editable on click. Manual tests record a result and
 * notes. A run-detail dialog exposes the captured run's per-test outcomes. Heading
 * rows are skipped; the verifies trace lives on the Verification Tests tab, not here.
 */
import React, { useMemo, useState } from 'react';
import type { VtpDoc, VtpItem, TestResult, RunRecord, AutomationLink, VerificationStatus } from '../shared';
import { verificationOutcome, rollup } from '../shared';

interface TestingViewProps {
  doc: VtpDoc;
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

const TestingView: React.FC<TestingViewProps> = ({ doc, run, onChange, readOnly }) => {
  const data = doc;
  const update = (items: VtpItem[]) => onChange({ ...doc, items });
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [editingLinks, setEditingLinks] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showRun, setShowRun] = useState(false);

  const rows = useMemo(
    () => data.items.map((item, index) => ({ item, index })).filter((r) => !r.item.heading),
    [data],
  );
  const manual = rows.filter((r) => !(r.item.automation?.length));
  const automated = rows.filter((r) => r.item.automation?.length);
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
  const patchLink = (index: number, li: number, patch: Partial<AutomationLink>) =>
    setLinks(index, (data.items[index].automation ?? []).map((l, i) => (i === li ? { ...l, ...patch } : l)));
  const addLink = (index: number) => setLinks(index, [...(data.items[index].automation ?? []), { runner: 'vitest', file: '' }]);
  const removeLink = (index: number, li: number) => setLinks(index, (data.items[index].automation ?? []).filter((_, i) => i !== li));

  // --- Automated test cell: read-only display, click to edit (like the other tables) ---
  const renderAutomation = (item: VtpItem, index: number) => {
    const outcome = verificationOutcome(item, run ?? null);
    const links = item.automation ?? [];
    if (editingLinks === index && !readOnly) {
      return (
        <div>
          {links.map((l, li) => (
            <div key={li} style={{ display: 'flex', gap: 3, alignItems: 'center', marginBottom: 3 }}>
              <input className="form-control input-sm" style={{ width: 70 }} value={l.runner} title="runner" onChange={(e) => patchLink(index, li, { runner: e.target.value })} />
              <input className="form-control input-sm" style={{ flex: 1, minWidth: 90 }} value={l.file} title="test file" placeholder="path/to/test" onChange={(e) => patchLink(index, li, { file: e.target.value })} />
              <input className="form-control input-sm" style={{ width: 90 }} value={l.selector ?? ''} title="selector (optional)" placeholder="selector" onChange={(e) => patchLink(index, li, { selector: e.target.value || undefined })} />
              <button type="button" className="btn btn-link btn-xs text-danger" title="Remove link" onClick={() => removeLink(index, li)}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-default btn-xs" onClick={() => addLink(index)}>+ link</button>{' '}
          <button type="button" className="btn btn-primary btn-xs" onClick={() => setEditingLinks(null)}>Done</button>
        </div>
      );
    }
    return (
      <div className="editable-cell" style={{ cursor: readOnly ? 'default' : 'pointer', minHeight: 20 }}
        onClick={() => { if (!readOnly) setEditingLinks(index); }} title={readOnly ? undefined : 'Click to edit links'}>
        {links.map((l, li) => {
          const lo = outcome.links[li];
          return (
            <div key={li} style={{ fontSize: '0.85em' }}>
              <code>{l.runner}</code> · {l.file || <span className="text-danger">(no file)</span>}
              {l.selector ? <> · “{l.selector}”</> : (lo && lo.status !== 'missing' ? <span className="text-muted"> · {lo.matches} test{lo.matches === 1 ? '' : 's'}</span> : null)}
              {lo && lo.status === 'missing' && <span className="label label-warning" style={{ marginLeft: 4 }}>no run match</span>}
            </div>
          );
        })}
      </div>
    );
  };

  const statusBadge = (item: VtpItem) => {
    const o = verificationOutcome(item, run ?? null);
    const b = STATUS_LABEL[o.status];
    return <span className={`label label-${b.cls}`} title="derived from the captured run">{b.text}</span>;
  };
  const rowCls = (item: VtpItem) => {
    const s = verificationOutcome(item, run ?? null).status;
    return s === 'passed' ? 'success' : s === 'failed' ? 'danger' : s === 'not_run' ? 'warning' : '';
  };

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
            {' '}({run.summary.passed}/{run.summary.total} passed).{' '}
            <button type="button" className="btn btn-link btn-xs" style={{ padding: 0 }} onClick={() => setShowRun(true)}>View run output →</button>
          </p>
        ) : (
          <p className="text-muted" style={{ marginTop: 8, marginBottom: 0 }}>
            No captured run loaded — automated tests show “not run”. Capture one with <code>specpad-verify</code>.
          </p>
        )}
      </div>

      {/* Manual tests — recorded by a human (above the automated suite). */}
      <h4>Manual tests {manual.length ? <small className="text-muted">({manual.length})</small> : null}</h4>
      {manual.length === 0 ? (
        <p className="text-muted">No manual tests — every verification is automated.</p>
      ) : (
        <table className="table table-bordered table-striped">
          <thead>
            <tr>
              <th style={{ width: 90 }}>Code</th>
              <th>Test</th>
              <th style={{ width: 220 }}>Expected</th>
              <th style={{ width: 120 }}>Result</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {manual.map(({ item, index }) => (
              <tr key={item.id} className={item.result === 'passed' ? 'success' : item.result === 'failed' ? 'danger' : ''}>
                <td><strong>{item.code || item.id}</strong></td>
                <td style={{ fontSize: '0.9em' }}>{item.text}</td>
                <td style={{ fontSize: '0.9em' }}>{item.expected}</td>
                <td>
                  <select className="form-control input-sm" aria-label={`Result for ${item.code ?? item.id}`} value={item.result ?? ''} disabled={readOnly}
                    onChange={(e) => setResult(index, e.target.value as TestResult)}>
                    {MANUAL_RESULTS.map((r) => <option key={r} value={r}>{r === '' ? '—' : r}</option>)}
                  </select>
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
            ))}
          </tbody>
        </table>
      )}

      {/* Automated tests — status derived from the run; linkage click-to-edit. */}
      <h4 style={{ marginTop: 18 }}>Automated tests {automated.length ? <small className="text-muted">({automated.length})</small> : null}</h4>
      {automated.length === 0 ? (
        <p className="text-muted">No automated tests linked yet.</p>
      ) : (
        <table className="table table-bordered table-striped">
          <thead>
            <tr>
              <th style={{ width: 90 }}>Code</th>
              <th>Test</th>
              <th style={{ width: 320 }}>Automated test (runner · file · selector)</th>
              <th style={{ width: 100 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {automated.map(({ item, index }) => (
              <tr key={item.id} className={rowCls(item)}>
                <td><strong>{item.code || item.id}</strong></td>
                <td style={{ fontSize: '0.9em' }}>{item.text}</td>
                <td>{renderAutomation(item, index)}</td>
                <td>{statusBadge(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length === 0 && <div className="alert alert-info">No tests to record.</div>}

      {showRun && run && <RunDetail run={run} onClose={() => setShowRun(false)} />}
    </div>
  );
};

// Run-detail dialog — the captured run's per-test outcomes (the evidence we store:
// status + duration per test). Raw stdout is not stored; see the run's ref/CI for that.
const RunDetail: React.FC<{ run: RunRecord; onClose: () => void }> = ({ run, onClose }) => {
  const [failsOnly, setFailsOnly] = useState(false);
  const shown = failsOnly ? run.results.filter((r) => r.status !== 'passed') : run.results;
  return (
    <div role="dialog" aria-label="Run output">
      <div className="modal-backdrop in" style={{ opacity: 0.5 }} onClick={onClose} />
      <div className="modal in" style={{ display: 'block' }}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <button type="button" className="close" aria-label="Close" onClick={onClose}><span aria-hidden="true">&times;</span></button>
              <h4 className="modal-title">Run output — <code>{run.runner}</code> @ <code>{run.ref.slice(0, 9)}</code></h4>
            </div>
            <div className="modal-body" style={{ maxHeight: '60vh', overflow: 'auto' }}>
              <p>
                {run.ranAt} · <span className="label label-success">{run.summary.passed} passed</span>{' '}
                <span className="label label-danger">{run.summary.failed} failed</span>{' '}
                <span className="label label-default">{run.summary.skipped} skipped</span> of {run.summary.total}{'  '}
                <label style={{ fontWeight: 'normal', marginLeft: 10 }}>
                  <input type="checkbox" checked={failsOnly} onChange={(e) => setFailsOnly(e.target.checked)} /> failures only
                </label>
              </p>
              <p className="text-muted" style={{ fontSize: '0.85em' }}>
                Per-test outcomes from the runner's machine report. Raw console output is not stored — re-run
                at this commit, or link a CI run, for the full log.
              </p>
              <table className="table table-condensed">
                <thead><tr><th>File</th><th>Test</th><th style={{ width: 70 }}>Status</th><th style={{ width: 70 }}>ms</th></tr></thead>
                <tbody>
                  {shown.map((r, i) => (
                    <tr key={i} className={r.status === 'failed' ? 'danger' : r.status === 'skipped' ? 'warning' : ''}>
                      <td style={{ fontSize: '0.8em' }}><code>{r.file}</code></td>
                      <td style={{ fontSize: '0.8em' }}>{r.selector}</td>
                      <td>{r.status}</td>
                      <td>{r.durationMs ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer"><button type="button" className="btn btn-default" onClick={onClose}>Close</button></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestingView;
