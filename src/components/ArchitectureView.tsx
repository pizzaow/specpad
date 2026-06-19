/**
 * ArchitectureView — the Architecture tab, with Edit and Display sub-tabs.
 *  - Display: renders the arc42 markdown to HTML (react-markdown), shows the diagram
 *    (a draw.io SVG export, rendered inline), the C4 source, and the authoring guide.
 *  - Edit: a syntax-highlighting CodeMirror editor for the arc42 markdown and the C4
 *    source; diagrams are authored externally (draw.io) and dropped in as SVG.
 * The web tool is a pseudo-render; formal Word output is produced by the skill export.
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
  diagramSvg?: string | null;
  onChangeSad?: (next: string) => void;
  onChangeDsl?: (next: string) => void;
  readOnly?: boolean;
}

const Markdown: React.FC<{ md: string }> = ({ md }) => (
  <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown></div>
);

const ArchitectureView: React.FC<ArchitectureViewProps> = ({
  sad, dsl, guide, diagramSvg, onChangeSad, onChangeDsl, readOnly,
}) => {
  const [mode, setMode] = useState<'display' | 'edit'>('display');

  if (!sad && !dsl) {
    return <div className="alert alert-info">No architecture document for this project.</div>;
  }

  const canEdit = !readOnly && (onChangeSad || onChangeDsl);

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
          <CodeMirror value={sad ?? ''} height="360px" extensions={[markdown()]}
            onChange={(v) => onChangeSad?.(v)} />
          <h4 style={{ marginTop: 16 }}>C4 model (Structurizr DSL)</h4>
          <CodeMirror value={dsl ?? ''} height="240px" onChange={(v) => onChangeDsl?.(v)} />
          <p className="text-muted" style={{ marginTop: 8 }}>
            Diagrams are authored in draw.io and dropped in as an SVG export; the Display tab renders them.
          </p>
        </div>
      ) : (
        <div className="arch-display">
          {guide && (
            <details className="arch-guide" style={{ marginBottom: 12 }}>
              <summary style={{ cursor: 'pointer' }}>Authoring guide</summary>
              <div className="text-muted" style={{ marginTop: 6 }}>{guide && <Markdown md={guide} />}</div>
            </details>
          )}
          {sad ? <Markdown md={sad} /> : <p className="text-muted">No arc42 document.</p>}

          {diagramSvg && (
            <>
              <h4 style={{ marginTop: 20 }}>Diagram</h4>
              <div className="arch-diagram" style={{ overflow: 'auto', border: '1px solid #eee', padding: 8 }}
                dangerouslySetInnerHTML={{ __html: diagramSvg }} />
            </>
          )}

          <h4 style={{ marginTop: 20 }}>C4 model (Structurizr DSL)</h4>
          {dsl ? (
            <>
              <p className="text-muted">
                Render with <a href="https://structurizr.com/dsl" target="_blank" rel="noreferrer">Structurizr</a>,
                {' '}or author diagrams in draw.io and drop in the SVG.
              </p>
              <pre style={{ maxHeight: 420, overflow: 'auto' }}>{dsl}</pre>
            </>
          ) : (
            <p className="text-muted">No C4 model.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ArchitectureView;
