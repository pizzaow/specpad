import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JobsView from '../JobsView';
import type { JobsDoc } from '../../shared';

const doc: JobsDoc = {
  schemaVersion: '1.0',
  type: 'jobs',
  name: 'AcmeApp',
  jobs: [
    { id: 'j_open', code: 'JOB-1', title: 'Add jobs list', description: 'A register.', status: 'open' },
    { id: 'j_two', code: 'JOB-2', title: 'Second job', status: 'open' },
    { id: 'j_closed', code: 'JOB-3', title: 'Sealed work', status: 'closed' },
  ],
};

function renderView(overrides: Partial<React.ComponentProps<typeof JobsView>> = {}) {
  const onChange = vi.fn();
  const onSetActive = vi.fn();
  render(
    <JobsView
      doc={doc}
      projectName="AcmeApp"
      activeIds={['j_open']}
      onChange={onChange}
      onSetActive={onSetActive}
      {...overrides}
    />,
  );
  return { onChange, onSetActive };
}

describe('JobsView', () => {
  it('lists every job with its status and marks the active ones', () => {
    renderView();
    expect(screen.getByText('Add jobs list')).toBeInTheDocument();
    expect(screen.getByText('Sealed work')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('edits the selected job title via onChange', () => {
    const { onChange } = renderView();
    fireEvent.click(screen.getByText('Add jobs list'));
    fireEvent.change(screen.getByDisplayValue('Add jobs list'), { target: { value: 'Renamed' } });
    const next = onChange.mock.calls.at(-1)![0] as JobsDoc;
    expect(next.jobs.find((j) => j.id === 'j_open')!.title).toBe('Renamed');
  });

  it('adds a new open job whose code continues from the highest JOB-N', () => {
    const { onChange } = renderView();
    fireEvent.click(screen.getByText('+ New job'));
    const next = onChange.mock.calls.at(-1)![0] as JobsDoc;
    expect(next.jobs).toHaveLength(4);
    expect(next.jobs[3].id).toMatch(/^j_[0-9a-f]{6}$/);
    expect(next.jobs[3].code).toBe('JOB-4');
    expect(next.jobs[3].status).toBe('open');
  });

  it('adds an open, non-active job to the active set (keeping the existing one)', () => {
    const { onSetActive } = renderView();
    fireEvent.click(screen.getByText('Second job'));
    fireEvent.click(screen.getByText('Add to active jobs'));
    expect(onSetActive).toHaveBeenCalledWith(['j_open', 'j_two']);
  });

  it('removes a job from the active set', () => {
    const { onSetActive } = renderView();
    fireEvent.click(screen.getByText('Add jobs list'));
    fireEvent.click(screen.getByText('Remove from active'));
    expect(onSetActive).toHaveBeenCalledWith([]);
  });

  it('does not offer activation for a closed, non-active job', () => {
    renderView();
    fireEvent.click(screen.getByText('Sealed work'));
    expect(screen.queryByText('Add to active jobs')).not.toBeInTheDocument();
  });

  it('lets a closed-but-active job be removed (self-heal)', () => {
    const { onSetActive } = renderView({ activeIds: ['j_closed'] });
    fireEvent.click(screen.getByText('Sealed work'));
    expect(screen.getByText(/Active but closed/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Remove from active'));
    expect(onSetActive).toHaveBeenCalledWith([]);
  });

  it('creates a register on first add when none exists', () => {
    const onChange = vi.fn();
    render(
      <JobsView doc={null} projectName="AcmeApp" activeIds={[]} onChange={onChange} onSetActive={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('+ New job'));
    const next = onChange.mock.calls.at(-1)![0] as JobsDoc;
    expect(next.type).toBe('jobs');
    expect(next.name).toBe('AcmeApp');
    expect(next.jobs).toHaveLength(1);
    expect(next.jobs[0].code).toBe('JOB-1');
  });

  it('hides editing controls when read-only', () => {
    renderView({ readOnly: true });
    expect(screen.queryByText('+ New job')).not.toBeInTheDocument();
  });
});
