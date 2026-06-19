/**
 * ArchitectureView — the Architecture tab. Renders the arc42 software architecture
 * document (markdown) and presents the C4 model (Structurizr DSL). The DSL is the
 * authoring source of truth; live in-editor C4 diagram rendering is a planned
 * follow-up, so for now the model is shown as code with a link out to Structurizr.
 */
import React from 'react';

interface ArchitectureViewProps {
  sad: string | null;
  dsl: string | null;
  guide?: string | null;
}

const clean = (s: string) => s.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1');

/** Minimal arc42-markdown block renderer (headings, lists, blockquotes, paragraphs). */
function renderMarkdown(md: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let list: string[] | null = null;
  let para: string[] = [];
  let key = 0;
  const flushPara = () => { if (para.length) { out.push(<p key={key++}>{clean(para.join(' '))}</p>); para = []; } };
  const flushList = () => {
    if (list) { const items = list; out.push(<ul key={key++}>{items.map((t, i) => <li key={i}>{clean(t)}</li>)}</ul>); list = null; }
  };
  for (const raw of md.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (/^#\s/.test(line)) { flushPara(); flushList(); out.push(<h3 key={key++}>{clean(line.slice(2))}</h3>); }
    else if (/^##\s/.test(line)) { flushPara(); flushList(); out.push(<h4 key={key++}>{clean(line.slice(3))}</h4>); }
    else if (/^###\s/.test(line)) { flushPara(); flushList(); out.push(<h5 key={key++}>{clean(line.slice(4))}</h5>); }
    else if (/^>\s/.test(line)) { flushPara(); flushList(); out.push(<blockquote key={key++} className="text-muted">{clean(line.slice(2))}</blockquote>); }
    else if (/^[-*]\s/.test(line)) { flushPara(); (list ??= []).push(line.slice(2)); }
    else if (line.trim() === '') { flushPara(); flushList(); }
    else { flushList(); para.push(line); }
  }
  flushPara(); flushList();
  return out;
}

const ArchitectureView: React.FC<ArchitectureViewProps> = ({ sad, dsl, guide }) => {
  if (!sad && !dsl) {
    return <div className="alert alert-info">No architecture document for this project.</div>;
  }
  return (
    <div className="architecture-view">
      {guide && (
        <details className="arch-guide" style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer' }}>Authoring guide</summary>
          <div className="text-muted" style={{ marginTop: 6 }}>{renderMarkdown(guide)}</div>
        </details>
      )}
      {sad ? <div className="arch-doc">{renderMarkdown(sad)}</div> : <p className="text-muted">No arc42 document.</p>}
      <h4 style={{ marginTop: 24 }}>C4 model (Structurizr DSL)</h4>
      {dsl ? (
        <>
          <p className="text-muted">
            Render with <a href="https://structurizr.com/dsl" target="_blank" rel="noreferrer">Structurizr</a>.
            {' '}In-editor diagram rendering is planned.
          </p>
          <pre style={{ maxHeight: 420, overflow: 'auto' }}>{dsl}</pre>
        </>
      ) : (
        <p className="text-muted">No C4 model.</p>
      )}
    </div>
  );
};

export default ArchitectureView;
