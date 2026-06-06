/**
 * TestingView — records pass/fail/notes against VTP tests.
 * In v1, `result` lives on the test (VTP item), so this view edits the VTP doc.
 * Heading rows are skipped.
 */
import React, { useMemo, useState } from 'react';
import type { VtpDoc, VtpItem, TestResult } from '../shared';

interface TestingViewProps {
  doc: VtpDoc;
  onSave: (doc: VtpDoc) => void;
}

const RESULTS: TestResult[] = ['', 'not_tested', 'passed', 'failed'];

const TestingView: React.FC<TestingViewProps> = ({ doc, onSave }) => {
  const [data, setData] = useState<VtpDoc>(doc);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const testable = useMemo(
    () => data.items.map((item, index) => ({ item, index })).filter((r) => !r.item.heading),
    [data]
  );

  const counts = useMemo(() => {
    const passed = testable.filter((r) => r.item.result === 'passed').length;
    const failed = testable.filter((r) => r.item.result === 'failed').length;
    const pending = testable.length - passed - failed;
    return { passed, failed, pending };
  }, [testable]);

  const setResult = (index: number, result: TestResult) => {
    const items = data.items.slice();
    items[index] = { ...items[index], result };
    setData({ ...data, items });
  };

  const commitNotes = (index: number) => {
    const items = data.items.slice();
    items[index] = { ...items[index], notes: editValue };
    setData({ ...data, items });
    setEditingNotes(null);
  };

  const rowClass = (item: VtpItem) =>
    item.result === 'passed' ? 'success' : item.result === 'failed' ? 'danger' : '';

  return (
    <div className="testing-view-container">
      <div style={{ marginBottom: 10 }}>
        <h2>Testing — {data.title || 'Verification Tests'}</h2>
        <strong>Document:</strong> {data.name}
        <button className="btn btn-success btn-sm" style={{ marginLeft: 20 }} onClick={() => onSave(data)}>Save</button>
        <div style={{ marginTop: 10 }}>
          <span className="label label-success">Passed: {counts.passed}</span>{' '}
          <span className="label label-danger">Failed: {counts.failed}</span>{' '}
          <span className="label label-default">Pending: {counts.pending}</span>
        </div>
      </div>
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
          {testable.map(({ item, index }) => (
            <tr key={item.id} className={rowClass(item)}>
              <td><strong>{item.code || item.id}</strong></td>
              <td style={{ fontSize: '0.9em' }}>{item.text}</td>
              <td style={{ fontSize: '0.9em' }}>{item.expected}</td>
              <td>
                <select className="form-control" value={item.result ?? ''} onChange={(e) => setResult(index, e.target.value as TestResult)}>
                  {RESULTS.map((r) => <option key={r} value={r}>{r === '' ? '—' : r}</option>)}
                </select>
              </td>
              <td>
                {editingNotes === index ? (
                  <textarea className="form-control" rows={2} autoFocus value={editValue}
                    onChange={(e) => setEditValue(e.target.value)} onBlur={() => commitNotes(index)} />
                ) : (
                  <div className="editable-cell" style={{ cursor: 'pointer', minHeight: 20, whiteSpace: 'pre-wrap' }}
                    onClick={() => { setEditingNotes(index); setEditValue(item.notes ?? ''); }}>
                    {item.notes || <span style={{ color: '#ccc' }}>(empty)</span>}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {testable.length === 0 && <div className="alert alert-info">No tests to record.</div>}
    </div>
  );
};

export default TestingView;
