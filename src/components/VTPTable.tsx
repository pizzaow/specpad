/**
 * VTPTable — v1 verification-tests editor.
 * `verifies` holds SRS item *ids*; the UI shows each ref's human label
 * (code or text) and flags refs that don't resolve. No auto-`testid`, no vendor.
 */
import React, { useMemo, useState } from 'react';
import type { SrsDoc, VtpDoc, VtpItem, TestResult } from '../shared';
import { createVtpItem } from '../shared';
import type { RedlineView, AttributionView } from '../changeTracking';
import { rowStatusClass, isCellChanged, attributionLabel } from '../changeTrackingView';

interface VTPTableProps {
  doc: VtpDoc;
  srsDoc: SrsDoc | null;
  onChange: (doc: VtpDoc) => void;
  redline?: RedlineView;
  attribution?: Map<string, AttributionView>;
}

type EditTarget = { index: number; field: 'code' | 'text' | 'verifies' | 'expected' | 'notes' } | null;

const RESULTS: TestResult[] = ['', 'not_tested', 'passed', 'failed'];

const VTPTable: React.FC<VTPTableProps> = ({ doc, srsDoc, onChange, redline, attribution }) => {
  const data = doc;
  const update = (items: VtpItem[]) => onChange({ ...doc, items });
  const [editing, setEditing] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');

  const srsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of srsDoc?.items ?? []) map.set(item.id, item.code || item.text || item.id);
    return map;
  }, [srsDoc]);

  const existingIds = () => data.items.map((i) => i.id);

  const startEdit = (index: number, field: NonNullable<EditTarget>['field']) => {
    const value = data.items[index][field];
    setEditing({ index, field });
    setEditValue(Array.isArray(value) ? value.join(', ') : value ?? '');
  };

  const commitEdit = () => {
    if (!editing) return;
    const items = data.items.slice();
    const item: VtpItem = { ...items[editing.index] };
    if (editing.field === 'verifies') {
      item.verifies = editValue.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      item[editing.field] = editValue;
    }
    items[editing.index] = item;
    update(items);
    setEditing(null);
  };

  const setResult = (index: number, result: TestResult) => {
    const items = data.items.slice();
    items[index] = { ...items[index], result };
    update(items);
  };

  const addRow = (afterIndex: number) => {
    const items = data.items.slice();
    items.splice(afterIndex + 1, 0, createVtpItem(existingIds()));
    update(items);
  };

  const deleteRow = (index: number) => {
    if (!confirm('Delete this row?')) return;
    const items = data.items.slice();
    items.splice(index, 1);
    update(items);
  };

  const moveRow = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= data.items.length) return;
    const items = data.items.slice();
    const [item] = items.splice(index, 1);
    items.splice(target, 0, item);
    update(items);
  };

  const renderCell = (index: number, field: NonNullable<EditTarget>['field']) => {
    const value = data.items[index][field];
    const isEditing = editing?.index === index && editing.field === field;
    if (isEditing) {
      const isLong = field === 'text' || field === 'expected';
      const common = {
        className: 'form-control',
        value: editValue,
        autoFocus: true,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          setEditValue(e.target.value),
        onBlur: commitEdit,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' && !e.shiftKey && !isLong) { e.preventDefault(); commitEdit(); }
          if (e.key === 'Escape') setEditing(null);
        },
      };
      return isLong ? <textarea {...common} rows={3} /> : <input type="text" {...common} />;
    }
    if (field === 'verifies') {
      const refs = (value as string[]) ?? [];
      return (
        <div className="editable-cell" style={{ cursor: 'pointer', minHeight: 20 }} onClick={() => startEdit(index, field)}>
          {refs.length === 0 ? <span style={{ color: '#ccc' }}>(none)</span> : refs.map((ref) => (
            <span key={ref} className={`label ${srsById.has(ref) ? 'label-default' : 'label-danger'}`} style={{ marginRight: 4 }}>
              {srsById.get(ref) ?? `${ref} (missing)`}
            </span>
          ))}
        </div>
      );
    }
    const display = Array.isArray(value) ? value.join(', ') : value;
    return (
      <div className="editable-cell" style={{ cursor: 'pointer', minHeight: 20, whiteSpace: 'pre-wrap' }} onClick={() => startEdit(index, field)}>
        {display || <span style={{ color: '#ccc' }}>(empty)</span>}
      </div>
    );
  };

  const rowHasBadRef = (item: VtpItem) =>
    (item.verifies ?? []).some((ref) => !srsById.has(ref));

  return (
    <div className="vtp-table-container">
      <div style={{ marginBottom: 10 }}>
        <h2>{data.title || 'Verification Tests'}</h2>
        <strong>Document:</strong> {data.name}
      </div>
      <table className="table table-bordered table-striped">
        <thead>
          <tr>
            <th style={{ width: 90 }}>Code</th>
            <th>Text</th>
            <th style={{ width: 160 }}>Verifies</th>
            <th style={{ width: 200 }}>Expected</th>
            <th style={{ width: 110 }}>Result</th>
            {attribution && <th style={{ width: 150 }}>History</th>}
            <th style={{ width: 90 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, index) => (
            <tr key={item.id} className={srsDoc && rowHasBadRef(item) ? 'danger' : rowStatusClass(item.heading, redline?.byId.get(item.id))}>
              <td className={isCellChanged(redline?.byId.get(item.id), 'code') ? 'ct-changed' : undefined}>{renderCell(index, 'code')}</td>
              <td className={isCellChanged(redline?.byId.get(item.id), 'text') ? 'ct-changed' : undefined}>{renderCell(index, 'text')}</td>
              <td className={isCellChanged(redline?.byId.get(item.id), 'verifies') ? 'ct-changed' : undefined}>{renderCell(index, 'verifies')}</td>
              <td className={isCellChanged(redline?.byId.get(item.id), 'expected') ? 'ct-changed' : undefined}>{renderCell(index, 'expected')}</td>
              <td>
                <select className="form-control" value={item.result ?? ''} onChange={(e) => setResult(index, e.target.value as TestResult)}>
                  {RESULTS.map((r) => <option key={r} value={r}>{r === '' ? '—' : r}</option>)}
                </select>
              </td>
              {attribution && <td className="ct-attribution">{item.heading ? '' : attributionLabel(attribution.get(item.id))}</td>}
              <td>
                <div className="btn-group-vertical btn-group-xs">
                  <button className="btn btn-default btn-xs" title="Add row below" onClick={() => addRow(index)}>+</button>
                  <button className="btn btn-danger btn-xs" title="Delete row" onClick={() => deleteRow(index)}>×</button>
                  <button className="btn btn-default btn-xs" title="Move up" disabled={index === 0} onClick={() => moveRow(index, -1)}>↑</button>
                  <button className="btn btn-default btn-xs" title="Move down" disabled={index === data.items.length - 1} onClick={() => moveRow(index, 1)}>↓</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {redline && redline.removed.length > 0 && (
        <div className="panel panel-default ct-removed">
          <div className="panel-heading"><strong>Removed since baseline ({redline.removed.length})</strong></div>
          <ul className="list-group">
            {redline.removed.map((c) => (
              <li key={c.id} className="list-group-item">
                {c.before?.code ? <strong>{c.before.code}: </strong> : null}
                {c.before?.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!srsDoc && (
        <div className="alert alert-warning">
          <strong>Note:</strong> No SRS document loaded. `verifies` references cannot be resolved.
        </div>
      )}
    </div>
  );
};

export default VTPTable;
