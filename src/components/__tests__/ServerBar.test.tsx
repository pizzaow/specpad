import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ServerBar from '../ServerBar';
import type { ServerSession, ServerStatus } from '../../fileApi';

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
