import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import RiskTable from '../RiskTable';
import type { RiskDoc, SddDoc, SrsDoc, VtpDoc, RunRecord } from '../../shared';

/**
 * The Risk tab (RSK-10..12).
 *
 * The assertions that matter are about the Controlled column: a control is a
 * requirement, so whether the control works is the state of that requirement's tests in
 * the run. A risk marked acceptable whose control has a failing test must not read as
 * controlled.
 */

const sdd: SddDoc = {
  schemaVersion: '1.0', type: 'sdd', name: 'Acme', title: 'Detailed Design',
  items: [
    { id: 'd_1', code: 'SDD-1', title: 'pump control' },
    { id: 'd_view', code: 'SDD-9', title: 'Dependency', kind: 'view' },
  ],
};

const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'Requirements',
  items: [
    { id: 'r_1', code: 'CTL-1', text: 'The pump shall stop on occlusion.' },
    { id: 'r_2', code: 'CTL-2', text: 'The alarm shall sound.' },
    { id: 'r_3', code: 'CTL-3', text: 'Untested control.' },
  ],
};

const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'Tests',
  items: [
    { id: 't_1', code: 'TEST-1', text: 'Occlude.', verifies: ['r_1'], expected: 'Stops.', automation: [{ runner: 'vitest', file: 'a.test.ts', selector: 'occlusion' }] },
    { id: 't_2', code: 'TEST-2', text: 'Alarm.', verifies: ['r_2'], expected: 'Sounds.', automation: [{ runner: 'vitest', file: 'a.test.ts', selector: 'alarm' }] },
  ],
};

const run: RunRecord = {
  schemaVersion: '1.0', type: 'run', name: 'Acme', runner: 'vitest', ref: 'abc1234', ranAt: '2026-08-11',
  summary: { total: 2, passed: 1, failed: 1, skipped: 0 },
  results: [
    { file: 'a.test.ts', selector: 'occlusion', status: 'passed' },
    { file: 'a.test.ts', selector: 'alarm', status: 'failed' },
  ],
};

const doc = (...items: RiskDoc['items']): RiskDoc => ({
  schemaVersion: '1.0', type: 'risk', name: 'Acme', title: 'Risk', items,
});

const risk = (over: Partial<RiskDoc['items'][number]> = {}) => ({
  id: 'k_1', code: 'RISK-1', text: 'Infusion continues after occlusion.',
  severity: 'serious' as const, causes: ['d_1'], controls: ['r_1'],
  residual: 'acceptable' as const, ...over,
});

const render_ = (d: RiskDoc, props: Partial<React.ComponentProps<typeof RiskTable>> = {}) =>
  render(<RiskTable doc={d} sddDoc={sdd} srsDoc={srs} vtpDoc={vtp} run={run} onChange={vi.fn()} {...props} />);

afterEach(() => vi.restoreAllMocks());

describe('RiskTable — the analysis', () => {
  it('shows each risk with its severity, causes and controls', () => {
    render_(doc(risk()));

    expect(screen.getByText('Infusion continues after occlusion.')).toBeInTheDocument();
    expect(screen.getByLabelText('Severity of RISK-1')).toHaveValue('serious');
    expect(within(screen.getByRole('group', { name: /causing RISK-1/ })).getByText('SDD-1')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: /controlling RISK-1/ })).getByText('CTL-1')).toBeInTheDocument();
  });

  it('offers only software units as causes, never a design view', () => {
    render_(doc(risk()));
    fireEvent.click(within(screen.getByRole('group', { name: /causing RISK-1/ })).getByText(/add/));

    expect(screen.queryByRole('option', { name: /SDD-9/ })).toBeNull();
  });
});

