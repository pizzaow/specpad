/**
 * SoupTable — the SOUP tab: the third-party software the product depends on.
 *
 * Display first. A component reads as a record: identity on the row, the assessment
 * beneath it as prose. Clicking a component opens the **whole** record for editing —
 * every field at once, including the two that are not worth the space when reading
 * (release date and source URL) — rather than editing one cell at a time.
 *
 * The row carries the end-of-life date, and marks it when it has passed. A component
 * whose supplier stopped supporting it is the thing this register exists to surface, and
 * it is invisible in prose.
 */
import React, { useMemo, useState } from 'react';
import type { RiskDoc, SddDoc, SoupDoc, SoupItem, VtpDoc } from '../shared';
import { createSoupItem } from '../shared';
import RowMenu from './RowMenu';
import RefPicker from './RefPicker';
import type { RefOption } from './RefPicker';

interface SoupTableProps {
  doc: SoupDoc;
  sddDoc?: SddDoc | null;
  vtpDoc?: VtpDoc | null;
  /** So a component can show the risks it is named as causing (§7.1.2). */
  riskDoc?: RiskDoc | null;
  onChange: (doc: SoupDoc) => void;
  readOnly?: boolean;
  /** Today, injectable so the end-of-life comparison is testable. */
  today?: string;
}

/** The prose fields, in the order the record reads. */
const ASSESSMENT: { key: keyof SoupItem; label: string; hint: string }[] = [
  { key: 'purpose', label: 'Purpose and role', hint: 'What it does here, and why it is appropriate' },
  { key: 'requirements', label: 'Requirements placed on it', hint: 'Functional and performance (IEC 62304 §5.3.3)' },
  { key: 'runtime', label: 'What it needs to run', hint: 'Hardware and software (§5.3.4)' },
  { key: 'limitations', label: 'Design limitations', hint: 'What it is known not to do' },
  { key: 'maintenance', label: 'Support and contingency', hint: "The supplier's practices, and the plan when support ends" },
];

/** Identity fields, shown as inputs only while editing. */
const IDENTITY: { key: keyof SoupItem; label: string; editOnly?: boolean }[] = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Name' },
  { key: 'vendor', label: 'Supplier' },
  { key: 'version', label: 'Version' },
  { key: 'license', label: 'Licence' },
  { key: 'endOfLife', label: 'End of life' },
  { key: 'endOfLifeSource', label: 'End-of-life source' },
  { key: 'releaseDate', label: 'Release date', editOnly: true },
  { key: 'url', label: 'Source', editOnly: true },
];

