/**
 * ReferenceTable — the References tab: the controlled documents this project relies on
 * but does not hold.
 *
 * Planning, maintenance and problem resolution are required by IEC 62304 and live, in most
 * organisations, in a quality system or an issue tracker. SpecPad names and locates them
 * rather than modelling them, so this view is deliberately plain: what it is, where it is,
 * who owns it, and which clauses stop being SpecPad's problem because of it.
 *
 * The register is meant to stay short, so the view does nothing to encourage length.
 */
import React from 'react';
import type { ReferenceDoc, ReferenceItem } from '../shared';
import { createReferenceItem } from '../shared';
import RowMenu from './RowMenu';

interface ReferenceTableProps {
  doc: ReferenceDoc;
  onChange: (doc: ReferenceDoc) => void;
  readOnly?: boolean;
}

const KINDS: { value: ReferenceItem['kind']; label: string }[] = [
  { value: 'sop', label: 'SOP' },
  { value: 'plan', label: 'Plan' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'tracker', label: 'Tracker' },
  { value: 'record', label: 'Record' },
  { value: 'standard', label: 'Standard' },
  { value: 'other', label: 'Other' },
];

const ReferenceTable: React.FC<ReferenceTableProps> = ({ doc, onChange, readOnly }) => {
  const items = doc.items ?? [];
  const ids = items.map((i) => i.id);

  const update = (id: string, patch: Partial<ReferenceItem>) =>
    onChange({ ...doc, items: items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  const insertAt = (index: number, level = 0, heading = false) => {
    const item = createReferenceItem(ids, level);
    if (heading) { item.heading = true; item.title = 'New group'; }
    const next = [...items];
    next.splice(index, 0, item);
    onChange({ ...doc, items: next });
  };

  const remove = (item: ReferenceItem) => {
    if (!window.confirm(`Delete "${item.title || 'this reference'}"?`)) return;
    onChange({ ...doc, items: items.filter((i) => i.id !== item.id) });
  };

  const menu = (item: ReferenceItem, index: number) => (
    <RowMenu
      noun="reference"
      onAddAbove={() => insertAt(index, item.level)}
      onAddBelow={() => insertAt(index + 1, item.level)}
      onAddChild={() => insertAt(index + 1, (item.level ?? 0) + 1)}
      onAddHeading={() => insertAt(index + 1, item.level, true)}
      onIndent={() => update(item.id, { level: (item.level ?? 0) + 1 })}
      onOutdent={() => update(item.id, { level: Math.max(0, (item.level ?? 0) - 1) })}
      onDelete={() => remove(item)}
      onViewInfo={() => undefined}
      canOutdent={(item.level ?? 0) > 0}
    />
  );

  const field = (item: ReferenceItem, key: keyof ReferenceItem, placeholder: string) => (
    <input
      className="form-control input-sm"
      value={(item[key] as string) ?? ''}
      placeholder={placeholder}
      disabled={readOnly}
      onChange={(e) => update(item.id, { [key]: e.target.value } as Partial<ReferenceItem>)}
    />
  );

  return (
    <div>
      <p className="text-muted" style={{ marginBottom: 12 }}>
        The documents this project depends on but does not hold — planning, maintenance and problem
        resolution (IEC 62304 §5.1, clause 6, clause 9). An entry earns its place by discharging a
        clause; a register listing the whole quality system buries the entries that mattered.
      </p>
      {items.length === 0 && (
        <p className="text-muted">
          <em>No references. A project holding all of its own procedures needs none.</em>
        </p>
      )}
      <table className="table table-condensed">
        <thead>
          <tr>
            <th style={{ width: '9%' }}>Code</th>
            <th style={{ width: '24%' }}>Document</th>
            <th style={{ width: '9%' }}>Kind</th>
            <th style={{ width: '15%' }}>Identifier</th>
            <th style={{ width: '17%' }}>Location</th>
            <th style={{ width: '11%' }}>Owner</th>
            <th style={{ width: '15%' }}>Covers</th>
            {!readOnly && <th style={{ width: 30 }} />}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) =>
            item.heading ? (
              <tr key={item.id} className="info">
                <td colSpan={7}>
                  <strong>{field(item, 'title', 'Section heading')}</strong>
                </td>
                {!readOnly && (
                  <td>
                    {menu(item, index)}
                  </td>
                )}
              </tr>
            ) : (
              <tr key={item.id}>
                <td>{field(item, 'code', 'REF-1')}</td>
                <td>{field(item, 'title', 'Software Problem Resolution Procedure')}</td>
                <td>
                  <select
                    className="form-control input-sm"
                    value={item.kind ?? ''}
                    disabled={readOnly}
                    onChange={(e) => update(item.id, { kind: (e.target.value || undefined) as ReferenceItem['kind'] })}
                  >
                    <option value="">—</option>
                    {KINDS.map((k) => (
                      <option key={k.value} value={k.value}>{k.label}</option>
                    ))}
                  </select>
                </td>
                <td>{field(item, 'identifier', 'SOP-012 rev C')}</td>
                <td>{field(item, 'location', 'https://qms…')}</td>
                <td>{field(item, 'owner', 'Quality')}</td>
                <td>
                  <input
                    className="form-control input-sm"
                    value={(item.covers ?? []).join(', ')}
                    placeholder="IEC 62304 clause 9"
                    disabled={readOnly}
                    onChange={(e) =>
                      update(item.id, {
                        covers: e.target.value.split(',').map((c) => c.trim()).filter(Boolean),
                      })
                    }
                  />
                </td>
                {!readOnly && (
                  <td>
                    {menu(item, index)}
                  </td>
                )}
              </tr>
            ),
          )}
        </tbody>
      </table>
      {!readOnly && (
        <button className="btn btn-default btn-sm" onClick={() => insertAt(items.length)}>
          Add reference
        </button>
      )}
    </div>
  );
};

export default ReferenceTable;
