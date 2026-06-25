/**
 * PrdTable — editor for the optional PRD register (product requirements / user
 * needs). Rows are PRD items keyed by stable `id`, with the same hierarchy, row
 * hamburger, and Word-style redline as the SRS table. Product requirements are
 * assumed *implemented*; the lifecycle `status` is surfaced only when an item is
 * still **proposed** (a bold red note under its code + italicised text), so the
 * table reads as the ratified product baseline. The "Satisfied by" column mirrors
 * the SRS "Tests" column: a count that expands to the requirements that satisfy it.
 */
import React, { useMemo, useState } from 'react';
import type { PrdDoc, PrdItem, SrsDoc, SrsItem } from '../shared';
import { createPrdItem, generateId, ID_PREFIX } from '../shared';
import type { AttributionView, RedlineEntry } from '../changeTracking';
import { buildRedlineRows } from '../changeTracking';
import { rowStatusClass, isCellChanged } from '../changeTrackingView';
import { deriveHeadingCodes } from '../outline';
import RowMenu from './RowMenu';
import ItemInfo from './ItemInfo';

interface PrdTableProps {
  doc: PrdDoc;
  onChange: (doc: PrdDoc) => void;
  baseline?: PrdDoc | null;
  srs?: SrsDoc | null; // to show each item's downward trace (the requirements that satisfy it)
  attribution?: Map<string, AttributionView>;
  readOnly?: boolean;
}

type EditField = 'code' | 'text';
type EditTarget = { index: number; field: EditField } | null;

const INDENT_PX = 22;

