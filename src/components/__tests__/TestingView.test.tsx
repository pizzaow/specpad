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
    render(<TestingView doc={vtp} onChange={vi.fn()} />);
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
    expect(screen.queryByText('Section')).toBeNull();
  });

  it('reports a result change to onChange', () => {
    const onChange = vi.fn();
    render(<TestingView doc={vtp} onChange={onChange} />);
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'passed' } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.items.find((i: { id: string }) => i.id === vtp.items[0].id)?.result).toBe('passed');
  });
});
