/**
 * DetailedDesignView — the Detailed Design tab: the SDD's sections, with Display and
 * Edit sub-tabs (the same shape as the Architecture tab).
 *
 *  - Display: renders the section's markdown body, with `![alt](name.svg)` resolved
 *    inline from the loaded diagram map, exactly as the arc42 document does.
 *  - Edit: CodeMirror for the body, plus the section's title, code and source paths.
 *
 * The panel that matters most is neither of those: every section shows **which
 * requirements reference it**. That is the re-review rule made visible — changing a
 * section puts each of those requirements in question, and you cannot act on that if
 * you cannot see them (DD-8).
 */
import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import type { SddDoc, SddSection, SrsDoc, SrsItem } from '../shared';
import { createSddSection } from '../shared';

interface DetailedDesignViewProps {
  doc: SddDoc | null;
  /** The requirements, so each section can show what points at it. */
  srsDoc?: SrsDoc | null;
  diagrams?: Record<string, string>;
  onChange?: (next: SddDoc) => void;
  readOnly?: boolean;
}

const Markdown: React.FC<{ md: string; diagrams?: Record<string, string> }> = ({ md, diagrams }) => (
  <div className="markdown-body">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        img: ({ src, alt }) => {
          const svg = src ? diagrams?.[src] : undefined;
          if (svg) {
            return (
              <span
                className="arch-diagram"
                role="img"
                aria-label={alt}
                style={{ display: 'block', overflow: 'auto', margin: '10px 0' }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            );
          }
          return <span className="text-muted">[diagram: {src}]</span>;
        },
      }}
    >
      {md}
    </ReactMarkdown>
  </div>
);

/** Requirements referencing each section id — derived on read, never stored. */
function referencesBySection(srsDoc: SrsDoc | null | undefined): Map<string, SrsItem[]> {
  const map = new Map<string, SrsItem[]>();
  for (const req of srsDoc?.items ?? []) {
    if (req.heading) continue;
    for (const id of req.design ?? []) {
      const list = map.get(id);
      if (list) list.push(req);
      else map.set(id, [req]);
    }
  }
  return map;
}

