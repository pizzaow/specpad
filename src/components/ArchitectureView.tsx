/**
 * ArchitectureView — the Architecture tab, with Edit and Display sub-tabs.
 *  - Display: renders the arc42 markdown to HTML (react-markdown). The MARKDOWN
 *    defines where diagrams go: each `![alt](name.svg)` is rendered inline from the
 *    loaded diagram map (draw.io SVG exports). Shows the authoring guide, and the
 *    optional C4 Structurizr source only when present.
 *  - Edit: a syntax-highlighting CodeMirror editor for the arc42 markdown (and the
 *    C4 source if the project uses one). Diagrams are authored externally (draw.io).
 * The web tool is a pseudo-render; formal Word output comes from the skill export.
 */
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';

interface ArchitectureViewProps {
  sad: string | null;
  dsl: string | null;
  guide?: string | null;
  diagrams?: Record<string, string>;
  onChangeSad?: (next: string) => void;
  onChangeDsl?: (next: string) => void;
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
              <span className="arch-diagram" role="img" aria-label={alt}
                style={{ display: 'block', overflow: 'auto', margin: '10px 0' }}
                dangerouslySetInnerHTML={{ __html: svg }} />
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

const ArchitectureView: React.FC<ArchitectureViewProps> = ({
  sad, dsl, guide, diagrams, onChangeSad, onChangeDsl, readOnly,
}) => {
  const [mode, setMode] = useState<'display' | 'edit'>('display');

  if (!sad && !dsl) {
    return <div className="alert alert-info">No architecture document for this project.</div>;
  }

  const canEdit = !readOnly && !!(onChangeSad || onChangeDsl);

  return (
    <div className="architecture-view">
      {canEdit && (
        <ul className="nav nav-pills arch-subtabs" style={{ marginBottom: 12 }}>
          {(['display', 'edit'] as const).map((m) => (
            <li key={m} className={m === mode ? 'active' : ''} style={{ display: 'inline-block', marginRight: 6 }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setMode(m); }}
                 style={{ fontWeight: m === mode ? 'bold' : 'normal' }}>
                {m === 'display' ? 'Display' : 'Edit'}
              </a>
            </li>
          ))}
        </ul>
      )}

      {mode === 'edit' && canEdit ? (
        <div className="arch-edit">
          <h4>arc42 document (Markdown)</h4>
          <CodeMirror value={sad ?? ''} height="420px" extensions={[markdown()]}
            onChange={(v) => onChangeSad?.(v)} />
          <p className="text-muted" style={{ marginTop: 8 }}>
            Place diagrams with <code>![caption](name.svg)</code>; author them in draw.io and drop in the SVG export.
          </p>
          {dsl !== null && (
            <>
              <h4 style={{ marginTop: 16 }}>C4 model (Structurizr DSL — optional)</h4>
              <CodeMirror value={dsl ?? ''} height="240px" onChange={(v) => onChangeDsl?.(v)} />
            </>
          )}
        </div>
      ) : (
        <div className="arch-display">
          {guide && (
            <details className="arch-guide" style={{ marginBottom: 12 }}>
              <summary style={{ cursor: 'pointer' }}>Authoring guide</summary>
              <div className="text-muted" style={{ marginTop: 6 }}><Markdown md={guide} /></div>
            </details>
          )}
          {sad ? <Markdown md={sad} diagrams={diagrams} /> : <p className="text-muted">No arc42 document.</p>}

          {dsl && (
            <>
              <h4 style={{ marginTop: 20 }}>C4 model (Structurizr DSL — optional)</h4>
              <p className="text-muted">
                Render with <a href="https://structurizr.com/dsl" target="_blank" rel="noreferrer">Structurizr</a>.
              </p>
              <pre style={{ maxHeight: 420, overflow: 'auto' }}>{dsl}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ArchitectureView;
