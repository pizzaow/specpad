/**
 * SecurityView — the Security tab: the security architecture document.
 *
 * Prose plus diagrams, with Display and Edit sub-views, the same treatment the arc42
 * document gets. It is a separate document from the architecture deliberately, so it can
 * be exported as the submission artefact it is; the cost is that two documents describe
 * one system, which the header states rather than leaves for a reviewer to discover.
 */
import React, { useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import Markdown from './Markdown';

interface SecurityViewProps {
  sec: string | null;
  diagrams?: Record<string, string>;
  onChange?: (next: string) => void;
  readOnly?: boolean;
}

const SecurityView: React.FC<SecurityViewProps> = ({ sec, diagrams, onChange, readOnly }) => {
  const [mode, setMode] = useState<'display' | 'edit'>('display');
  const canEdit = !readOnly && !!onChange;

  if (sec === null) {
    return <div className="alert alert-info">No security architecture document for this project.</div>;
  }

  return (
    <div className="security-view">
      {canEdit && (
        <ul className="nav nav-pills arch-subtabs" style={{ marginBottom: 12 }}>
          {(['display', 'edit'] as const).map((m) => (
            <li key={m} className={m === mode ? 'active' : ''} style={{ display: 'inline-block', marginRight: 6 }}>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setMode(m); }}
                style={{ fontWeight: m === mode ? 'bold' : 'normal' }}
              >
                {m === 'display' ? 'Display' : 'Edit'}
              </a>
            </li>
          ))}
        </ul>
      )}

      {mode === 'edit' && canEdit ? (
        <div className="security-edit">
          <h4>Security architecture (Markdown)</h4>
          <CodeMirror value={sec} height="480px" extensions={[markdown()]} onChange={(v) => onChange?.(v)} />
          <p className="text-muted" style={{ marginTop: 8 }}>
            Four views are expected: global system, multi-patient harm, updateability and
            patchability, and security use cases. Place diagrams with <code>![caption](name.svg)</code>.
          </p>
        </div>
      ) : (
        <Markdown md={sec} diagrams={diagrams} />
      )}
    </div>
  );
};

export default SecurityView;