describe('RiskTable — whether the control is demonstrated (§7.3)', () => {
  it('reads verified when the controlling requirement has a passing test', () => {
    render_(doc(risk()));
    expect(screen.getByText('verified')).toBeInTheDocument();
  });

  it('reads failing when a control test failed, whatever the residual column says', () => {
    // The risk is recorded acceptable; the evidence says otherwise, and the evidence wins.
    render_(doc(risk({ controls: ['r_2'], residual: 'acceptable' })));

    expect(screen.getByText('failing')).toBeInTheDocument();
    expect(screen.getByLabelText('Residual risk of RISK-1')).toHaveValue('acceptable');
  });

  it('reads no test when a controlling requirement has none', () => {
    render_(doc(risk({ controls: ['r_3'] })));
    expect(screen.getByText('no test')).toBeInTheDocument();
  });

  it('reads not run when the control test never executed', () => {
    render_(doc(risk()), { run: { ...run, results: [] } });
    expect(screen.getByText('not run')).toBeInTheDocument();
  });

  it('reads no control when there is none', () => {
    render_(doc(risk({ controls: [], justification: 'Controlled in hardware.' })));
    expect(screen.getByText('no control')).toBeInTheDocument();
  });

  it('expands to name each control, its requirement and its tests', () => {
    render_(doc(risk({ controls: ['r_1', 'r_3'] })));
    fireEvent.click(screen.getByLabelText('Show control detail for RISK-1'));

    expect(screen.getByText(/The pump shall stop on occlusion/)).toBeInTheDocument();
    expect(screen.getByText('TEST-1')).toBeInTheDocument();
    expect(screen.getByText(/No verifying test/)).toBeInTheDocument();
  });

  it('shows the justification when there is no control, and flags its absence', () => {
    const { rerender } = render_(doc(risk({ controls: [], justification: 'Controlled in hardware.' })));
    fireEvent.click(screen.getByLabelText('Show control detail for RISK-1'));
    expect(screen.getByText('Controlled in hardware.')).toBeInTheDocument();

    // The row stays expanded across the rerender — same id — so it must not be clicked
    // again, which would collapse it.
    rerender(<RiskTable doc={doc(risk({ controls: [] }))} sddDoc={sdd} srsDoc={srs} vtpDoc={vtp} run={run} onChange={vi.fn()} />);
    expect(screen.getByText(/No justification recorded/)).toBeInTheDocument();
  });
});

describe('RiskTable — editing', () => {
  it('edits severity and residual', () => {
    const onChange = vi.fn();
    render_(doc(risk()), { onChange });

    fireEvent.change(screen.getByLabelText('Severity of RISK-1'), { target: { value: 'critical' } });
    expect((onChange.mock.calls.at(-1)![0] as RiskDoc).items[0].severity).toBe('critical');

    fireEvent.change(screen.getByLabelText('Residual risk of RISK-1'), { target: { value: 'unacceptable' } });
    expect((onChange.mock.calls.at(-1)![0] as RiskDoc).items[0].residual).toBe('unacceptable');
  });

  it('edits the hazardous situation without changing the id', () => {
    const onChange = vi.fn();
    render_(doc(risk()), { onChange });

    fireEvent.click(screen.getByText('Infusion continues after occlusion.'));
    const field = screen.getByLabelText('Hazardous situation');
    fireEvent.change(field, { target: { value: 'Rewritten.' } });
    fireEvent.blur(field);

    const next = onChange.mock.calls.at(-1)![0] as RiskDoc;
    expect(next.items[0]).toMatchObject({ id: 'k_1', text: 'Rewritten.' });
  });

  it('adds a risk with a fresh id from the row menu', () => {
    const onChange = vi.fn();
    render_(doc(risk()), { onChange });

    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(screen.getByText('Below'));

    const next = onChange.mock.calls.at(-1)![0] as RiskDoc;
    expect(next.items).toHaveLength(2);
    expect(next.items[1].id).toMatch(/^k_[0-9a-f]{6}$/);
  });

  it('offers no editing affordance when read-only', () => {
    render_(doc(risk()), { readOnly: true });

    expect(screen.queryByLabelText('Row actions')).toBeNull();
    expect(screen.getByLabelText('Severity of RISK-1')).toBeDisabled();
    fireEvent.click(screen.getByText('Infusion continues after occlusion.'));
    expect(screen.queryByLabelText('Hazardous situation')).toBeNull();
  });
});
