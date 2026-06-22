/**
 * PrdTable — editor for the optional PRD register (product requirements / user
 * needs). Rows are PRD items keyed by stable `id`; an item carries a lifecycle
 * `status` (proposed | implemented) edited inline, plus code/text/tags and
 * section headings. Shows the same Word-style redline as the SRS table, computed
 * from the latest-release baseline via the shared buildRedlineRows.
 */
import React, { useMemo, useState } from 'react';
import type { PrdDoc, PrdItem, PrdStatus, SrsDoc, SrsItem } from '../shared';
import { createPrdItem, generateId, ID_PREFIX } from '../shared';
import { buildRedlineRows } from '../changeTracking';
import type { RedlineEntry } from '../changeTracking';
import { rowStatusClass, isCellChanged } from '../changeTrackingView';

interface PrdTableProps {
  doc: PrdDoc;
  onChange: (doc: PrdDoc) => void;
  baseline?: PrdDoc | null;
  srs?: SrsDoc | null; // to show each item's downward trace (the requirements that satisfy it)
  readOnly?: boolean;
}

type EditField = 'code' | 'text' | 'tags';
type EditTarget = { index: number; field: EditField } | null;

const PrdTable: React.FC<PrdTableProps> = ({ doc, onChange, baseline, srs, readOnly }) => {
  const [editing, setEditing] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');

  const redlineRows = useMemo(() => buildRedlineRows(baseline ?? null, doc), [baseline, doc]);
  // Downward trace: the software requirements that satisfy each product requirement.
  const satisfiedBy = useMemo(() => {
    const m = new Map<string, SrsItem[]>();
    for (const r of srs?.items ?? []) {
      for (const pid of r.satisfies ?? []) {
        const list = m.get(pid) ?? [];
        list.push(r);
        m.set(pid, list);
      }
    }
    return m;
  }, [srs]);
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    doc.items.forEach((it, i) => m.set(it.id, i));
    return m;
  }, [doc.items]);

  const ids = () => doc.items.map((i) => i.id);
  const update = (items: PrdItem[]) => onChange({ ...doc, items });

  const startEdit = (index: number, field: EditField) => {
    if (readOnly) return;
    const value = doc.items[index][field];
    setEditing({ index, field });
    setEditValue(Array.isArray(value) ? value.join(', ') : value ?? '');
  };
  const commitEdit = () => {
    if (!editing) return;
    const items = doc.items.slice();
    const item: PrdItem = { ...items[editing.index] };
    if (editing.field === 'tags') item.tags = editValue.split(',').map((s) => s.trim()).filter(Boolean);
    else item[editing.field] = editValue;
    items[editing.index] = item;
    update(items);
    setEditing(null);
  };
  const setStatus = (index: number, status: PrdStatus) => {
    const items = doc.items.slice();
    items[index] = { ...items[index], status };
    update(items);
  };
  const addItem = (heading: boolean) => {
    const item = heading
      ? { id: generateId(ID_PREFIX.heading, ids()), text: '', heading: true } as PrdItem
      : createPrdItem(ids());
    update([...doc.items, item]);
  };
  const deleteRow = (i: number) => {
    if (!confirm('Delete this product requirement?')) return;
    const items = doc.items.slice();
    items.splice(i, 1);
    update(items);
  };

  const renderEdit = (field: EditField) => {
    const isLong = field === 'text';
    const common = {
      className: 'form-control',
      value: editValue,
      autoFocus: true,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditValue(e.target.value),
      onBlur: commitEdit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && !isLong) { e.preventDefault(); commitEdit(); }
        if (e.key === 'Escape') setEditing(null);
      },
    };
    return isLong ? <textarea {...common} rows={3} /> : <input type="text" {...common} />;
  };
  const renderCell = (index: number, field: EditField) => {
    if (editing?.index === index && editing.field === field) return renderEdit(field);
    const raw = doc.items[index][field];
    const shown = Array.isArray(raw) ? raw.join(', ') : raw;
    return (
      <div className="editable-cell" style={{ cursor: readOnly ? 'default' : 'pointer', minHeight: 20, whiteSpace: 'pre-wrap' }}
        onClick={() => startEdit(index, field)}>
        {shown || <span style={{ color: '#ccc' }}>(empty)</span>}
      </div>
    );
  };
  const entryFor = (status: 'added' | 'modified' | 'unchanged', changedFields?: string[]): RedlineEntry | undefined => {
    if (status === 'added') return { status: 'added' };
    if (status === 'modified') return { status: 'modified', changedFields };
    return undefined;
  };

  return (
    <div className="srs-table-container">
      <div style={{ marginBottom: 10 }}>
        <h2>{doc.title || 'Product Requirements'}</h2>
        <strong>Document:</strong> {doc.name}
        {!readOnly && (
          <span style={{ marginLeft: 14 }}>
            <button className="btn btn-default btn-xs" onClick={() => addItem(false)}>+ Product requirement</button>{' '}
            <button className="btn btn-default btn-xs" onClick={() => addItem(true)}>+ Section heading</button>
          </span>
        )}
      </div>
      <table className="table table-bordered table-striped prd-table">
        <thead>
          <tr>
            <th style={{ width: 150 }}>Code</th>
            <th>Text</th>
            <th style={{ width: 130 }}>Status</th>
            <th style={{ width: 200 }}>Satisfied by</th>
            <th style={{ width: 130 }}>Tags</th>
            <th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {redlineRows.map((row) => {
            const item = row.item as PrdItem;
            if (row.status === 'removed') {
              return (
                <tr key={`removed-${item.id}`} className="ct-removed-row">
                  <td><del>{item.code || item.id}</del></td>
                  <td colSpan={5}><del>{item.text}</del></td>
                </tr>
              );
            }
            const index = indexById.get(item.id) ?? 0;
            const entry = entryFor(row.status, row.changedFields);
            return (
              <tr key={item.id} className={rowStatusClass(item.heading, entry)}>
                <td className={isCellChanged(entry, 'code') ? 'ct-changed' : undefined}>
                  {item.heading ? renderCell(index, 'code') : renderCell(index, 'code')}
                </td>
                <td className={isCellChanged(entry, 'text') ? 'ct-changed' : undefined}
                  style={item.heading ? { fontWeight: 'bold' } : undefined}>
                  {renderCell(index, 'text')}
                </td>
                <td className={isCellChanged(entry, 'status') ? 'ct-changed' : undefined}>
                  {item.heading ? '' : (
                    <select className="form-control input-sm" aria-label={`Status for ${item.code ?? item.id}`}
                      value={item.status ?? 'proposed'} disabled={readOnly}
                      onChange={(e) => setStatus(index, e.target.value as PrdStatus)}>
                      <option value="proposed">proposed</option>
                      <option value="implemented">implemented</option>
                    </select>
                  )}
                </td>
                <td className="prd-satisfied">
                  {item.heading ? '' : (() => {
                    const reqs = satisfiedBy.get(item.id) ?? [];
                    if (reqs.length) return reqs.map((r) => <span key={r.id} className="label label-default" style={{ marginRight: 4 }}>{r.code ?? r.id}</span>);
                    if ((item.status ?? 'proposed') === 'implemented') return <span className="text-danger" title="implemented but no requirement satisfies it">✗ gap</span>;
                    return <span className="text-muted">— roadmap</span>;
                  })()}
                </td>
                <td className={isCellChanged(entry, 'tags') ? 'ct-changed' : undefined}>
                  {item.heading ? '' : renderCell(index, 'tags')}
                </td>
                <td>
                  {!readOnly && (
                    <button type="button" className="btn btn-link btn-xs text-danger" aria-label={`Delete ${item.id}`}
                      onClick={() => deleteRow(index)}>✕</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PrdTable;