const PrdTable: React.FC<PrdTableProps> = ({ doc, onChange, baseline, srs, attribution, readOnly }) => {
  const [editing, setEditing] = useState<EditTarget>(null);
  const [editValue, setEditValue] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [infoIndex, setInfoIndex] = useState<number | null>(null);

  const headingCodes = useMemo(() => deriveHeadingCodes(doc.items), [doc.items]);
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
    setEditing({ index, field });
    setEditValue(doc.items[index][field] ?? '');
  };
  const commitEdit = () => {
    if (!editing) return;
    const items = doc.items.slice();
    items[editing.index] = { ...items[editing.index], [editing.field]: editValue };
    update(items);
    setEditing(null);
  };

  const insertAt = (index: number, item: PrdItem) => {
    const items = doc.items.slice();
    items.splice(index, 0, item);
    update(items);
  };
  const levelOf = (i: number) => doc.items[i].level ?? 0;
  const addAbove = (i: number) => insertAt(i, createPrdItem(ids(), levelOf(i)));
  const addBelow = (i: number) => insertAt(i + 1, createPrdItem(ids(), levelOf(i)));
  const addChild = (i: number) => insertAt(i + 1, createPrdItem(ids(), levelOf(i) + 1));
  const addHeading = (i: number) => {
    const item: PrdItem = { id: generateId(ID_PREFIX.heading, ids()), text: '', heading: true };
    if (levelOf(i) > 0) item.level = levelOf(i);
    insertAt(i + 1, item);
  };
  const setLevel = (i: number, level: number) => {
    const items = doc.items.slice();
    const item: PrdItem = { ...items[i] };
    if (level > 0) item.level = level; else delete item.level;
    items[i] = item;
    update(items);
  };
  const indent = (i: number) => setLevel(i, Math.min(levelOf(i) + 1, i > 0 ? levelOf(i - 1) + 1 : 0));
  const outdent = (i: number) => setLevel(i, Math.max(0, levelOf(i) - 1));
  const deleteRow = (i: number) => {
    if (!confirm('Delete this product requirement?')) return;
    const items = doc.items.slice();
    items.splice(i, 1);
    update(items);
  };
  const toggleSat = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
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
    const shown = display ?? doc.items[index][field];
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
  const isProposed = (item: PrdItem) => (item.status ?? 'proposed') === 'proposed';

  return (
    <div className="srs-table-container">
      <div style={{ marginBottom: 10 }}>
        <h2>{doc.title || 'Product Requirements'}</h2>
        <strong>Document:</strong> {doc.name}
        {!readOnly && doc.items.length === 0 && (
          <span style={{ marginLeft: 14 }}>
            <button className="btn btn-default btn-xs" onClick={() => update([createPrdItem(ids())])}>+ Product requirement</button>
          </span>
        )}
      </div>
      <table className="table table-bordered table-striped prd-table">
        <thead>
          <tr>
            <th style={{ width: 160 }}>Code</th>
            <th>Text</th>
            <th style={{ width: 90 }}>Satisfied by</th>
            <th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {redlineRows.map((row) => {
            const item = row.item as PrdItem;
            if (row.status === 'removed') {
              return (
                <tr key={`removed-${item.id}`} className="ct-removed-row">
                  <td style={{ paddingLeft: 8 + (item.level ?? 0) * INDENT_PX }}><del>{item.code || item.id}</del></td>
                  <td colSpan={3}><del>{item.text}</del></td>
                </tr>
              );
            }
            const index = indexById.get(item.id) ?? 0;
            const entry = entryFor(row.status, row.changedFields);
            const reqs = satisfiedBy.get(item.id) ?? [];
            const open = expanded.has(item.id);
            const proposed = !item.heading && isProposed(item);
            const gap = !item.heading && !proposed && reqs.length === 0; // implemented but unsatisfied
            return (
              <React.Fragment key={item.id}>
                <tr className={rowStatusClass(item.heading, entry)}>
                  <td className={isCellChanged(entry, 'code') ? 'ct-changed' : undefined}
                    style={{ paddingLeft: 8 + (item.level ?? 0) * INDENT_PX }}>
                    {item.heading
                      ? renderCell(index, 'code', <strong>{headingCodes.get(item.id)}</strong>)
                      : renderCell(index, 'code')}
                    {proposed && <div><strong className="text-danger" style={{ fontSize: 11, letterSpacing: 0.3 }}>PROPOSED</strong></div>}
                  </td>
                  <td className={isCellChanged(entry, 'text') ? 'ct-changed' : undefined}
                    style={item.heading ? { fontWeight: 'bold' } : proposed ? { fontStyle: 'italic' } : undefined}>
                    {renderCell(index, 'text')}
                  </td>
                  <td>
                    {item.heading ? '' : (
                      <button type="button" className={`btn btn-link btn-xs${gap ? ' text-danger' : ''}`} aria-label={`Show requirements satisfying ${item.id}`}
                        onClick={() => toggleSat(item.id)}>
                        <span>{gap ? '✗' : reqs.length}</span> {open ? '▾' : '▸'}
                      </button>
                    )}
                  </td>
                  <td>
                    {!readOnly && (
                      <RowMenu
                        noun="product requirement"
                        onAddAbove={() => addAbove(index)}
                        onAddBelow={() => addBelow(index)}
                        onAddChild={() => addChild(index)}
                        onAddHeading={() => addHeading(index)}
                        onIndent={() => indent(index)}
                        onOutdent={() => outdent(index)}
                        onDelete={() => deleteRow(index)}
                        onViewInfo={() => setInfoIndex(index)}
                        canOutdent={(item.level ?? 0) > 0}
                      />
                    )}
                  </td>
                </tr>
                {open && !item.heading && (
                  <tr className="srs-tests-row">
                    <td />
                    <td colSpan={3}>
                      {reqs.length ? (
                        <ul className="list-unstyled" style={{ marginBottom: 0 }}>
                          {reqs.map((r) => (
                            <li key={r.id}><strong>{r.code || r.id}</strong>: <span>{r.text}</span></li>
                          ))}
                        </ul>
                      ) : proposed ? (
                        <em className="text-muted">Proposed — no requirement satisfies it yet (roadmap).</em>
                      ) : (
                        <em className="text-danger">Implemented but no requirement satisfies it — traceability gap.</em>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {infoIndex !== null && doc.items[infoIndex] && (() => {
        const it = doc.items[infoIndex];
        const reqs = satisfiedBy.get(it.id) ?? [];
        return (
          <ItemInfo
            item={it}
            noun="Product requirement"
            code={it.heading ? (headingCodes.get(it.id) ?? '') : (it.code ?? '')}
            rows={[
              { label: 'Status', value: it.status ?? 'proposed' },
              { label: 'Satisfied by', value: reqs.length ? reqs.map((r) => r.code || r.id).join(', ') : <span className="text-muted">(none)</span> },
            ]}
            attribution={attribution?.get(it.id)}
            onClose={() => setInfoIndex(null)}
          />
        );
      })()}
    </div>
  );
};

export default PrdTable;
