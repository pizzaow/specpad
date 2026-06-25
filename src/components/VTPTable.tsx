/**
 * VTPTable — v1 verification-tests editor (the test *plan*, not the results).
 * `verifies` holds SRS item *ids*; like the SRS "Tests" column it shows as a count
 * that expands to the verified requirements (with each ref's human label, flagging
 * refs that don't resolve). Hierarchy + row actions mirror the SRS table (the row
 * hamburger). Execution results live on the Results tab, and per-item history lives
 * in the info dialog — neither is shown here, so this view stays the plan of record.
 */
import React, { useMemo, useState } from 'react';
import type { SrsDoc, VtpDoc, VtpItem } from '../shared';
import { createVtpItem, generateId, ID_PREFIX } from '../shared';
import type { RedlineView, AttributionView } from '../changeTracking';
import { rowStatusClass, isCellChanged } from '../changeTrackingView';
import { deriveHeadingCodes } from '../outline';
import RowMenu from './RowMenu';
import ItemInfo from './ItemInfo';

interface VTPTableProps {
  doc: VtpDoc;
  srsDoc: SrsDoc | null;
  onChange: (doc: VtpDoc) => void;
  redline?: RedlineView;
  attribution?: Map<string, AttributionView>;
}

type EditField = 'code' | 'text' | 'verifies' | 'expected';
type EditTarget = { index: number; field: EditField } | null;

const INDENT_PX = 22;

