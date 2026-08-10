/**
 * ServerBar — shown only when the editor is served by a SpecPad server (EDR-2, EDR-3).
 *
 * Answers the three questions a person editing someone else's repository needs
 * answered at a glance: who am I signed in as, what may I do, and how much have I
 * changed but not yet published.
 */
import React, { useState } from 'react';
import type { ServerSession, ServerStatus, ProjectSummary } from '../fileApi';

export interface PresenceLabel {
  userId: string;
  displayName: string;
  /** The row they are in, named the way a human would (a code), or null. */
  where: string | null;
}

interface ServerBarProps {
  session: ServerSession;
  status: ServerStatus | null;
  onCommit: () => void;
  /** Other people in this project right now (CE-3). Advisory only. */
  presence?: PresenceLabel[];
  /** Projects this user may open on this server (MPT-7, MPT-11). */
  projects?: ProjectSummary[];
  onSelectProject?: (id: string) => void;
}

const ROLE_LABEL: Record<ServerSession['role'], string> = {
  reader: 'Read-only',
  editor: 'Editor',
  committer: 'Editor',
};

const ServerBar: React.FC<ServerBarProps> = ({
  session,
  status,
  onCommit,
  presence,
  projects,
  onSelectProject,
}) => {
  const pending = status?.dirty ? (status.changed?.length ?? 0) : 0;
  const others = presence ?? [];
  const [open, setOpen] = useState(false);
  // Only worth a switcher where there is a choice: one project is not a decision (MPT-13).
  const choices = projects ?? [];
  const current = choices.find((p) => p.id === session.projectId);

  return (
    <div className="server-bar" role="region" aria-label="Server session">
      {choices.length > 1 && (
        <span className="menubar-dropdown server-project">
          {open && (
            <div data-testid="server-project-backdrop" className="menubar-backdrop" onClick={() => setOpen(false)} />
          )}
          <button
            type="button"
            className="menubar-chip"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            title="Switch project"
          >
            <span>{current?.title ?? session.project}</span> ▾
          </button>
          {open && (
            <ul className="menubar-menu" role="menu" aria-label="Projects">
              {choices.map((p) => (
                <li
                  key={p.id}
                  role="menuitem"
                  aria-current={p.id === session.projectId || undefined}
                  onClick={() => {
                    setOpen(false);
                    if (p.id !== session.projectId) onSelectProject?.(p.id);
                  }}
                >
                  {p.title}
                  <span className="text-muted" style={{ marginLeft: 8 }}>
                    {p.branch} · {ROLE_LABEL[p.role as ServerSession['role']] ?? p.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </span>
      )}

      <span className="server-branch">
        <code>{session.repo.branch}</code> on the server
      </span>

      {others.length > 0 && (
        <span className="server-presence" title={describePresence(others)}>
          {describePresence(others)}
        </span>
      )}

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

/**
 * "Kim Patel is editing REQ-14" for one person; a count once there are several, since
 * a list of five names in a status bar is noise rather than information.
 */
function describePresence(people: PresenceLabel[]): string {
  if (people.length === 1) {
    const [person] = people;
    return person.where
      ? `${person.displayName} is editing ${person.where}`
      : `${person.displayName} is here`;
  }
  const editing = people.filter((p) => p.where);
  if (editing.length === 0) return `${people.length} others here`;
  return `${people.length} others here · editing ${editing.map((p) => p.where).join(', ')}`;
}

export default ServerBar;