const SoupTable: React.FC<SoupTableProps> = ({
  doc, sddDoc, vtpDoc, riskDoc, onChange, readOnly, today,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const now = today ?? new Date().toISOString().slice(0, 10);

  const update = (items: SoupItem[]) => onChange({ ...doc, items });
  const setField = (index: number, patch: Partial<SoupItem>) => {
    const items = doc.items.slice();
    items[index] = { ...items[index], ...patch };
    update(items);
  };

  const unitOptions: RefOption[] = useMemo(
    () =>
      (sddDoc?.items ?? [])
        .filter((s) => !s.heading && (s.kind ?? 'unit') === 'unit')
        .map((s) => ({ id: s.id, code: s.code, text: s.title })),
    [sddDoc],
  );
  const testOptions: RefOption[] = useMemo(
    () => (vtpDoc?.items ?? []).filter((t) => !t.heading).map((t) => ({ id: t.id, code: t.code, text: t.text })),
    [vtpDoc],
  );
  const risksByCause = useMemo(() => {
    const map = new Map<string, RiskDoc['items']>();
    for (const risk of riskDoc?.items ?? []) {
      if (risk.heading) continue;
      for (const id of risk.causes ?? []) {
        const list = map.get(id);
        if (list) list.push(risk);
        else map.set(id, [risk]);
      }
    }
    return map;
  }, [riskDoc]);

  const fresh = (level = 0) => createSoupItem(doc.items.map((i) => i.id), level);
  const open = (id: string) => {
    if (!readOnly) setEditingId(id);
  };

  /** An end-of-life date that has passed is the point of recording one. */
  const expired = (item: SoupItem) => !!item.endOfLife && item.endOfLife < now;

  const input = (index: number, key: keyof SoupItem, label: string, rows = 1) => {
    const item = doc.items[index];
    const common = {
      className: 'form-control',
      'aria-label': `${label} of ${item.name || item.id}`,
      value: (item[key] as string | undefined) ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setField(index, { [key]: e.target.value } as Partial<SoupItem>),
    };
    return rows > 1 ? <textarea {...common} rows={rows} /> : <input type="text" {...common} />;
  };

  const prose = (value: string | undefined) =>
    value ? <span style={{ whiteSpace: 'pre-wrap' }}>{value}</span> : <em className="text-muted">Not recorded.</em>;

  return (
    <div className="soup-table-container">
      <div style={{ marginBottom: 10 }}>
        <h2>{doc.title || 'SOUP'}</h2>
        <strong>Document:</strong> {doc.name}
        <p className="text-muted" style={{ marginTop: 4, marginBottom: 0 }}>
          Third-party software this product depends on, assessed (IEC 62304 SOUP; FDA off-the-shelf
          software). Not a bill of materials: this is the set that has been assessed, not every
          dependency resolved from the manifests. {!readOnly && 'Click a component to edit its record.'}
        </p>
      </div>

      <table className="table table-condensed soup-table">
        <thead>
          <tr>
            <th style={{ width: 90 }}>Code</th>
            <th>Component</th>
            <th style={{ width: 200 }}>Supplier</th>
            <th style={{ width: 130 }}>Version</th>
            <th style={{ width: 110 }}>Licence</th>
            <th style={{ width: 140 }}>End of life</th>
            <th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, index) => {
            const editing = editingId === item.id;
            const causes = risksByCause.get(item.id) ?? [];

            const menu = !readOnly && (
              <RowMenu
                noun="component"
                infoLabel="Edit record"
                onAddAbove={() => update([...doc.items.slice(0, index), fresh(item.level), ...doc.items.slice(index)])}
                onAddBelow={() => update([...doc.items.slice(0, index + 1), fresh(item.level), ...doc.items.slice(index + 1)])}
                onAddChild={() => update([...doc.items.slice(0, index + 1), fresh((item.level ?? 0) + 1), ...doc.items.slice(index + 1)])}
                onAddHeading={() => update([...doc.items.slice(0, index + 1), { ...fresh(item.level), heading: true, name: 'New group' }, ...doc.items.slice(index + 1)])}
                onIndent={() => setField(index, { level: (item.level ?? 0) + 1 })}
                onOutdent={() => setField(index, { level: Math.max(0, (item.level ?? 0) - 1) })}
                onDelete={() => window.confirm(`Delete "${item.name}"?`) && update(doc.items.filter((i) => i.id !== item.id))}
                onViewInfo={() => setEditingId(editing ? null : item.id)}
                canOutdent={(item.level ?? 0) > 0}
              />
            );

            if (item.heading) {
              return (
                <tr key={item.id} className="soup-heading-row">
                  <td colSpan={6} style={{ fontWeight: 'bold', paddingLeft: 8 + (item.level ?? 0) * 16 }}>
                    {editing ? input(index, 'name', 'Group') : (
                      <span onClick={() => open(item.id)} style={{ cursor: readOnly ? 'default' : 'pointer' }}>
                        {item.name}
                      </span>
                    )}
                  </td>
                  <td>{menu}</td>
                </tr>
              );
            }

            const clickable = {
              onClick: () => open(item.id),
              style: { cursor: readOnly ? 'default' : 'pointer' as const },
            };

            return (
              <React.Fragment key={item.id}>
                <tr className={expired(item) ? 'warning' : undefined}>
                  <td
                    onClick={clickable.onClick}
                    style={{ ...clickable.style, paddingLeft: 8 + (item.level ?? 0) * 16 }}
                  >
                    {item.code}
                  </td>
                  <td {...clickable}><strong>{item.name}</strong></td>
                  <td {...clickable}>{item.vendor || <span className="text-danger">—</span>}</td>
                  <td {...clickable}><code>{item.version || <span className="text-danger">—</span>}</code></td>
                  <td {...clickable}>{item.license || '—'}</td>
                  <td {...clickable}>
                    {item.endOfLife ? (
                      <span
                        className={expired(item) ? 'label label-danger' : 'label label-default'}
                        title={
                          expired(item)
                            ? `Support ended ${item.endOfLife}. This component is no longer maintained.`
                            : `Support ends ${item.endOfLife}.`
                        }
                      >
                        {expired(item) ? `ended ${item.endOfLife}` : item.endOfLife}
                      </span>
                    ) : (
                      <span className="text-muted">none announced</span>
                    )}
                  </td>
                  <td>{menu}</td>
                </tr>

                <tr className="soup-detail-row">
                  <td />
                  <td colSpan={6}>
                    {editing ? (
                      <div className="soup-edit">
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          {IDENTITY.map(({ key, label }) => (
                            <label key={key} style={{ display: 'block', flex: '1 1 180px', fontWeight: 'normal' }}>
                              <span className="text-muted" style={{ fontSize: '0.85em' }}>{label}</span>
                              {input(index, key, label)}
                            </label>
                          ))}
                        </div>

                        {ASSESSMENT.map(({ key, label, hint }) => (
                          <div key={key} style={{ marginBottom: 8 }}>
                            <strong>{label}</strong>{' '}
                            <span className="text-muted" style={{ fontSize: '0.85em' }}>{hint}</span>
                            {input(index, key, label, 3)}
                          </div>
                        ))}

                        <div style={{ marginBottom: 6 }}>
                          <strong>Used by:</strong>{' '}
                          <RefPicker
                            label={`Units using ${item.name || item.id}`}
                            value={item.usedBy ?? []}
                            options={unitOptions}
                            onChange={(ids) => setField(index, { usedBy: ids })}
                            empty="No unit recorded"
                          />
                        </div>
                        <div style={{ marginBottom: 6 }}>
                          <strong>Exercised by:</strong>{' '}
                          <RefPicker
                            label={`Tests exercising ${item.name || item.id}`}
                            value={item.tests ?? []}
                            options={testOptions}
                            onChange={(ids) => setField(index, { tests: ids })}
                            empty="No test recorded"
                          />
                        </div>

                        <button type="button" className="btn btn-default btn-xs" onClick={() => setEditingId(null)}>
                          Done
                        </button>
                      </div>
                    ) : (
                      <div className="soup-display" {...clickable}>
                        {ASSESSMENT.map(({ key, label }) => (
                          <div key={key} style={{ marginBottom: 6 }}>
                            <strong>{label}:</strong> {prose(item[key] as string | undefined)}
                          </div>
                        ))}

                        <div style={{ marginBottom: 4 }}>
                          <strong>Used by:</strong>{' '}
                          {(item.usedBy ?? []).length === 0 ? (
                            <span className="text-muted">No unit recorded.</span>
                          ) : (
                            (item.usedBy ?? []).map((id) => {
                              const unit = unitOptions.find((o) => o.id === id);
                              return (
                                <span key={id} className="label label-default" style={{ marginRight: 4 }}>
                                  {unit ? unit.code ?? unit.text : `${id} (unresolved)`}
                                </span>
                              );
                            })
                          )}
                        </div>

                        <div>
                          <strong>Named as causing:</strong>{' '}
                          {causes.length === 0 ? (
                            <span className="text-muted">No risk names this component as a cause.</span>
                          ) : (
                            causes.map((r) => (
                              <span key={r.id} className="label label-warning" style={{ marginRight: 4 }}>
                                {r.code ?? r.id}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {!readOnly && doc.items.length === 0 && (
        <button className="btn btn-default btn-xs" onClick={() => update([fresh()])}>+ Component</button>
      )}
    </div>
  );
};

export default SoupTable;
