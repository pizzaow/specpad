import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TestingView from '../TestingView';
import type { VtpDoc, RunRecord } from '../../shared';

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

// An automated VTP (linked to a test file) + a run record that covers it.
const automatedVtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'AcmeApp', title: 'Tests',
  items: [
    { id: 't_a', code: 'TEST-A', text: 'Auto pass', expected: 'ok', verifies: ['r_1'], automation: [{ runner: 'vitest', file: 'a.test.ts' }] },
    { id: 't_m', code: 'TEST-M', text: 'Manual', expected: 'ok', result: 'not_tested' },
  ],
};
const run: RunRecord = {
  schemaVersion: '1.0', type: 'run', name: 'AcmeApp', runner: 'vitest', ref: 'deadbeef123', ranAt: '2026-06-25',
  summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
  results: [{ file: 'a.test.ts', selector: 'works', status: 'passed' }],
};

describe('TestingView', () => {
  it('lists only non-heading tests', () => {
    render(<TestingView doc={vtp} onChange={vi.fn()} />);
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
    expect(screen.queryByText('Section')).toBeNull();
  });

  it('reports a manual result change to onChange', () => {
    const onChange = vi.fn();
    render(<TestingView doc={vtp} onChange={onChange} />);
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'passed' } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.items.find((i: { id: string }) => i.id === vtp.items[0].id)?.result).toBe('passed');
  });
});

describe('TestingView — verification chain (VER-4)', () => {
  it('derives an automated test status from the run and shows run provenance', () => {
    render(<TestingView doc={automatedVtp} run={run} onChange={vi.fn()} />);
    // run-provenance banner
    expect(screen.getByText(/deadbeef1/)).toBeInTheDocument();
    // automated test → derived "passed" badge (the option text 'passed' also exists, so target the badge)
    expect(screen.getByTitle('derived from the captured run').textContent).toBe('passed');
    // the manual test keeps a result control
    expect(screen.getByLabelText('Result for TEST-M')).toBeInTheDocument();
    // automated test has no manual control
    expect(screen.queryByLabelText('Result for TEST-A')).toBeNull();
  });

  it('shows "not run" for an automated test when no run is loaded', () => {
    render(<TestingView doc={automatedVtp} onChange={vi.fn()} />);
    expect(screen.getByText('not run')).toBeInTheDocument();
    expect(screen.getByText(/No captured run loaded/)).toBeInTheDocument();
  });

  it('edits an automation link and reports it to onChange', () => {
    const onChange = vi.fn();
    render(<TestingView doc={automatedVtp} onChange={onChange} />);
    const fileInput = screen.getByTitle('test file') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { value: 'b.test.ts' } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.items.find((i: { id: string }) => i.id === 't_a')?.automation[0].file).toBe('b.test.ts');
  });
});
