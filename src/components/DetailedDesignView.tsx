/**
 * DetailedDesignView — the Detailed Design tab.
 *
 * The SDD is presented as one continuous document, which is how it is read and how it
 * exports. A sticky outline tracks the section in view; editing happens in place on the
 * section you are reading, so there is no document-level edit mode and nothing to scroll
 * back to.
 *
 * Section boundaries are data, not formatting: `SrsItem.design` points at a section id,
 * so a continuous rendering changes presentation only. A `##` inside a body is
 * sub-structure within that section and cannot be traced to.
 *
 * Each section shows the requirements referencing it. Editing one says those
 * requirements are now in question; deleting one names what would be left unresolved
 * (DD-8, DD-13).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SddDoc, SddSection, SrsDoc, SrsItem } from '../shared';
import { createSddSection } from '../shared';
import RowMenu from './RowMenu';
import RefPicker from './RefPicker';
import type { RefOption } from './RefPicker';

interface DetailedDesignViewProps {
  doc: SddDoc | null;
  /** The requirements, so each section can show what points at it. */
  srsDoc?: SrsDoc | null;
  diagrams?: Record<string, string>;
  onChange?: (next: SddDoc) => void;
  /**
   * Writes back to the requirements. The link is stored on the requirement, so linking
   * from a design section edits the SRS — one home per edge, reachable from either end.
   */
  onChangeSrs?: (next: SrsDoc) => void;
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

const label = (s: SddSection) => `${s.code ? `${s.code} · ` : ''}${s.title || '(untitled)'}`;

/** One outline entry. Draggable by its handle so a click still navigates. */
const OutlineEntry: React.FC<{
  section: SddSection;
  active: boolean;
  draggable: boolean;
  onSelect: () => void;
}> = ({ section, active, draggable, onSelect }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: !draggable,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        marginLeft: (section.level ?? 0) * 10,
        display: 'flex',
        alignItems: 'baseline',
        gap: 4,
      }}
    >
      {draggable && (
        <span
          className="dd-drag"
          aria-label={`Reorder ${label(section)}`}
          style={{ cursor: 'grab', color: 'var(--muted, #999)', fontSize: '0.85em' }}
          {...attributes}
          {...listeners}
        >
          ⠿
        </span>
      )}
      <a
        href={`#${section.id}`}
        className={`dd-outline-item${active ? ' active' : ''}`}
        aria-current={active || undefined}
        onClick={(e) => {
          e.preventDefault();
          onSelect();
        }}
        style={{ fontWeight: section.heading ? 'bold' : 'normal', flex: 1, padding: '2px 0' }}
      >
        {label(section)}
      </a>
    </li>
  );
};

