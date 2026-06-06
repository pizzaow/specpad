import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TestingView from '../TestingView';
import type { VtpDoc } from '../../shared';

const vtp: VtpDoc = {
  schemaVersion: '1.0',
  type: 'vtp',
  name: 'AcmeApp',
  title: 'Tests',
  items: [
    { id: 't_001', code: 'TEST-1', text: 'Login', expected: 'ok', result: 'passed' },
    { id: 'h_001', heading: true, text: 'Section' },
    { id: 't_002', code: 'TEST-2', text: 'Logout', expected: 'ok', result: '' },
  ],
};

describe('TestingView', () => {
  it('lists only non-heading tests', () => {
    render(<TestingView doc={vtp} onSave={vi.fn()} />);
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
    expect(screen.queryByText('Section')).toBeNull();
  });

  it('saves an updated result back through onSave', () => {
    const onSave = vi.fn();
    render(<TestingView doc={vtp} onSave={onSave} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'failed' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as VtpDoc;
    expect(saved.items.find((i) => i.id === 't_002')?.result).toBe('failed');
  });
});
