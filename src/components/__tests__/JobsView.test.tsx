import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JobsView from '../JobsView';
import type { JobsDoc } from '../../shared';

const doc: JobsDoc = {
  schemaVersion: '1.0',
  type: 'jobs',
  name: 'AcmeApp',
  jobs: [
    { id: 'j_open', code: 'JOB-3', type: 'feature', owner: { name: 'Sam', email: 's@x' }, title: 'SSO', description: 'Single sign-on.', status: 'open' },
    { id: 'j_feat', code: 'JOB-1', type: 'feature', title: 'Login', description: 'Adds login.', status: 'closed' },
    { id: 'j_bug', code: 'JOB-2', type: 'bugfix', title: 'Fix logout', description: 'Logout crash.', status: 'closed' },
  ],
};

// A cached diff for the closed feature job.
const jobDiffs = {
  j_feat: {
    srs: { added: [{ id: 'r_1', status: 'added' as const, after: { id: 'r_1', code: 'AUTH-1', text: 'Shall log in.' } }], removed: [], modified: [] },
    vtp: { added: [], removed: [], modified: [] },
  },
};

const jobCommits = {
  j_feat: [{ hash: 'abc1234def', subject: 'feat: add login', author: 'Sam', date: '2026-01-02' }],
};

const jobArch = {
  j_feat: {
    added: [],
    modified: ['acme.sad.md', 'acme.context.svg'],
    removed: ['acme.workspace.dsl'],
    mdDiffs: [{ file: 'acme.sad.md', sections: [{ heading: '9. Architecture Decisions', status: 'modified' as const, added: ['New architecture note.'], removed: ['Old note.'] }] }],
  },
};

function renderView(overrides: Partial<React.ComponentProps<typeof JobsView>> = {}) {
  const onChange = vi.fn();
  const onSetActive = vi.fn();
  render(
    <JobsView doc={doc} projectName="AcmeApp" activeIds={['j_open']} jobDiffs={jobDiffs} jobCommits={jobCommits} jobArch={jobArch} onChange={onChange} onSetActive={onSetActive} {...overrides} />,
  );
  return { onChange, onSetActive };
}

