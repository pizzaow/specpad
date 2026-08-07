/**
 * CommitDialog — publish this user's pending changes as one git commit (CMT-3, CMT-7).
 *
 * Shows what is about to be published at *item* level ("REQ-14 modified"), not file
 * level, plus the governance result, before anything is committed. When the server
 * refuses — a blocked gate, or a merge conflict a human must settle — the refusal is
 * rendered here rather than thrown away, because it is the thing the user has to act on.
 */
import React, { useState } from 'react';
import type { ServerStatus, CommitResult, ServerConflict, PendingChange } from '../fileApi';

interface CommitDialogProps {
  status: ServerStatus;
  branch: string;
  activeJobLabel?: string | null;
  onCommit: (message: string) => Promise<CommitResult>;
  onDiscard: () => Promise<void>;
  onClose: () => void;
  /** Called after a successful commit so the shell can refresh. */
  onCommitted: () => void;
}

const CommitDialog: React.FC<CommitDialogProps> = ({
  status,
  branch,
  activeJobLabel,
  onCommit,
  onDiscard,
  onClose,
  onCommitted,
}) => {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changes = status.diff ?? [];
  const canCommit = message.trim().length > 0 && status.dirty && !busy;

  const handleCommit = async () => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await onCommit(message.trim());
      setResult(outcome);
      if (outcome.ok) onCommitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = async () => {
    if (!window.confirm('Discard all your uncommitted changes? This cannot be undone.')) return;
    setBusy(true);
    setError(null);
    try {
      await onDiscard();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (result?.ok) {
    return (
      <Modal title="Committed" onClose={onClose}>
        <div className="alert alert-success" role="status">
          Your changes were published to <code>{branch}</code>
          {result.commit ? <> as <code>{result.commit.slice(0, 8)}</code></> : null}.
        </div>
        <button className="btn btn-primary" onClick={onClose}>Close</button>
      </Modal>
    );
  }

  return (
    <Modal title="Commit changes" onClose={onClose}>
      {!status.dirty ? (
        <p className="text-muted">You have no uncommitted changes.</p>
      ) : (
        <>
          <p className="text-muted" style={{ marginBottom: 6 }}>
            Publishing to <code>{branch}</code>
            {activeJobLabel ? <> · job <strong>{activeJobLabel}</strong></> : null}
          </p>

          <ChangeSummary changes={changes} />

          <div className="form-group" style={{ marginTop: 12 }}>
            <label htmlFor="commit-message">Describe this change</label>
            <textarea
              id="commit-message"
              className="form-control"
              rows={3}
              autoFocus
              value={message}
              placeholder="e.g. Clarify the data-retention requirement and its expected result"
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </>
      )}

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {result && !result.ok && <Refusal result={result} />}

      <div style={{ marginTop: 12 }}>
        <button className="btn btn-primary" disabled={!canCommit} onClick={handleCommit}>
          {busy ? 'Committing…' : 'Commit'}
        </button>
        <button className="btn btn-default" style={{ marginLeft: 8 }} onClick={onClose} disabled={busy}>
          Cancel
        </button>
        {status.dirty && (
          <button
            className="btn btn-link pull-right"
            style={{ color: '#a94442' }}
            onClick={handleDiscard}
            disabled={busy}
          >
            Discard my changes
          </button>
        )}
      </div>
    </Modal>
  );
};

/** What is about to be published, at item level where we can say it (CMT-7). */
const ChangeSummary: React.FC<{ changes: PendingChange[] }> = ({ changes }) => {
  if (changes.length === 0) return null;
  return (
    <ul className="list-unstyled commit-changes" style={{ marginBottom: 0 }}>
      {changes.map((change) => (
        <li key={change.path} style={{ marginBottom: 4 }}>
          <code>{basename(change.path)}</code>{' '}
          {change.kind === 'register' ? (
            <Counts change={change} />
          ) : (
            <span className="text-muted">changed</span>
          )}
        </li>
      ))}
    </ul>
  );
};

const Counts: React.FC<{ change: PendingChange }> = ({ change }) => {
  const parts: React.ReactNode[] = [];
  const push = (labels: string[] | undefined, verb: string, className: string) => {
    if (!labels || labels.length === 0) return;
    parts.push(
      <span key={verb} className={className} style={{ marginRight: 8 }}>
        {labels.length} {verb}: {labels.slice(0, 6).join(', ')}
        {labels.length > 6 ? `, +${labels.length - 6} more` : ''}
      </span>,
    );
  };
  push(change.added, 'added', 'text-success');
  push(change.modified, 'modified', 'text-primary');
  push(change.removed, 'removed', 'text-danger');
  if (parts.length === 0) return <span className="text-muted">changed</span>;
  return <>{parts}</>;
};

/** A refused commit: a blocked gate, unresolvable conflicts, or a plain message. */
const Refusal: React.FC<{ result: CommitResult }> = ({ result }) => (
  <>
    {result.gate && result.gate.blocked.length > 0 && (
      <div className="alert alert-danger">
        <strong>This change can't be committed yet:</strong>
        <ul style={{ marginBottom: 0, marginTop: 6 }}>
          {result.gate.blocked.map((reason, i) => <li key={i}>{reason}</li>)}
        </ul>
      </div>
    )}
    {result.gate && result.gate.warnings.length > 0 && result.gate.blocked.length === 0 && (
      <div className="alert alert-warning">
        <strong>Committed with warnings:</strong>
        <ul style={{ marginBottom: 0, marginTop: 6 }}>
          {result.gate.warnings.map((reason, i) => <li key={i}>{reason}</li>)}
        </ul>
      </div>
    )}
    {result.conflicts && result.conflicts.length > 0 && <ConflictList conflicts={result.conflicts} />}
    {!result.gate && !result.conflicts && result.message && (
      <div className="alert alert-danger" role="alert">{result.message}</div>
    )}
  </>
);

/**
 * Conflicts the structural merge could not settle (MRG-6). Everything that *could* be
 * merged already was — these are only the fields where two people wrote different values.
 */
const ConflictList: React.FC<{ conflicts: ServerConflict[] }> = ({ conflicts }) => (
  <div className="alert alert-warning">
    <strong>Someone else changed the same thing</strong>
    <p style={{ margin: '6px 0' }}>
      Everything else merged cleanly. These need you to choose:
    </p>
    <ul style={{ marginBottom: 0 }}>
      {conflicts.map((conflict, i) => (
        <li key={i} style={{ marginBottom: 8 }}>
          {conflict.kind === 'delete-modify' ? (
            <>
              <strong>{conflict.itemId}</strong> was deleted by one of you and changed by the other.
            </>
          ) : (
            <>
              <strong>{conflict.itemId ?? 'The document'}</strong>
              {conflict.field ? <> · <code>{conflict.field}</code></> : null}
              <div className="conflict-sides" style={{ marginTop: 4 }}>
                <div><em>Yours:</em> {renderValue(conflict.ours)}</div>
                <div><em>Theirs:</em> {renderValue(conflict.theirs)}</div>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
    <p style={{ marginTop: 8, marginBottom: 0 }} className="text-muted">
      Reload to pick up their version, reapply your edit, and commit again.
    </p>
  </div>
);

function renderValue(value: unknown): React.ReactNode {
  if (value === undefined || value === null) return <span className="text-muted">(not set)</span>;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return <span>{text.length > 200 ? `${text.slice(0, 200)}…` : text}</span>;
}

function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

/** Bootstrap 3 modal, matching VersionHistoryDialog's shape. */
const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div className="modal" style={{ display: 'block' }} role="dialog" aria-label={title}>
    <div className="modal-dialog" role="document">
      <div className="modal-content">
        <div className="modal-header">
          <button type="button" className="close" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
          <h4 className="modal-title">{title}</h4>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  </div>
);

export default CommitDialog;