const DetailedDesignView: React.FC<DetailedDesignViewProps> = ({
  doc,
  srsDoc,
  diagrams,
  onChange,
  readOnly,
}) => {
  const [mode, setMode] = useState<'display' | 'edit'>('display');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refs = useMemo(() => referencesBySection(srsDoc), [srsDoc]);
  const sections = doc?.items ?? [];
  const selected = sections.find((s) => s.id === selectedId) ?? sections.find((s) => !s.heading) ?? null;
  const canEdit = !readOnly && !!onChange;

  if (!doc) {
    return <div className="alert alert-info">No detailed design for this project.</div>;
  }

  const update = (id: string, patch: Partial<SddSection>) => {
    onChange?.({ ...doc, items: sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  };

  const addSection = (heading: boolean) => {
    const section = createSddSection(sections.map((s) => s.id));
    const next: SddSection = heading
      ? { id: section.id, title: 'New group', heading: true }
      : { ...section, title: 'New section' };
    const at = selected ? sections.findIndex((s) => s.id === selected.id) + 1 : sections.length;
    const items = [...sections.slice(0, at), next, ...sections.slice(at)];
    onChange?.({ ...doc, items });
    setSelectedId(next.id);
  };

  const removeSection = (section: SddSection) => {
    const referencing = refs.get(section.id) ?? [];
    // Deleting a referenced section is the one action that genuinely breaks a trace, so
    // it names the requirements that would be left dangling rather than just asking.
    const warning = referencing.length
      ? `${referencing.length} requirement(s) reference this section (${referencing
          .map((r) => r.code ?? r.id)
          .join(', ')}). Deleting it will leave those references unresolved.\n\nDelete anyway?`
      : `Delete "${section.title}"?`;
    if (!window.confirm(warning)) return;
    onChange?.({ ...doc, items: sections.filter((s) => s.id !== section.id) });
    setSelectedId(null);
  };

  const move = (section: SddSection, delta: number) => {
    const from = sections.findIndex((s) => s.id === section.id);
    const to = from + delta;
    if (to < 0 || to >= sections.length) return;
    const items = [...sections];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    onChange?.({ ...doc, items });
  };

  const referencing = selected ? refs.get(selected.id) ?? [] : [];

  return (
    <div className="dd-view">
      {canEdit && (
        <ul className="nav nav-pills arch-subtabs" style={{ marginBottom: 12 }}>
          {(['display', 'edit'] as const).map((m) => (
            <li
              key={m}
              className={m === mode ? 'active' : ''}
              style={{ display: 'inline-block', marginRight: 6 }}
            >
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setMode(m);
                }}
                style={{ fontWeight: m === mode ? 'bold' : 'normal' }}
              >
                {m === 'display' ? 'Display' : 'Edit'}
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="dd-layout" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <nav className="dd-outline" aria-label="Design sections" style={{ flex: '0 0 260px' }}>
          <ul className="dd-outline-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {sections.map((s) => (
              <li key={s.id} style={{ marginLeft: (s.level ?? 0) * 10 }}>
                <a
                  href="#"
                  className={s.id === selected?.id ? 'dd-outline-item active' : 'dd-outline-item'}
                  aria-current={s.id === selected?.id || undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedId(s.id);
                  }}
                  style={{ fontWeight: s.heading ? 'bold' : 'normal', display: 'block', padding: '2px 0' }}
                >
                  {s.code ? `${s.code} · ` : ''}
                  {s.title || <span className="text-muted">(untitled)</span>}
                </a>
              </li>
            ))}
          </ul>
          {mode === 'edit' && canEdit && (
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn btn-default btn-xs" onClick={() => addSection(false)}>
                Add section
              </button>{' '}
              <button type="button" className="btn btn-default btn-xs" onClick={() => addSection(true)}>
                Add group
              </button>
            </div>
          )}
        </nav>

        <section className="dd-section" style={{ flex: 1, minWidth: 0 }}>
          {!selected ? (
            <p className="text-muted">This detailed design has no sections yet.</p>
          ) : mode === 'edit' && canEdit ? (
            <div className="dd-edit">
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  className="form-control"
                  aria-label="Section code"
                  placeholder="Code (e.g. SDD-12)"
                  style={{ flex: '0 0 160px' }}
                  value={selected.code ?? ''}
                  onChange={(e) => update(selected.id, { code: e.target.value })}
                />
                <input
                  className="form-control"
                  aria-label="Section title"
                  placeholder="Title — the unit or design view"
                  style={{ flex: 1 }}
                  value={selected.title}
                  onChange={(e) => update(selected.id, { title: e.target.value })}
                />
              </div>
              <input
                className="form-control"
                aria-label="Source paths"
                placeholder="Source paths, comma separated (e.g. src/shared/merge.ts)"
                style={{ marginBottom: 8 }}
                value={(selected.source ?? []).join(', ')}
                onChange={(e) =>
                  update(selected.id, {
                    source: e.target.value
                      .split(',')
                      .map((p) => p.trim())
                      .filter(Boolean),
                  })
                }
              />

              {referencing.length > 0 && (
                <div className="alert alert-warning" style={{ padding: '6px 10px' }}>
                  <strong>{referencing.length} requirement(s) reference this section.</strong> Changing
                  it puts each of them in question — re-check them in this same job:{' '}
                  {referencing.map((r) => r.code ?? r.id).join(', ')}
                </div>
              )}

              {!selected.heading && (
                <CodeMirror
                  value={selected.body ?? ''}
                  height="380px"
                  extensions={[markdown()]}
                  onChange={(v) => update(selected.id, { body: v })}
                />
              )}

              <div style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-default btn-xs" onClick={() => move(selected, -1)}>
                  Move up
                </button>{' '}
                <button type="button" className="btn btn-default btn-xs" onClick={() => move(selected, 1)}>
                  Move down
                </button>{' '}
                <button type="button" className="btn btn-danger btn-xs" onClick={() => removeSection(selected)}>
                  Delete section
                </button>
              </div>
              <p className="text-muted" style={{ marginTop: 8 }}>
                Place diagrams with <code>![caption](name.svg)</code>; author them in draw.io and drop in
                the SVG export. Renaming or rewriting a section never breaks a reference — the link is on
                its identity, not its title.
              </p>
            </div>
          ) : (
            <div className="dd-display">
              <h3 style={{ marginTop: 0 }}>
                {selected.code ? `${selected.code} · ` : ''}
                {selected.title}
              </h3>

              {(selected.source ?? []).length > 0 && (
                <p className="text-muted" style={{ marginTop: -4 }}>
                  {(selected.source ?? []).map((p) => (
                    <code key={p} style={{ marginRight: 8 }}>
                      {p}
                    </code>
                  ))}
                </p>
              )}

              <div className="dd-refs" style={{ marginBottom: 10 }}>
                {referencing.length > 0 ? (
                  <span>
                    <strong>Implements:</strong>{' '}
                    {referencing.map((r) => (
                      <span key={r.id} className="label label-default" style={{ marginRight: 4 }}>
                        {r.code ?? r.id}
                      </span>
                    ))}
                  </span>
                ) : (
                  !selected.heading && (
                    <span className="text-muted">
                      No requirement references this section yet.
                    </span>
                  )
                )}
              </div>

              {selected.body ? (
                <Markdown md={selected.body} diagrams={diagrams} />
              ) : (
                !selected.heading && <p className="text-muted">This section has no content yet.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default DetailedDesignView;
