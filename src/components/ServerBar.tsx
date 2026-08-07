/**
 * ServerBar — shown only when the editor is served by a SpecPad server (EDR-2, EDR-3).
 *
 * Answers the three questions a person editing someone else's repository needs
 * answered at a glance: who am I signed in as, what may I do, and how much have I
 * changed but not yet published.
 */
import React from 'react';
import type { ServerSession, ServerStatus } from '../fileApi';

interface ServerBarProps {
  session: ServerSession;
  status: ServerStatus | null;
  onCommit: () => void;
}

const ROLE_LABEL: Record<ServerSession['role'], string> = {
  reader: 'Read-only',
  editor: 'Editor',
  committer: 'Editor',
};

const ServerBar: React.FC<ServerBarProps> = ({ session, status, onCommit }) => {
  const pending = status?.dirty ? (status.changed?.length ?? 0) : 0;

  return (
    <div className="server-bar" role="region" aria-label="Server session">
      <span className="server-branch">
        <code>{session.repo.branch}</code> on the server
      </span>
      <span className="status-spacer" />

      {session.capabilities.commit && (
        <button
          className={pending > 0 ? 'btn btn-primary btn-sm' : 'btn btn-default btn-sm'}
          onClick={onCommit}
          disabled={pending === 0}
          title={
            pending === 0
              ? 'Nothing to commit yet — your edits are saved to your own copy as you make them'
              : 'Publish your changes to the repository'
          }
        >
          Commit
          {pending > 0 && <span className="badge" style={{ marginLeft: 6 }}>{pending}</span>}
        </button>
      )}

      <span className="server-identity" style={{ marginLeft: 12 }}>
        {session.principal.displayName}
        <span className="label label-default" style={{ marginLeft: 6 }}>
          {ROLE_LABEL[session.role]}
        </span>
      </span>
    </div>
  );
};

export default ServerBar;
