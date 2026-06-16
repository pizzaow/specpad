import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JobControl from '../JobControl';

describe('JobControl', () => {
  it('shows the current job when set', () => {
    render(<JobControl job={{ schemaVersion: '1.0', type: 'job', job: 'PROJ-7', title: 'SSO' }} onSet={vi.fn()} />);
    expect(screen.getByDisplayValue('PROJ-7')).toBeInTheDocument();
  });

  it('calls onSet with the entered job id (as a single-element array) and title', () => {
    const onSet = vi.fn();
    render(<JobControl job={null} onSet={onSet} />);
    fireEvent.change(screen.getByPlaceholderText('Job id (e.g. PROJ-123)'), { target: { value: 'PROJ-9' } });
    fireEvent.change(screen.getByPlaceholderText('Title (optional)'), { target: { value: 'Add login' } });
    fireEvent.click(screen.getByText('Set job'));
    expect(onSet).toHaveBeenCalledWith(['PROJ-9'], 'Add login');
  });

  it('register mode: checks multiple open records and sets them active by id', () => {
    const onSet = vi.fn();
    render(
      <JobControl
        job={null}
        onSet={onSet}
        activeIds={['j_open']}
        jobs={[
          { id: 'j_open', code: 'JOB-1', title: 'Open work', status: 'open' },
          { id: 'j_two', code: 'JOB-2', title: 'More work', status: 'open' },
          { id: 'j_closed', code: 'JOB-3', title: 'Closed work', status: 'closed' },
        ]}
      />,
    );
    // Closed records are not offered, so you can't activate one by accident.
    expect(screen.queryByText('JOB-3 — Closed work')).not.toBeInTheDocument();
    // j_open starts checked; add j_two and apply.
    fireEvent.click(screen.getByText('JOB-2 — More work'));
    fireEvent.click(screen.getByText('Set active'));
    expect(onSet).toHaveBeenCalledWith(['j_open', 'j_two']);
  });
});