describe('JobsView — in progress vs released', () => {
  it('separates open jobs (In progress) from closed jobs (Released)', () => {
    renderView();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Released')).toBeInTheDocument();
    // Open job appears with its owner; closed jobs grouped under Features/Bugfixes.
    expect(screen.getByText('SSO')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('Bugfixes')).toBeInTheDocument();
  });

  it('renders a closed job\'s cached SRS/VTP changes in its detail', () => {
    renderView();
    fireEvent.click(screen.getByText('Login'));
    expect(screen.getByText('Changes')).toBeInTheDocument();
    expect(screen.getByText(/AUTH-1 — Shall log in\./)).toBeInTheDocument();
    fireEvent.click(screen.getByText('← All jobs'));
    expect(screen.getByText('Released')).toBeInTheDocument();
  });

  it('shows a closed job\'s architecture changes (coarse files + section-level SAD diff)', () => {
    renderView();
    fireEvent.click(screen.getByText('Login'));
    expect(screen.getByText('Architecture changes')).toBeInTheDocument();
    expect(screen.getByText(/acme\.context\.svg/)).toBeInTheDocument();
    // acme.sad.md appears in both the modified-file list and the diff summary
    expect(screen.getAllByText(/acme\.sad\.md/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/acme\.workspace\.dsl/)).toBeInTheDocument();
    // section-aware: the changed section heading and its +/- lines are shown
    expect(screen.getByText('9. Architecture Decisions')).toBeInTheDocument();
    expect(screen.getByText(/New architecture note\./)).toBeInTheDocument();
    // a changed diagram is reported coarsely (no text diff)
    expect(screen.getByText(/diagram changed/)).toBeInTheDocument();
  });

  it('lists a closed job\'s commits in its detail', () => {
    renderView();
    fireEvent.click(screen.getByText('Login'));
    expect(screen.getByText('Commits (1)')).toBeInTheDocument();
    expect(screen.getByText(/feat: add login/)).toBeInTheDocument();
    expect(screen.getByText(/abc1234de/)).toBeInTheDocument();
  });

  it('shows a closed job\'s run-derived verification of its changed tests (VER-7)', () => {
    const diffs = {
      j_feat: {
        srs: { added: [], removed: [], modified: [] },
        vtp: { added: [{ id: 't_1', status: 'added' as const, after: { id: 't_1', code: 'TEST-1', text: 'Logs in', automation: [{ runner: 'vitest', file: 'login.test.ts' }] } }], removed: [], modified: [] },
      },
    };
    const run = { schemaVersion: '1.0' as const, type: 'run' as const, name: 'AcmeApp', runner: 'vitest', ref: 'cafe1234', ranAt: '2026-06-26',
      summary: { total: 1, passed: 1, failed: 0, skipped: 0 }, results: [{ file: 'login.test.ts', selector: 'x', status: 'passed' as const }] };
    renderView({ jobDiffs: diffs, run });
    fireEvent.click(screen.getByText('Login'));
    expect(screen.getByText('Verification')).toBeInTheDocument();
    expect(screen.getByText(/1\/1 verified/)).toBeInTheDocument();
    expect(screen.getByText('TEST-1')).toBeInTheDocument();
  });

  it('renders technical_notes in the detail view but not in the release-notes list (JOBS-13)', () => {
    const withNotes: JobsDoc = {
      ...doc,
      jobs: [
        ...doc.jobs.filter((j) => j.id !== 'j_feat'),
        { id: 'j_feat', code: 'JOB-1', type: 'feature', title: 'Login', description: 'Adds login.', technical_notes: 'AuthClient calls /login via retry policy.', status: 'closed' },
      ],
    };
    render(<JobsView doc={withNotes} projectName="AcmeApp" activeIds={[]} onChange={vi.fn()} onSetActive={vi.fn()} />);
    // List row: description is shown, technical_notes is NOT.
    expect(screen.getByText('Adds login.')).toBeInTheDocument();
    expect(screen.queryByText(/AuthClient calls \/login/)).not.toBeInTheDocument();
    // Detail view: both fields are rendered as editable textareas.
    fireEvent.click(screen.getByText('Login'));
    expect(screen.getByText('Technical notes')).toBeInTheDocument();
    expect(screen.getByDisplayValue('AuthClient calls /login via retry policy.')).toBeInTheDocument();
  });

  it('shows owner and derived (read-only) version in the detail', () => {
    renderView();
    fireEvent.click(screen.getByText('SSO'));
    expect(screen.getByText(/Sam <s@x>/)).toBeInTheDocument();
    expect(screen.getByText(/Unreleased/)).toBeInTheDocument();
    // version is derived — no editable input for it
    expect(screen.queryByPlaceholderText(/blank = Unreleased/)).not.toBeInTheDocument();
  });

  it('tells the user when an active open job has no starting snapshot cached', () => {
    renderView(); // no activeDiffs provided
    fireEvent.click(screen.getByText('SSO'));
    expect(screen.getByText(/no starting snapshot is cached/)).toBeInTheDocument();
  });

  it('renders the active open job\'s in-progress changes (before vs working copy)', () => {
    const activeDiffs = {
      j_open: {
        srs: { added: [{ id: 'r_9', status: 'added' as const, after: { id: 'r_9', code: 'NEW-1', text: 'In-progress requirement.' } }], removed: [], modified: [] },
        vtp: { added: [], removed: [], modified: [] },
      },
    };
    renderView({ activeDiffs });
    fireEvent.click(screen.getByText('SSO'));
    expect(screen.getByText(/In progress — uncommitted/)).toBeInTheDocument();
    expect(screen.getByText(/NEW-1 — In-progress requirement\./)).toBeInTheDocument();
  });

  it('renders the active open job\'s in-progress architecture changes', () => {
    const activeArch = {
      j_open: { added: ['acme.context.svg'], modified: ['acme.sad.md'], removed: [], mdDiffs: [{ file: 'acme.sad.md', sections: [{ heading: '4. Solution Strategy', status: 'modified' as const, added: ['New SAD line.'], removed: [] }] }] },
    };
    renderView({ activeArch });
    fireEvent.click(screen.getByText('SSO'));
    expect(screen.getByText(/Architecture changes \(in progress\)/)).toBeInTheDocument();
    expect(screen.getByText(/acme\.context\.svg/)).toBeInTheDocument();
    expect(screen.getByText(/New SAD line\./)).toBeInTheDocument();
  });

  it('adds a new feature job and opens its detail', () => {
    const { onChange } = renderView();
    fireEvent.click(screen.getByText('+ New job'));
    const next = onChange.mock.calls.at(-1)![0] as JobsDoc;
    expect(next.jobs).toHaveLength(4);
    expect(next.jobs[3].type).toBe('feature');
    expect(next.jobs[3].code).toBe('JOB-4');
  });

  it('hides editing controls when read-only', () => {
    renderView({ readOnly: true });
    expect(screen.queryByText('+ New job')).not.toBeInTheDocument();
  });
});
