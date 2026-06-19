import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JobsView from '../JobsView';
import type { JobsDoc } from '../../shared';

const doc: JobsDoc = {
  schemaVersion: '1.0',
  type: 'jobs',
  name: 'AcmeApp',
  jobs: [
    { id: 'j_feat1', code: 'JOB-1', type: 'feature', version: '1.0', title: 'Login', description: 'Adds login.', status: 'closed' },
    { id: 'j_bug1', code: 'JOB-2', type: 'bugfix', version: '1.1', title: 'Fix logout', description: 'Logout crash.', status: 'closed' },
    { id: 'j_feat2', code: 'JOB-3', type: 'feature', title: 'SSO', description: 'Single sign-on.', status: 'open' },
  ],
};

function renderView(overrides: Partial<React.ComponentProps<typeof JobsView>> = {}) {
  const onChange = vi.fn();
  const onSetActive = vi.fn();
  render(
    <JobsView doc={doc} projectName="AcmeApp" activeIds={['j_feat2']} onChange={onChange} onSetActive={onSetActive} {...overrides} />,
  );
  return { onChange, onSetActive };
}

describe('JobsView — release notes list', () => {
  it('groups by major version (unversioned under Unreleased) and by type', () => {
    renderView();
    // Three groups: Unreleased (the unversioned open feature), v1 (1.0 + 1.1).
    expect(screen.getByText('Unreleased')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
    // Features and Bugfixes subheadings appear.
    expect(screen.getAllByText('Features').length).toBeGreaterThan(0);
    expect(screen.getByText('Bugfixes')).toBeInTheDocument();
  });

  it('shows the description beneath each job title', () => {
    renderView();
    expect(screen.getByText('Single sign-on.')).toBeInTheDocument();
    expect(screen.getByText('Logout crash.')).toBeInTheDocument();
  });

  it('opens a separate detail view when a job is clicked, with a way back', () => {
    renderView();
    fireEvent.click(screen.getByText('SSO'));
    // Detail view: editable fields are now present...
    expect(screen.getByLabelText('Job type')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Single sign-on.')).toBeInTheDocument();
    // ...and the list groups are gone.
    expect(screen.queryByText('Bugfixes')).not.toBeInTheDocument();
    // Back returns to the list.
    fireEvent.click(screen.getByText('← All jobs'));
    expect(screen.getByText('Bugfixes')).toBeInTheDocument();
  });

  it('edits the job type from the detail view', () => {
    const { onChange } = renderView();
    fireEvent.click(screen.getByText('SSO'));
    fireEvent.change(screen.getByLabelText('Job type'), { target: { value: 'bugfix' } });
    const next = onChange.mock.calls.at(-1)![0] as JobsDoc;
    expect(next.jobs.find((j) => j.id === 'j_feat2')!.type).toBe('bugfix');
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
