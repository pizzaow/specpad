/**
 * SRSTable — requirements editor with hierarchy, a per-row hamburger menu,
 * inline test display, and change-tracking redline highlight.
 * Rows are SRS items keyed by stable `id`; `level` is indent depth; heading rows
 * show a derived dotted code. Test counts are computed on read from the VTP.
 */
import React, { useMemo, useState } from 'react';
import type { SrsDoc, SrsItem, VtpDoc, VtpItem } from '../shared';
import { createSrsItem, generateId, ID_PREFIX } from '../shared';
import type { RedlineView, AttributionView } from '../changeTracking';
import { rowStatusClass, isCellChanged } from '../changeTrackingView';
import { deriveHeadingCodes } from '../outline';
import RowMenu from './RowMenu';
import ItemInfo from './ItemInfo';

interface SRSTableProps {
  doc: SrsDoc;
  vtpDoc: VtpDoc | null;
  onSave: (doc: SrsDoc) => void;
  redline?: RedlineView;
  attribution?: Map<string, AttributionView>;
}

type EditField = 'code' | 'text' | 'tags';
type EditTarget = { index: number; field: EditField } | null;

const INDENT_PX = 22;

const SRSTable: React.FC<SRSTableProps> = ({ doc, vtpDoc, onSave, redline, attribution }) => {
  const [data, setData] = useState<SrsDoc>(doc);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [infoIndex, setInfoIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const headingCodes = useMemo(() => deriveHeadingCodes(data.items), [data.items]);

  const testsByReq = useMemo(() => {
    const m = new Map<string, VtpItem[]>();
    for (const t of vtpDoc?.items ?? []) {
      for (const ref of t.verifies ?? []) {
        const list = m.get(ref) ?? [];
        list.push(t);
        m.set(ref, list);
      }
    }
    return m;
  }, [vtpDoc]);

  const ids = () => data.items.map((i) => i.id);
  const update = (items: SrsItem[]) => setData({ ...data, items });

  const startEdit = (index: number, field: EditField) => {
    const value = data.items[index][field];
    setEditing({ index, field });
    setEditValue(Array.isArray(value) ? value.join(', ') : value ?? '');
  };
  const commitEdit = () => {
    if (!editing) return;
    const items = data.items.slice();
    const item: SrsItem = { ...items[editing.index] };
    if (editing.field === 'tags') {
      item.tags = editValue.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      item[editing.field] = editValue;
    }
    items[editing.index] = item;
    update(items);
    setEditing(null);
  };

  const insertAt = (index: number, item: SrsItem) => {
    const items = data.items.slice();
    items.splice(index, 0, item);
    update(items);
  };
  const levelOf = (i: number) => data.items[i].level ?? 0;
  const addAbove = (i: number) => insertAt(i, createSrsItem(ids(), levelOf(i)));
  const addBelow = (i: number) => insertAt(i + 1, createSrsItem(ids(), levelOf(i)));
  const addChild = (i: number) => insertAt(i + 1, createSrsItem(ids(), levelOf(i) + 1));
  const addHeading = (i: number) => {
    const item: SrsItem = { id: generateId(ID_PREFIX.heading, ids()), text: '', heading: true };
    if (levelOf(i) > 0) item.level = levelOf(i);
    insertAt(i + 1, item);
  };
  const setLevel = (i: number, level: number) => {
    const items = data.items.slice();
    const item: SrsItem = { ...items[i] };
    if (level > 0) item.level = level; else delete item.level;
    items[i] = item;
    update(items);
  };
  const indent = (i: number) => setLevel(i, Math.min(levelOf(i) + 1, i > 0 ? levelOf(i - 1) + 1 : 0));
  const outdent = (i: number) => setLevel(i, Math.max(0, levelOf(i) - 1));
  const deleteRow = (i: number) => {
    if (!confirm('Delete this requirement?')) return;
    const items = data.items.slice();
    items.splice(i, 1);
    update(items);
  };
  const toggleTests = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };
  const onDrop = (target: number) => {
    if (dragIndex === null || dragIndex === target) { setDragIndex(null); return; }
    const items = data.items.slice();
    const [moved] = items.splice(dragIndex, 1);
    items.splice(dragIndex < target ? target - 1 : target, 0, moved);
    update(items);
    setDragIndex(null);
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

  const renderCell = (index: number, field: EditField, display?: React.ReactNode) => {
    if (editing?.index === index && editing.field === field) return renderEdit(field);
    const raw = data.items[index][field];
    const shown = display ?? (Array.isArray(raw) ? raw.join(', ') : raw);
    return (
      <div className="editable-cell" style={{ cursor: 'pointer', minHeight: 20, whiteSpace: 'pre-wrap' }}
        onClick={() => startEdit(index, field)}>
        {shown || <span style={{ color: '#ccc' }}>(empty)</span>}
      </div>
    );
  };

  const rl = (id: string) => redline?.byId.get(id);

  return (
    <div className="srs-table-container">
      <div style={{ marginBottom: 10 }}>
        <h2>{data.title || 'Requirements'}</h2>
        <strong>Document:</strong> {data.name}
        <button className="btn btn-success btn-sm" style={{ marginLeft: 20 }} onClick={() => onSave(data)}>Save</button>
      </div>
      <table className="table table-bordered table-striped srs-table">
        <thead>
          <tr>
            <th style={{ width: 160 }}>Code</th>
            <th>Text</th>
            <th style={{ width: 150 }}>Tags</th>
            <th style={{ width: 70 }}>Tests</th>
            <th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, index) => {
            const count = testsByReq.get(item.id)?.length ?? 0;
            const open = expanded.has(item.id);
            return (
              <React.Fragment key={item.id}>
                <tr
                  className={rowStatusClass(item.heading, rl(item.id))}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(index)}
                >
                  <td className={isCellChanged(rl(item.id), 'code') ? 'ct-changed' : undefined}
                    style={{ paddingLeft: 8 + (item.level ?? 0) * INDENT_PX }}>
                    {item.heading
                      ? renderCell(index, 'code', <strong>{headingCodes.get(item.id)}</strong>)
                      : renderCell(index, 'code')}
                  </td>
                  <td className={isCellChanged(rl(item.id), 'text') ? 'ct-changed' : undefined}
                    style={item.heading ? { fontWeight: 'bold' } : undefined}>
                    {renderCell(index, 'text')}
                  </td>
                  <td className={isCellChanged(rl(item.id), 'tags') ? 'ct-changed' : undefined}>
                    {item.heading ? '' : renderCell(index, 'tags')}
                  </td>
                  <td>
                    {item.heading ? '' : (
                      <button type="button" className="btn btn-link btn-xs" aria-label={`Show tests for ${item.id}`}
                        onClick={() => toggleTests(item.id)}>
                        <span>{count}</span> {open ? '▾' : '▸'}
                      </button>
                    )}
                  </td>
                  <td>
                    <RowMenu
                      onAddAbove={() => addAbove(index)}
                      onAddBelow={() => addBelow(index)}
                      onAddChild={() => addChild(index)}
                      onAddHeading={() => addHeading(index)}
                      onIndent={() => indent(index)}
                      onOutdent={() => outdent(index)}
                      onMove={() => undefined}
                      onDelete={() => deleteRow(index)}
                      onViewInfo={() => setInfoIndex(index)}
                      canOutdent={(item.level ?? 0) > 0}
                    />
                  </td>
                </tr>
                {open && !item.heading && (
                  <tr className="srs-tests-row">
                    <td />
                    <td colSpan={4}>
                      {count === 0 ? (
                        <em className="text-muted">No verifying tests.</em>
                      ) : (
                        <ul className="list-unstyled" style={{ marginBottom: 0 }}>
                          {(testsByReq.get(item.id) ?? []).map((t) => (
                            <li key={t.id}>
                              <strong>{t.code || t.id}</strong>: <span>{t.text}</span>
                              {t.expected ? <span className="text-muted"> — expects: {t.expected}</span> : null}
                              {t.result ? <span className={`label label-${t.result === 'passed' ? 'success' : t.result === 'failed' ? 'danger' : 'default'}`} style={{ marginLeft: 6 }}>{t.result}</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
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

      {infoIndex !== null && data.items[infoIndex] && (
        <ItemInfo
          item={data.items[infoIndex]}
          code={data.items[infoIndex].heading ? (headingCodes.get(data.items[infoIndex].id) ?? '') : (data.items[infoIndex].code ?? '')}
          testCount={testsByReq.get(data.items[infoIndex].id)?.length ?? 0}
          attribution={attribution?.get(data.items[infoIndex].id)}
          onClose={() => setInfoIndex(null)}
        />
      )}
    </div>
  );
};

export default SRSTable;
