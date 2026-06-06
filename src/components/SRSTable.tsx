/**
 * SRSTable — v1 requirements editor.
 * Rows are SRS items keyed by stable `id`. Test counts are computed on read
 * from the VTP document's `verifies` references (never stored).
 */
import React, { useMemo, useState } from 'react';
import type { SrsDoc, SrsItem, VtpDoc } from '../shared';
import { createSrsItem } from '../shared';

interface SRSTableProps {
  doc: SrsDoc;
  vtpDoc: VtpDoc | null;
  onSave: (doc: SrsDoc) => void;
}

type EditTarget = { index: number; field: 'code' | 'text' | 'tags' | 'hazards' } | null;

const SRSTable: React.FC<SRSTableProps> = ({ doc, vtpDoc, onSave }) => {
  const [data, setData] = useState<SrsDoc>(doc);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');

  const testCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const test of vtpDoc?.items ?? []) {
      for (const ref of test.verifies ?? []) {
        counts.set(ref, (counts.get(ref) ?? 0) + 1);
      }
    }
    return counts;
  }, [vtpDoc]);

  const existingIds = () => data.items.map((i) => i.id);

  const startEdit = (index: number, field: NonNullable<EditTarget>['field']) => {
    const value = data.items[index][field];
    setEditing({ index, field });
    setEditValue(Array.isArray(value) ? value.join(', ') : value ?? '');
  };

  const commitEdit = () => {
    if (!editing) return;
    const items = data.items.slice();
    const item: SrsItem = { ...items[editing.index] };
    if (editing.field === 'tags' || editing.field === 'hazards') {
      item[editing.field] = editValue.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      item[editing.field] = editValue;
    }
    items[editing.index] = item;
    setData({ ...data, items });
    setEditing(null);
  };

  const addRow = (afterIndex: number) => {
    const items = data.items.slice();
    items.splice(afterIndex + 1, 0, createSrsItem(existingIds()));
    setData({ ...data, items });
  };

  const deleteRow = (index: number) => {
    if (!confirm('Delete this row?')) return;
    const items = data.items.slice();
    items.splice(index, 1);
    setData({ ...data, items });
  };

  const moveRow = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= data.items.length) return;
    const items = data.items.slice();
    const [item] = items.splice(index, 1);
    items.splice(target, 0, item);
    setData({ ...data, items });
  };

  const renderCell = (index: number, field: NonNullable<EditTarget>['field']) => {
    const value = data.items[index][field];
    const isEditing = editing?.index === index && editing.field === field;
    if (isEditing) {
      const isLong = field === 'text';
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
    const display = Array.isArray(value) ? value.join(', ') : value;
    return (
      <div className="editable-cell" style={{ cursor: 'pointer', minHeight: 20, whiteSpace: 'pre-wrap' }}
        onClick={() => startEdit(index, field)}>
        {display || <span style={{ color: '#ccc' }}>(empty)</span>}
      </div>
    );
  };

  return (
    <div className="srs-table-container">
      <div style={{ marginBottom: 10 }}>
        <h2>{data.title || 'Requirements'}</h2>
        <strong>Document:</strong> {data.name}
        <button className="btn btn-success btn-sm" style={{ marginLeft: 20 }} onClick={() => onSave(data)}>
          Save
        </button>
      </div>
      <table className="table table-bordered table-striped">
        <thead>
          <tr>
            <th style={{ width: 110 }}>Code</th>
            <th>Text</th>
            <th style={{ width: 140 }}>Tags</th>
            <th style={{ width: 140 }}>Hazards</th>
            <th style={{ width: 60 }}>Tests</th>
            <th style={{ width: 90 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, index) => (
            <tr key={item.id} className={item.heading ? 'info' : ''}>
              <td>{item.heading ? <em>heading</em> : renderCell(index, 'code')}</td>
              <td style={item.heading ? { fontWeight: 'bold' } : undefined}>{renderCell(index, 'text')}</td>
              <td>{item.heading ? '' : renderCell(index, 'tags')}</td>
              <td>{item.heading ? '' : renderCell(index, 'hazards')}</td>
              <td>{item.heading ? '' : testCounts.get(item.id) ?? 0}</td>
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
    </div>
  );
};

export default SRSTable;