const DetailedDesignView: React.FC<DetailedDesignViewProps> = ({
  doc,
  srsDoc,
  diagrams,
  onChange,
  onChangeSrs,
  readOnly,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());

  const refs = useMemo(() => referencesBySection(srsDoc), [srsDoc]);
  const srsOptions: RefOption[] = useMemo(
    () => (srsDoc?.items ?? []).filter((i) => !i.heading).map((i) => ({ id: i.id, code: i.code, text: i.text })),
    [srsDoc],
  );

  /**
   * Set which requirements a section implements, by editing each requirement's `design`.
   * Adding here is identical to adding from the requirement's own row.
   */
  const setImplementers = (sectionId: string, requirementIds: string[]) => {
    if (!srsDoc || !onChangeSrs) return;
    const wanted = new Set(requirementIds);
    onChangeSrs({
      ...srsDoc,
      items: srsDoc.items.map((req) => {
        if (req.heading) return req;
        const linked = (req.design ?? []).includes(sectionId);
        if (wanted.has(req.id) && !linked) return { ...req, design: [...(req.design ?? []), sectionId] };
        if (!wanted.has(req.id) && linked) return { ...req, design: (req.design ?? []).filter((d) => d !== sectionId) };
        return req;
      }),
    });
  };
  const sections = doc?.items ?? [];
  const canEdit = !readOnly && !!onChange;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Track which section is in view so the outline follows the reader (scrollspy).
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 },
    );
    for (const node of nodes.current.values()) observer.observe(node);
    return () => observer.disconnect();
  }, [sections.length]);

  if (!doc) {
    return <div className="alert alert-info">No detailed design for this project.</div>;
  }

  const update = (id: string, patch: Partial<SddSection>) =>
    onChange?.({ ...doc, items: sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  const insertAt = (at: number, heading: boolean, level = 0) => {
    const fresh = createSddSection(sections.map((s) => s.id), level);
    const next: SddSection = heading
      ? { id: fresh.id, title: 'New group', heading: true, ...(level ? { level } : {}) }
      : { ...fresh, title: 'New section' };
    onChange?.({ ...doc, items: [...sections.slice(0, at), next, ...sections.slice(at)] });
    setEditingId(next.id);
  };

  const remove = (section: SddSection) => {
    const referencing = refs.get(section.id) ?? [];
    const warning = referencing.length
      ? `${referencing.length} requirement(s) reference this section (${referencing
          .map((r) => r.code ?? r.id)
          .join(', ')}). Deleting it will leave those references unresolved.\n\nDelete anyway?`
      : `Delete "${section.title}"?`;
    if (!window.confirm(warning)) return;
    onChange?.({ ...doc, items: sections.filter((s) => s.id !== section.id) });
    if (editingId === section.id) setEditingId(null);
  };

  const nudge = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= sections.length) return;
    const items = [...sections];
    const [moved] = items.splice(index, 1);
    items.splice(to, 0, moved);
    onChange?.({ ...doc, items });
  };

  const setLevel = (section: SddSection, delta: number) =>
    update(section.id, { level: Math.max(0, (section.level ?? 0) + delta) });

  const scrollTo = (id: string) => {
    setActiveId(id);
    nodes.current.get(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    const items = [...sections];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    onChange?.({ ...doc, items });
  };

  return (
    <div className="dd-view" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <nav
        className="dd-outline"
        aria-label="Design sections"
        style={{ flex: '0 0 240px', position: 'sticky', top: 8, maxHeight: '80vh', overflowY: 'auto' }}
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {sections.map((s) => (
                <OutlineEntry
                  key={s.id}
                  section={s}
                  active={s.id === activeId}
                  draggable={canEdit}
                  onSelect={() => scrollTo(s.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        {canEdit && (
          <button
            type="button"
            className="btn btn-default btn-xs"
            style={{ marginTop: 10 }}
            onClick={() => insertAt(sections.length, false)}
          >
            Add section
          </button>
        )}
      </nav>

      <article className="dd-doc" style={{ flex: 1, minWidth: 0 }}>
        {sections.length === 0 && <p className="text-muted">This detailed design has no sections yet.</p>}

        {sections.map((section, index) => {
          const referencing = refs.get(section.id) ?? [];
          const editing = editingId === section.id;
          const menu = canEdit && (
            <RowMenu
              noun="section"
              infoLabel="Edit section"
              onAddAbove={() => insertAt(index, false, section.level)}
              onAddBelow={() => insertAt(index + 1, false, section.level)}
              onAddChild={() => insertAt(index + 1, false, (section.level ?? 0) + 1)}
              onAddHeading={() => insertAt(index + 1, true, section.level)}
              onIndent={() => setLevel(section, 1)}
              onOutdent={() => setLevel(section, -1)}
              onDelete={() => remove(section)}
              onViewInfo={() => setEditingId(editing ? null : section.id)}
              canOutdent={(section.level ?? 0) > 0}
            />
          );

          if (section.heading) {
            return (
              <section
                key={section.id}
                id={section.id}
                ref={(el) => { if (el) nodes.current.set(section.id, el); else nodes.current.delete(section.id); }}
                className="dd-group"
                style={{ marginTop: index === 0 ? 0 : 28 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ flex: 1, margin: 0, fontSize: '1.3em' }}>
                    {editing ? (
                      <input
                        className="form-control"
                        aria-label="Group title"
                        value={section.title}
                        autoFocus
                        onChange={(e) => update(section.id, { title: e.target.value })}
                        onBlur={() => setEditingId(null)}
                      />
                    ) : (
                      <span
                        onClick={() => canEdit && setEditingId(section.id)}
                        style={{ cursor: canEdit ? 'text' : 'default' }}
                      >
                        {section.title || <span className="text-muted">(untitled group)</span>}
                      </span>
                    )}
                  </h2>
                  {menu}
                </div>
                <hr style={{ marginTop: 6 }} />
              </section>
            );
          }

          return (
            <section
              key={section.id}
              id={section.id}
              ref={(el) => { if (el) nodes.current.set(section.id, el); else nodes.current.delete(section.id); }}
              className={`dd-section${activeId === section.id ? ' active' : ''}`}
              style={{ marginTop: 20, marginLeft: (section.level ?? 0) * 16, scrollMarginTop: 12 }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <h3 style={{ flex: 1, margin: 0, fontSize: '1.1em' }}>
                  {editing ? (
                    <span style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="form-control"
                        aria-label="Section code"
                        placeholder="Code"
                        style={{ flex: '0 0 140px' }}
                        value={section.code ?? ''}
                        onChange={(e) => update(section.id, { code: e.target.value })}
                      />
                      <input
                        className="form-control"
                        aria-label="Section title"
                        placeholder="Title — the unit or design view"
                        style={{ flex: 1 }}
                        value={section.title}
                        onChange={(e) => update(section.id, { title: e.target.value })}
                      />
                    </span>
                  ) : (
                    label(section)
                  )}
                </h3>
                {menu}
              </div>

              {editing ? (
                <input
                  className="form-control"
                  aria-label="Source paths"
                  placeholder="Source paths, comma separated"
                  style={{ margin: '6px 0' }}
                  value={(section.source ?? []).join(', ')}
                  onChange={(e) =>
                    update(section.id, {
                      source: e.target.value.split(',').map((p) => p.trim()).filter(Boolean),
                    })
                  }
                />
              ) : (
                (section.source ?? []).length > 0 && (
                  <p className="text-muted" style={{ margin: '2px 0' }}>
                    {(section.source ?? []).map((p) => (
                      <code key={p} style={{ marginRight: 8 }}>{p}</code>
                    ))}
                  </p>
                )
              )}

              <div className="dd-refs" style={{ margin: '4px 0 8px' }}>
                <strong>Implements:</strong>{' '}
                <RefPicker
                  label={`Requirements implemented by ${label(section)}`}
                  value={referencing.map((r) => r.id)}
                  options={srsOptions}
                  onChange={(ids) => setImplementers(section.id, ids)}
                  readOnly={readOnly || !onChangeSrs}
                  empty="No requirement references this section yet."
                />
              </div>

              {editing && referencing.length > 0 && (
                <div className="alert alert-warning" style={{ padding: '6px 10px' }}>
                  <strong>{referencing.length} requirement(s) reference this section.</strong> Changing
                  it puts each of them in question — re-check them in this same job:{' '}
                  {referencing.map((r) => r.code ?? r.id).join(', ')}
                </div>
              )}

              {editing ? (
                <>
                  <CodeMirror
                    value={section.body ?? ''}
                    height="320px"
                    extensions={[markdown()]}
                    onChange={(v) => update(section.id, { body: v })}
                  />
                  <div style={{ marginTop: 6 }}>
                    <button type="button" className="btn btn-default btn-xs" onClick={() => setEditingId(null)}>
                      Done
                    </button>{' '}
                    <button type="button" className="btn btn-default btn-xs" onClick={() => nudge(index, -1)}>
                      Move up
                    </button>{' '}
                    <button type="button" className="btn btn-default btn-xs" onClick={() => nudge(index, 1)}>
                      Move down
                    </button>
                  </div>
                </>
              ) : (
                <div
                  onClick={() => canEdit && setEditingId(section.id)}
                  style={{ cursor: canEdit ? 'text' : 'default' }}
                >
                  {section.body ? (
                    <Markdown md={section.body} diagrams={diagrams} />
                  ) : (
                    <p className="text-muted">This section has no content yet.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </article>
    </div>
  );
};

export default DetailedDesignView;
