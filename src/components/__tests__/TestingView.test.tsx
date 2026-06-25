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
  it('groups Manual above Automated and omits the verifies trace', () => {
    const { container } = render(<TestingView doc={automatedVtp} run={run} onChange={vi.fn()} />);
    const headings = [...container.querySelectorAll('h4')].map((h) => h.textContent);
    expect(headings.findIndex((h) => /Manual tests/.test(h ?? ''))).toBeLessThan(headings.findIndex((h) => /Automated tests/.test(h ?? '')));
    // the verifies trace is not shown here (no Verifies column, no requirement label)
    expect(screen.queryByText('Verifies')).toBeNull();
    expect(screen.queryByText('r_1')).toBeNull();
  });

  it('derives an automated test status from the run and shows run provenance', () => {
    render(<TestingView doc={automatedVtp} run={run} onChange={vi.fn()} />);
    expect(screen.getByText(/deadbeef1/)).toBeInTheDocument();
    // automated test → derived "passed" badge
    expect(screen.getByTitle('derived from the captured run').textContent).toBe('passed');
    // manual test keeps a result control; automated test has none
    expect(screen.getByLabelText('Result for TEST-M')).toBeInTheDocument();
    expect(screen.queryByLabelText('Result for TEST-A')).toBeNull();
  });

  it('shows the automation link read-only by default and the match count', () => {
    render(<TestingView doc={automatedVtp} run={run} onChange={vi.fn()} />);
    // read-only display (no inputs until clicked); a file-level link shows the matched count
    expect(screen.queryByTitle('test file')).toBeNull();
    expect(screen.getByText(/1 test/)).toBeInTheDocument();
  });

  it('shows "not run" for an automated test when no run is loaded', () => {
    render(<TestingView doc={automatedVtp} onChange={vi.fn()} />);
    expect(screen.getByText('not run')).toBeInTheDocument();
    expect(screen.getByText(/No captured run loaded/)).toBeInTheDocument();
  });

  it('reveals inputs on click and reports an edited link to onChange', () => {
    const onChange = vi.fn();
    render(<TestingView doc={automatedVtp} onChange={onChange} />);
    expect(screen.queryByTitle('test file')).toBeNull();
    fireEvent.click(screen.getByTitle('Click to edit links'));
    const fileInput = screen.getByTitle('test file') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { value: 'b.test.ts' } });
    const next = onChange.mock.calls.at(-1)![0];
    expect(next.items.find((i: { id: string }) => i.id === 't_a')?.automation[0].file).toBe('b.test.ts');
  });
});

describe('TestingView — run-detail dialog (VER-6)', () => {
  it('opens a run-detail dialog listing per-test outcomes', () => {
    render(<TestingView doc={automatedVtp} run={run} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/View run output/));
    expect(screen.getByRole('dialog', { name: 'Run output' })).toBeInTheDocument();
    expect(screen.getByText('works')).toBeInTheDocument(); // the run's per-test selector
    expect(screen.getByText(/Raw console output is not stored/)).toBeInTheDocument();
  });
});
