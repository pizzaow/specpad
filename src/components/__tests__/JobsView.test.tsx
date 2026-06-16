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
    { id: 'j_closed', code: 'JOB-2', title: 'Sealed work', status: 'closed' },
  ],
};

function renderView(overrides: Partial<React.ComponentProps<typeof JobsView>> = {}) {
  const onChange = vi.fn();
  const onSetActive = vi.fn();
  render(
    <JobsView
      doc={doc}
      projectName="AcmeApp"
      activeJobId="j_open"
      onChange={onChange}
      onSetActive={onSetActive}
      {...overrides}
    />,
  );
  return { onChange, onSetActive };
}

describe('JobsView', () => {
  it('lists every job with its status and marks the active one', () => {
    renderView();
    expect(screen.getByText('Add jobs list')).toBeInTheDocument();
    expect(screen.getByText('Sealed work')).toBeInTheDocument();
    expect(screen.getAllByText('open').length).toBeGreaterThan(0);
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('edits the selected job title via onChange', () => {
    const { onChange } = renderView();
    fireEvent.click(screen.getByText('Add jobs list'));
    fireEvent.change(screen.getByDisplayValue('Add jobs list'), { target: { value: 'Renamed' } });
    const next = onChange.mock.calls.at(-1)![0] as JobsDoc;
    expect(next.jobs.find((j) => j.id === 'j_open')!.title).toBe('Renamed');
  });

  it('adds a new open job with a generated id', () => {
    const { onChange } = renderView();
    fireEvent.click(screen.getByText('+ New job'));
    const next = onChange.mock.calls.at(-1)![0] as JobsDoc;
    expect(next.jobs).toHaveLength(3);
    expect(next.jobs[2].id).toMatch(/^j_[0-9a-f]{6}$/);
    expect(next.jobs[2].status).toBe('open');
  });

  it('offers "Set as active job" only for open, non-active jobs', () => {
    const { onSetActive } = renderView({ activeJobId: 'j_closed' });
    // Closed job selected → no activation button.
    fireEvent.click(screen.getByText('Sealed work'));
    expect(screen.queryByText('Set as active job')).not.toBeInTheDocument();
    // Open job selected → button activates it.
    fireEvent.click(screen.getByText('Add jobs list'));
    fireEvent.click(screen.getByText('Set as active job'));
    expect(onSetActive).toHaveBeenCalledWith('j_open', 'Add jobs list');
  });

  it('creates a register on first add when none exists', () => {
    const onChange = vi.fn();
    render(
      <JobsView doc={null} projectName="AcmeApp" activeJobId={null} onChange={onChange} onSetActive={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('+ New job'));
    const next = onChange.mock.calls.at(-1)![0] as JobsDoc;
    expect(next.type).toBe('jobs');
    expect(next.name).toBe('AcmeApp');
    expect(next.jobs).toHaveLength(1);
  });

  it('hides editing controls when read-only', () => {
    renderView({ readOnly: true });
    expect(screen.queryByText('+ New job')).not.toBeInTheDocument();
  });
});
