import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CommitDialog from '../CommitDialog';
import type { ServerStatus, CommitResult } from '../../fileApi';

// CMT-3/CMT-7: nothing is published until the user asks, and they see what they are
// about to publish — at item level — before they ask.

const dirty: ServerStatus = {
  changed: ['docs/specpad/acme.srs.json', 'docs/specpad/acme.sad.md'],
  dirty: true,
  diff: [
    {
      path: 'docs/specpad/acme.srs.json',
      kind: 'register',
      added: ['REQ-22'],
      modified: ['REQ-14'],
      removed: [],
    },
    { path: 'docs/specpad/acme.sad.md', kind: 'file' },
  ],
};

const clean: ServerStatus = { changed: [], dirty: false, diff: [] };

function renderDialog(overrides: Partial<React.ComponentProps<typeof CommitDialog>> = {}) {
  const props = {
    status: dirty,
    branch: 'main',
    activeJobLabel: 'JOB-40',
    onCommit: vi.fn(async (): Promise<CommitResult> => ({ ok: true, commit: 'abc12345' })),
    onDiscard: vi.fn(async () => undefined),
    onClose: vi.fn(),
    onCommitted: vi.fn(),
    ...overrides,
  };
  render(<CommitDialog {...props} />);
  return props;
}

describe('CommitDialog — the pending change summary (CMT-7)', () => {
  it('names the changed items, not just the changed files', () => {
    renderDialog();

    expect(screen.getByText(/1 added: REQ-22/)).toBeInTheDocument();
    expect(screen.getByText(/1 modified: REQ-14/)).toBeInTheDocument();
  });

  it('shows the branch and the active job it will be attributed to', () => {
    renderDialog();

    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('JOB-40')).toBeInTheDocument();
  });

  it('falls back to "changed" for a file with no item structure', () => {
    renderDialog();

    expect(screen.getByText('acme.sad.md')).toBeInTheDocument();
  });

  it('says so when there is nothing to commit', () => {
    renderDialog({ status: clean });

    expect(screen.getByText(/no uncommitted changes/i)).toBeInTheDocument();
  });
});

describe('CommitDialog — committing (CMT-3)', () => {
  it('requires a message before the commit button works', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Commit' })).toBeDisabled();
  });

  it('commits the typed message and reports success', async () => {
    const props = renderDialog();

    fireEvent.change(screen.getByLabelText(/describe this change/i), {
      target: { value: 'Clarify the retention requirement' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));

    await waitFor(() => expect(props.onCommit).toHaveBeenCalledWith('Clarify the retention requirement'));
    expect(await screen.findByText(/were published/i)).toBeInTheDocument();
    expect(screen.getByText('abc12345')).toBeInTheDocument();
    expect(props.onCommitted).toHaveBeenCalled();
  });

  it('never commits without the user pressing Commit', () => {
    const props = renderDialog();

    fireEvent.change(screen.getByLabelText(/describe this change/i), { target: { value: 'x' } });

    expect(props.onCommit).not.toHaveBeenCalled();
  });
});

describe('CommitDialog — refusals (CMT-4)', () => {
  it('shows why a blocked commit was refused', async () => {
    const props = renderDialog({
      onCommit: vi.fn(async () => ({
        ok: false,
        gate: { ok: false, blocked: ['traceability: Requirement r_2 has no verifying test'], warnings: [] },
      })),
    });

    fireEvent.change(screen.getByLabelText(/describe this change/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(await screen.findByText(/has no verifying test/)).toBeInTheDocument();
    expect(props.onCommitted).not.toHaveBeenCalled();
  });

  it('shows a plain refusal message when there is no gate detail', async () => {
    renderDialog({
      onCommit: vi.fn(async () => ({ ok: false, message: 'The branch kept moving while publishing.' })),
    });

    fireEvent.change(screen.getByLabelText(/describe this change/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(await screen.findByText(/branch kept moving/)).toBeInTheDocument();
  });

  it('surfaces a thrown error rather than failing silently', async () => {
    renderDialog({
      onCommit: vi.fn(async () => { throw new Error('the server is unreachable'); }),
    });

    fireEvent.change(screen.getByLabelText(/describe this change/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(await screen.findByText(/server is unreachable/)).toBeInTheDocument();
  });
});

describe('CommitDialog — conflicts (MRG-6)', () => {
  it('shows both values for a field two people changed', async () => {
    renderDialog({
      onCommit: vi.fn(async () => ({
        ok: false,
        conflicts: [
          {
            itemId: 'r_a101',
            kind: 'field' as const,
            field: 'text',
            ours: 'The system shall persist…',
            theirs: 'The system shall retain…',
          },
        ],
      })),
    });

    fireEvent.change(screen.getByLabelText(/describe this change/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(await screen.findByText(/someone else changed the same thing/i)).toBeInTheDocument();
    expect(screen.getByText(/The system shall persist/)).toBeInTheDocument();
    expect(screen.getByText(/The system shall retain/)).toBeInTheDocument();
    // The point of the structural merge: only the genuine collisions get here.
    expect(screen.getByText(/everything else merged cleanly/i)).toBeInTheDocument();
  });

  it('explains a delete/modify conflict in words rather than showing empty values', async () => {
    renderDialog({
      onCommit: vi.fn(async () => ({
        ok: false,
        conflicts: [{ itemId: 'r_a101', kind: 'delete-modify' as const, ours: null, theirs: { id: 'r_a101' } }],
      })),
    });

    fireEvent.change(screen.getByLabelText(/describe this change/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }));

    expect(await screen.findByText(/deleted by one of you and changed by the other/i)).toBeInTheDocument();
  });
});

describe('CommitDialog — discarding (CMT-7)', () => {
  it('discards after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const props = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /discard my changes/i }));

    await waitFor(() => expect(props.onDiscard).toHaveBeenCalled());
    expect(props.onClose).toHaveBeenCalled();
  });

  it('does nothing when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const props = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /discard my changes/i }));

    expect(props.onDiscard).not.toHaveBeenCalled();
  });

  it('offers no discard when there is nothing to discard', () => {
    renderDialog({ status: clean });

    expect(screen.queryByRole('button', { name: /discard my changes/i })).not.toBeInTheDocument();
  });
});
