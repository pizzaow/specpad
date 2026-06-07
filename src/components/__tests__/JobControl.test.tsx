import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import JobControl from '../JobControl';

describe('JobControl', () => {
  it('shows the current job when set', () => {
    render(<JobControl job={{ schemaVersion: '1.0', type: 'job', job: 'PROJ-7', title: 'SSO' }} onSet={vi.fn()} />);
    expect(screen.getByDisplayValue('PROJ-7')).toBeInTheDocument();
  });

  it('calls onSet with the entered job id and title', () => {
    const onSet = vi.fn();
    render(<JobControl job={null} onSet={onSet} />);
    fireEvent.change(screen.getByPlaceholderText('Job id (e.g. PROJ-123)'), { target: { value: 'PROJ-9' } });
    fireEvent.change(screen.getByPlaceholderText('Title (optional)'), { target: { value: 'Add login' } });
    fireEvent.click(screen.getByText('Set job'));
    expect(onSet).toHaveBeenCalledWith('PROJ-9', 'Add login');
  });
});
