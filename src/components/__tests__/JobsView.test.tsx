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

function renderView(overrides: Partial<React.ComponentProps<typeof JobsView>> = {}) {
  const onChange = vi.fn();
  const onSetActive = vi.fn();
  render(
    <JobsView doc={doc} projectName="AcmeApp" activeIds={['j_open']} jobDiffs={jobDiffs} onChange={onChange} onSetActive={onSetActive} {...overrides} />,
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

  it('shows owner and derived (read-only) version in the detail', () => {
    renderView();
    fireEvent.click(screen.getByText('SSO'));
    expect(screen.getByText(/Sam <s@x>/)).toBeInTheDocument();
    expect(screen.getByText(/Unreleased/)).toBeInTheDocument();
    // version is derived — no editable input for it
    expect(screen.queryByPlaceholderText(/blank = Unreleased/)).not.toBeInTheDocument();
  });

  it('tells the user an open job\'s changes appear once closed', () => {
    renderView();
    fireEvent.click(screen.getByText('SSO'));
    expect(screen.getByText(/materialized once it is closed/)).toBeInTheDocument();
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
