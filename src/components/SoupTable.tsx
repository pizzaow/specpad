/**
 * SoupTable — the SOUP tab: the third-party software the product depends on.
 *
 * A summary row per component with the identity an auditor checks first, and an
 * expansion holding the assessment: what is required of it, what it needs, what is known
 * to be wrong with it, and what happens when the supplier stops.
 *
 * The state worth surfacing in the row is whether the **anomaly evaluation still applies
 * to the version in use**. It is the field that silently rots — an upgrade invalidates
 * it, and nothing else in the record changes to say so.
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
}

/** Fields whose absence governance reports, in the order the record is read. */
const ASSESSMENT: { key: keyof SoupItem; label: string; hint: string }[] = [
  { key: 'purpose', label: 'Purpose and role', hint: 'What it does here, and why it is appropriate' },
  { key: 'requirements', label: 'Requirements placed on it', hint: 'Functional and performance (IEC 62304 §5.3.3)' },
  { key: 'runtime', label: 'What it needs to run', hint: 'Hardware and software (§5.3.4)' },
  { key: 'limitations', label: 'Design limitations', hint: 'What it is known not to do' },
  { key: 'anomalies', label: 'Published anomalies', hint: 'Evaluated for this version (§7.1.2)' },
  { key: 'maintenance', label: 'Support and end of life', hint: "The supplier's practices, and the plan when they stop" },
];

const SoupTable: React.FC<SoupTableProps> = ({ doc, sddDoc, vtpDoc, riskDoc, onChange, readOnly }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const field = (index: number, key: keyof SoupItem, label: string, rows = 1) => {
    const value = (doc.items[index][key] as string | undefined) ?? '';
    if (readOnly) {
      return value ? <span style={{ whiteSpace: 'pre-wrap' }}>{value}</span> : <em className="text-muted">Not recorded.</em>;
    }
    const common = {
      className: 'form-control',
      'aria-label': `${label} of ${doc.items[index].name || doc.items[index].id}`,
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setField(index, { [key]: e.target.value } as Partial<SoupItem>),
    };
    return rows > 1 ? <textarea {...common} rows={rows} /> : <input type="text" {...common} />;
  };

  const fresh = (level = 0) => createSoupItem(doc.items.map((i) => i.id), level);

  return (
    <div className="soup-table-container">
      <div style={{ marginBottom: 10 }}>
        <h2>{doc.title || 'SOUP'}</h2>
        <strong>Document:</strong> {doc.name}
        <p className="text-muted" style={{ marginTop: 4, marginBottom: 0 }}>
          Third-party software this product depends on, assessed (IEC 62304 SOUP; FDA off-the-shelf
          software). Not a bill of materials: this is the set that has been assessed, not every
          dependency resolved from the manifests.
        </p>
      </div>

      <table className="table table-condensed soup-table">
        <thead>
          <tr>
            <th style={{ width: 90 }}>Code</th>
            <th>Component</th>
            <th style={{ width: 180 }}>Supplier</th>
            <th style={{ width: 150 }}>Version</th>
            <th style={{ width: 150 }}>Anomalies</th>
            <th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, index) => {
            const open = expanded.has(item.id);
            const assessed = !!(item.anomalies ?? '').trim();
            const causes = risksByCause.get(item.id) ?? [];

            const menu = !readOnly && (
              <RowMenu
                noun="component"
                onAddAbove={() => update([...doc.items.slice(0, index), fresh(item.level), ...doc.items.slice(index)])}
                onAddBelow={() => update([...doc.items.slice(0, index + 1), fresh(item.level), ...doc.items.slice(index + 1)])}
                onAddChild={() => update([...doc.items.slice(0, index + 1), fresh((item.level ?? 0) + 1), ...doc.items.slice(index + 1)])}
                onAddHeading={() => update([...doc.items.slice(0, index + 1), { ...fresh(item.level), heading: true, name: 'New group' }, ...doc.items.slice(index + 1)])}
                onIndent={() => setField(index, { level: (item.level ?? 0) + 1 })}
                onOutdent={() => setField(index, { level: Math.max(0, (item.level ?? 0) - 1) })}
                onDelete={() => window.confirm(`Delete "${item.name}"?`) && update(doc.items.filter((i) => i.id !== item.id))}
                onViewInfo={() => toggle(item.id)}
                canOutdent={(item.level ?? 0) > 0}
              />
            );

            if (item.heading) {
              return (
                <tr key={item.id} className="soup-heading-row">
                  <td colSpan={5} style={{ fontWeight: 'bold', paddingLeft: 8 + (item.level ?? 0) * 16 }}>
                    {field(index, 'name', 'Group')}
                  </td>
                  <td>{menu}</td>
                </tr>
              );
            }

            return (
              <React.Fragment key={item.id}>
                <tr>
                  <td style={{ paddingLeft: 8 + (item.level ?? 0) * 16 }}>{field(index, 'code', 'Code')}</td>
                  <td>{field(index, 'name', 'Name')}</td>
                  <td>{field(index, 'vendor', 'Supplier')}</td>
                  <td>{field(index, 'version', 'Version')}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-link btn-xs"
                      aria-label={`Show assessment of ${item.name || item.id}`}
                      onClick={() => toggle(item.id)}
                    >
                      {assessed ? (
                        <span
                          className="label label-success"
                          title={`Evaluated for version ${item.version || '(unrecorded)'}${item.anomaliesReviewed ? ` on ${item.anomaliesReviewed}` : ''}. An upgrade invalidates it.`}
                        >
                          {item.anomaliesReviewed || 'evaluated'}
                        </span>
                      ) : (
                        <span className="label label-danger" title="No evaluation of the supplier's published anomalies (IEC 62304 §7.1.2).">
                          not evaluated
                        </span>
                      )}{' '}
                      {open ? '▾' : '▸'}
                    </button>
                  </td>
                  <td>{menu}</td>
                </tr>

                {open && (
                  <tr className="srs-tests-row">
                    <td />
                    <td colSpan={5}>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span>
                          <strong>Licence:</strong> {readOnly ? item.license || '—' : field(index, 'license', 'Licence')}
                        </span>
                        <span>
                          <strong>Released:</strong> {readOnly ? item.releaseDate || '—' : field(index, 'releaseDate', 'Release date')}
                        </span>
                        <span>
                          <strong>Source:</strong> {readOnly ? item.url || '—' : field(index, 'url', 'URL')}
                        </span>
                      </div>

                      {ASSESSMENT.map(({ key, label, hint }) => (
                        <div key={key} style={{ marginBottom: 8 }}>
                          <strong>{label}</strong>{' '}
                          <span className="text-muted" style={{ fontSize: '0.85em' }}>{hint}</span>
                          <div>{field(index, key, label, 3)}</div>
                          {key === 'anomalies' && (
                            <div style={{ marginTop: 4 }}>
                              <span className="text-muted" style={{ fontSize: '0.85em' }}>
                                Last evaluated (an upgrade makes this stale):
                              </span>{' '}
                              {readOnly ? item.anomaliesReviewed || '—' : field(index, 'anomaliesReviewed', 'Anomalies reviewed')}
                            </div>
                          )}
                        </div>
                      ))}

                      <div style={{ marginBottom: 6 }}>
                        <strong>Used by:</strong>{' '}
                        <RefPicker
                          label={`Units using ${item.name || item.id}`}
                          value={item.usedBy ?? []}
                          options={unitOptions}
                          onChange={(ids) => setField(index, { usedBy: ids })}
                          readOnly={readOnly}
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
                          readOnly={readOnly}
                          empty="No test recorded"
                        />
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
                    </td>
                  </tr>
                )}
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
