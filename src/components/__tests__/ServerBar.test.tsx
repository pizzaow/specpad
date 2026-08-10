import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ServerBar from '../ServerBar';
import type { ServerSession, ServerStatus, ProjectSummary } from '../../fileApi';

// EDR-2/EDR-3: who am I, what may I do, and how much have I not yet published.

const session = (role: ServerSession['role']): ServerSession => ({
  principal: { id: 'jane', displayName: 'Jane Smith', email: 'jane@corp.example' },
  role,
  capabilities: { read: true, write: role !== 'reader', commit: role === 'committer' },
  repo: { branch: 'main', projectDir: 'docs/specpad' },
  project: 'acme',
  activeJob: null,
  commitPolicy: { requireActiveJob: true, requireGovernanceClean: 'warn' },
});

const dirty: ServerStatus = {
  changed: ['docs/specpad/acme.srs.json', 'docs/specpad/acme.vtp.json'],
  dirty: true,
};
const clean: ServerStatus = { changed: [], dirty: false };

describe('ServerBar — identity (EDR-2)', () => {
  it('shows the signed-in user and the branch being edited', () => {
    render(<ServerBar session={session('committer')} status={clean} onCommit={vi.fn()} />);

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('main')).toBeInTheDocument();
  });

  it('labels a reader as read-only', () => {
    render(<ServerBar session={session('reader')} status={clean} onCommit={vi.fn()} />);

    expect(screen.getByText('Read-only')).toBeInTheDocument();
  });
});

describe('ServerBar — the Commit affordance (EDR-3)', () => {
  it('offers Commit to a committer', () => {
    render(<ServerBar session={session('committer')} status={dirty} onCommit={vi.fn()} />);

    expect(screen.getByRole('button', { name: /commit/i })).toBeInTheDocument();
  });

  it('offers no Commit to an editor, who may edit but not publish', () => {
    render(<ServerBar session={session('editor')} status={dirty} onCommit={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /commit/i })).not.toBeInTheDocument();
  });

  it('offers no Commit to a reader', () => {
    render(<ServerBar session={session('reader')} status={clean} onCommit={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /commit/i })).not.toBeInTheDocument();
  });
});

describe('ServerBar — presence (CE-3)', () => {
  it('names the one other person and the row they are in', () => {
    render(
      <ServerBar
        session={session('committer')}
        status={clean}
        onCommit={vi.fn()}
        presence={[{ userId: 'kim', displayName: 'Kim Patel', where: 'REQ-14' }]}
      />,
    );

    expect(screen.getByText('Kim Patel is editing REQ-14')).toBeInTheDocument();
  });

  it('says someone is here when they are in no particular row', () => {
    render(
      <ServerBar
        session={session('committer')}
        status={clean}
        onCommit={vi.fn()}
        presence={[{ userId: 'kim', displayName: 'Kim Patel', where: null }]}
      />,
    );

    expect(screen.getByText('Kim Patel is here')).toBeInTheDocument();
  });

  it('summarizes rather than listing every name once there are several', () => {
    render(
      <ServerBar
        session={session('committer')}
        status={clean}
        onCommit={vi.fn()}
        presence={[
          { userId: 'kim', displayName: 'Kim Patel', where: 'REQ-14' },
          { userId: 'sam', displayName: 'Sam Ree', where: 'REQ-22' },
        ]}
      />,
    );

    expect(screen.getByText(/2 others here · editing REQ-14, REQ-22/)).toBeInTheDocument();
  });

  it('shows nothing when nobody else is around', () => {
    render(<ServerBar session={session('committer')} status={clean} onCommit={vi.fn()} presence={[]} />);

    expect(screen.queryByText(/editing/i)).not.toBeInTheDocument();
  });
});

describe('ServerBar — the pending badge', () => {
  it('counts the pending changes', () => {
    render(<ServerBar session={session('committer')} status={dirty} onCommit={vi.fn()} />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('disables Commit with nothing to publish, and explains why', () => {
    render(<ServerBar session={session('committer')} status={clean} onCommit={vi.fn()} />);

    const button = screen.getByRole('button', { name: /commit/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', expect.stringMatching(/nothing to commit/i));
  });

  it('opens the commit dialog when pressed', () => {
    const onCommit = vi.fn();
    render(<ServerBar session={session('committer')} status={dirty} onCommit={onCommit} />);

    fireEvent.click(screen.getByRole('button', { name: /commit/i }));

    expect(onCommit).toHaveBeenCalled();
  });

  it('tolerates a status it has not fetched yet', () => {
    render(<ServerBar session={session('committer')} status={null} onCommit={vi.fn()} />);

    expect(screen.getByRole('button', { name: /commit/i })).toBeDisabled();
  });
});

// ---- The project switcher (MPT-11, MPT-13) ----

const projects: ProjectSummary[] = [
  { id: 'alpha', title: 'Alpha Device', branch: 'main', role: 'committer' },
  { id: 'beta', title: 'Beta Device', branch: 'release', role: 'reader' },
];

const inProject = (id: string): ServerSession => ({ ...session('committer'), projectId: id });

describe('ServerBar — the project switcher (MPT-11, MPT-13)', () => {
  it('names the project being edited when there is a choice of them', () => {
    render(
      <ServerBar session={inProject('alpha')} status={clean} onCommit={vi.fn()} projects={projects} />,
    );

    expect(screen.getByRole('button', { name: /Alpha Device/ })).toBeInTheDocument();
  });

  it('offers every project the user may open, with its branch and their role', () => {
    render(
      <ServerBar session={inProject('alpha')} status={clean} onCommit={vi.fn()} projects={projects} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Alpha Device/ }));

    const menu = screen.getByRole('menu', { name: 'Projects' });
    expect(menu).toHaveTextContent('Beta Device');
    expect(menu).toHaveTextContent('release');
    expect(menu).toHaveTextContent('Read-only');
  });

  it('asks to switch when another project is chosen', () => {
    const onSelectProject = vi.fn();
    render(
      <ServerBar
        session={inProject('alpha')}
        status={clean}
        onCommit={vi.fn()}
        projects={projects}
        onSelectProject={onSelectProject}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Alpha Device/ }));
    fireEvent.click(screen.getByText('Beta Device'));

    expect(onSelectProject).toHaveBeenCalledWith('beta');
  });

  it('does not re-open the project already open', () => {
    const onSelectProject = vi.fn();
    render(
      <ServerBar
        session={inProject('alpha')}
        status={clean}
        onCommit={vi.fn()}
        projects={projects}
        onSelectProject={onSelectProject}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Alpha Device/ }));
    fireEvent.click(screen.getByText('Alpha Device', { selector: 'li' }));

    expect(onSelectProject).not.toHaveBeenCalled();
  });

  it('offers no switcher on a single-project server — one project is not a decision', () => {
    render(
      <ServerBar
        session={inProject('alpha')}
        status={clean}
        onCommit={vi.fn()}
        projects={[projects[0]]}
      />,
    );

    expect(screen.queryByRole('button', { name: /Alpha Device/ })).toBeNull();
  });
});