const VTPTable: React.FC<VTPTableProps> = ({ doc, srsDoc, onChange, redline, attribution }) => {
  const data = doc;
  const update = (items: VtpItem[]) => onChange({ ...doc, items });
  const [editing, setEditing] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [infoIndex, setInfoIndex] = useState<number | null>(null);

  const headingCodes = useMemo(() => deriveHeadingCodes(data.items), [data.items]);
  const srsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of srsDoc?.items ?? []) map.set(item.id, item.code || item.text || item.id);
    return map;
  }, [srsDoc]);

  const ids = () => data.items.map((i) => i.id);

  const startEdit = (index: number, field: EditField) => {
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

  const insertAt = (index: number, item: VtpItem) => {
    const items = data.items.slice();
    items.splice(index, 0, item);
    update(items);
  };
  const levelOf = (i: number) => data.items[i].level ?? 0;
  const addAbove = (i: number) => insertAt(i, createVtpItem(ids()));
  const addBelow = (i: number) => insertAt(i + 1, createVtpItem(ids()));
  const addChild = (i: number) => {
    const item = createVtpItem(ids());
    item.level = levelOf(i) + 1;
    insertAt(i + 1, item);
  };
  const addHeading = (i: number) => {
    const item: VtpItem = { id: generateId(ID_PREFIX.heading, ids()), text: '', heading: true };
    if (levelOf(i) > 0) item.level = levelOf(i);
    insertAt(i + 1, item);
  };
  const setLevel = (i: number, level: number) => {
    const items = data.items.slice();
    const item: VtpItem = { ...items[i] };
    if (level > 0) item.level = level; else delete item.level;
    items[i] = item;
    update(items);
  };
  const indent = (i: number) => setLevel(i, Math.min(levelOf(i) + 1, i > 0 ? levelOf(i - 1) + 1 : 0));
  const outdent = (i: number) => setLevel(i, Math.max(0, levelOf(i) - 1));
  const deleteRow = (index: number) => {
    if (!confirm('Delete this test?')) return;
    const items = data.items.slice();
    items.splice(index, 1);
    update(items);
  };
  const toggleVerifies = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const renderEditField = (field: EditField) => {
    const isLong = field === 'text' || field === 'expected';
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
  const renderCell = (index: number, field: EditField, display?: React.ReactNode) => {
    if (editing?.index === index && editing.field === field) return renderEditField(field);
    const raw = data.items[index][field];
    const shown = display ?? (Array.isArray(raw) ? raw.join(', ') : raw);
    return (
      <div className="editable-cell" style={{ cursor: 'pointer', minHeight: 20, whiteSpace: 'pre-wrap' }} onClick={() => startEdit(index, field)}>
        {shown || <span style={{ color: '#ccc' }}>(empty)</span>}
      </div>
    );
  };

  const rowHasBadRef = (item: VtpItem) => (item.verifies ?? []).some((ref) => !srsById.has(ref));

  return (
    <div className="vtp-table-container">
      <div style={{ marginBottom: 10 }}>
        <h2>{data.title || 'Verification Tests'}</h2>
        <strong>Document:</strong> {data.name}
        {data.items.length === 0 && (
          <span style={{ marginLeft: 14 }}>
            <button className="btn btn-default btn-xs" onClick={() => update([createVtpItem(ids())])}>+ Test</button>
          </span>
        )}
      </div>
      <table className="table table-bordered table-striped vtp-table">
        <thead>
          <tr>
            <th style={{ width: 120 }}>Code</th>
            <th>Text</th>
            <th style={{ width: 80 }}>Verifies</th>
            <th style={{ width: 220 }}>Expected</th>
            <th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, index) => {
            const bad = !!srsDoc && rowHasBadRef(item);
            const entry = redline?.byId.get(item.id);
            const refs = item.verifies ?? [];
            const open = expanded.has(item.id);
            if (item.heading) {
              return (
                <tr key={item.id} className={rowStatusClass(true, entry)}>
                  <td style={{ paddingLeft: 8 + (item.level ?? 0) * INDENT_PX }}><strong>{headingCodes.get(item.id)}</strong></td>
                  <td colSpan={2} style={{ fontWeight: 'bold' }}>{renderCell(index, 'text')}</td>
                  <td />
                  <td>
                    <RowMenu noun="test"
                      onAddAbove={() => addAbove(index)} onAddBelow={() => addBelow(index)} onAddChild={() => addChild(index)}
                      onAddHeading={() => addHeading(index)} onIndent={() => indent(index)} onOutdent={() => outdent(index)}
                      onDelete={() => deleteRow(index)} onViewInfo={() => setInfoIndex(index)} canOutdent={(item.level ?? 0) > 0} />
                  </td>
                </tr>
              );
            }
            return (
              <React.Fragment key={item.id}>
                <tr className={bad ? 'danger' : rowStatusClass(false, entry)}>
                  <td className={isCellChanged(entry, 'code') ? 'ct-changed' : undefined}
                    style={{ paddingLeft: 8 + (item.level ?? 0) * INDENT_PX }}>{renderCell(index, 'code')}</td>
                  <td className={isCellChanged(entry, 'text') ? 'ct-changed' : undefined}>{renderCell(index, 'text')}</td>
                  <td className={isCellChanged(entry, 'verifies') ? 'ct-changed' : undefined}>
                    <button type="button" className={`btn btn-link btn-xs${bad ? ' text-danger' : ''}`} aria-label={`Show requirements verified by ${item.id}`}
                      onClick={() => toggleVerifies(item.id)}>
                      <span>{bad ? '✗ ' : ''}{refs.length}</span> {open ? '▾' : '▸'}
                    </button>
                  </td>
                  <td className={isCellChanged(entry, 'expected') ? 'ct-changed' : undefined}>{renderCell(index, 'expected')}</td>
                  <td>
                    <RowMenu noun="test"
                      onAddAbove={() => addAbove(index)} onAddBelow={() => addBelow(index)} onAddChild={() => addChild(index)}
                      onAddHeading={() => addHeading(index)} onIndent={() => indent(index)} onOutdent={() => outdent(index)}
                      onDelete={() => deleteRow(index)} onViewInfo={() => setInfoIndex(index)} canOutdent={(item.level ?? 0) > 0} />
                  </td>
                </tr>
                {open && (
                  <tr className="srs-tests-row">
                    <td />
                    <td colSpan={4}>
                      <div style={{ marginBottom: 4 }}>
                        {refs.length === 0
                          ? <em className="text-muted">Verifies no requirement.</em>
                          : refs.map((ref) => (
                            <span key={ref} className={`label ${srsById.has(ref) ? 'label-default' : 'label-danger'}`} style={{ marginRight: 4 }}>
                              {srsById.get(ref) ?? `${ref} (missing)`}
                            </span>
                          ))}
                      </div>
                      {editing?.index === index && editing.field === 'verifies'
                        ? renderEditField('verifies')
                        : <button type="button" className="btn btn-default btn-xs" onClick={() => startEdit(index, 'verifies')}>Edit verified requirements</button>}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
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

      {infoIndex !== null && data.items[infoIndex] && (() => {
        const it = data.items[infoIndex];
        const refs = (it.verifies ?? []).map((ref) => srsById.get(ref) ?? `${ref} (missing)`);
        return (
          <ItemInfo
            item={it}
            noun="Test"
            code={it.heading ? (headingCodes.get(it.id) ?? '') : (it.code ?? '')}
            rows={[
              { label: 'Verifies', value: refs.length ? refs.join(', ') : <span className="text-muted">(none)</span> },
              { label: 'Expected', value: it.expected || <span className="text-muted">(none)</span> },
              { label: 'Notes', value: it.notes || <span className="text-muted">(none)</span> },
            ]}
            attribution={attribution?.get(it.id)}
            onClose={() => setInfoIndex(null)}
          />
        );
      })()}
    </div>
  );
};

export default VTPTable;
