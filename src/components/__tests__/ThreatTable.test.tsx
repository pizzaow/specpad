import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ThreatTable from '../ThreatTable';
import type { RiskDoc, SddDoc, SoupDoc, SrsDoc, ThreatDoc, VtpDoc, RunRecord } from '../../shared';

/**
 * The Threats tab (SEC-6..8).
 *
 * Exploitability sits where a probability would, and a control's state comes from the
 * tests of the requirement implementing it — the same evidence the risk table uses,
 * because a control is a requirement in both registers.
 */

const sdd: SddDoc = {
  schemaVersion: '1.0', type: 'sdd', name: 'Acme', title: 'Detailed Design',
  items: [{ id: 'd_1', code: 'SDD-1', title: 'auth' }, { id: 'd_v', code: 'SDD-9', title: 'Deps', kind: 'view' }],
};
const soup: SoupDoc = {
  schemaVersion: '1.0', type: 'soup', name: 'Acme', title: 'SOUP',
  items: [{ id: 's_1', code: 'SOUP-1', name: 'ajv' }],
};
const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'Requirements',
  items: [
    { id: 'r_1', code: 'AUTH-1', text: 'Identity shall come from a trusted peer.' },
    { id: 'r_2', code: 'AUTH-2', text: 'Untested control.' },
  ],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'Tests',
  items: [{ id: 't_1', code: 'TEST-1', text: 'Assert from an untrusted peer.', verifies: ['r_1'], expected: 'Refused.', automation: [{ runner: 'vitest', file: 'a.test.ts', selector: 'auth' }] }],
};
const risk: RiskDoc = {
  schemaVersion: '1.0', type: 'risk', name: 'Acme', title: 'Risk',
  items: [{ id: 'k_1', code: 'RISK-1', text: 'Misattributed change.' }],
};
const run: RunRecord = {
  schemaVersion: '1.0', type: 'run', name: 'Acme', runner: 'vitest', ref: 'abc', ranAt: '2026-08-12',
  summary: { total: 1, passed: 1, failed: 0, skipped: 0 },
  results: [{ file: 'a.test.ts', selector: 'auth', status: 'passed' }],
};

const doc = (over: Partial<ThreatDoc['items'][number]> = {}): ThreatDoc => ({
  schemaVersion: '1.0', type: 'threat', name: 'Acme', title: 'Threats',
  items: [{
    id: 'x_1', code: 'THR-1', text: 'An attacker asserts an identity header.',
    asset: 'The authenticated identity', entryPoint: 'The HTTP API',
    category: 'spoofing', exploitability: 'low', impact: 'serious',
    causes: ['d_1'], controls: ['r_1'], safetyRisk: ['k_1'], residual: 'acceptable', ...over,
  }],
});

const render_ = (d: ThreatDoc, props: Partial<React.ComponentProps<typeof ThreatTable>> = {}) =>
  render(<ThreatTable doc={d} sddDoc={sdd} soupDoc={soup} srsDoc={srs} vtpDoc={vtp} riskDoc={risk} run={run} onChange={vi.fn()} {...props} />);

describe('ThreatTable — the analysis', () => {
  it('rates exploitability rather than probability', () => {
    render_(doc());
    expect(screen.getByLabelText('Exploitability of THR-1')).toHaveValue('low');
    expect(screen.queryByLabelText(/Probability/i)).toBeNull();
  });

  it('shows the STRIDE category and the impact', () => {
    render_(doc());
    expect(screen.getByLabelText('Category of THR-1')).toHaveValue('spoofing');
    expect(screen.getByLabelText('Impact of THR-1')).toHaveValue('serious');
  });

  it('marks a highly exploitable threat with a critical consequence', () => {
    const { container } = render_(doc({ exploitability: 'high', impact: 'critical' }));
    expect(container.querySelector('tr.danger')).not.toBeNull();
  });

  it('does not mark a low-exploitability threat', () => {
    const { container } = render_(doc());
    expect(container.querySelector('tr.danger')).toBeNull();
  });
});

describe('ThreatTable — attack surface and the safety join', () => {
  const expand = () => fireEvent.click(screen.getByLabelText('Show detail for THR-1'));

  it('offers units and components as attack surface, but not a design view', () => {
    render_(doc());
    expand();
    fireEvent.click(within(screen.getByRole('group', { name: /Attack surface of THR-1/ })).getByText(/add/));

    expect(screen.getByRole('option', { name: /SOUP-1/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /SDD-9/ })).toBeNull();
  });

  it('links the safety risk exploiting it would create', () => {
    render_(doc());
    expand();
    const picker = screen.getByRole('group', { name: /Safety risks created by THR-1/ });
    expect(within(picker).getByText('RISK-1')).toBeInTheDocument();
  });

  it('states plainly when a threat has no patient consequence', () => {
    render_(doc({ safetyRisk: [] }));
    expand();
    expect(screen.getByText(/no patient consequence/i)).toBeInTheDocument();
  });

  it('records the asset and entry point', () => {
    const onChange = vi.fn();
    render_(doc(), { onChange });
    expand();
    fireEvent.change(screen.getByLabelText('Entry point of THR-1'), { target: { value: 'The event stream' } });
    expect((onChange.mock.calls.at(-1)![0] as ThreatDoc).items[0].entryPoint).toBe('The event stream');
  });
});

describe('ThreatTable — whether the defence is demonstrated', () => {
  it('reads verified when the controlling requirement has a passing test', () => {
    render_(doc());
    expect(screen.getByText('verified')).toBeInTheDocument();
  });

  it('reads no test when the control has none', () => {
    render_(doc({ controls: ['r_2'] }));
    expect(screen.getByText('no test')).toBeInTheDocument();
  });

  it('reads no control, and flags a missing justification', () => {
    render_(doc({ controls: [] }));
    expect(screen.getByText('no control')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Show detail for THR-1'));
    expect(screen.getByText(/No justification recorded/)).toBeInTheDocument();
  });

  it('shows the justification when the threat is knowingly uncontrolled', () => {
    render_(doc({ controls: [], justification: 'Accepted; controlled by the deployment network.' }));
    fireEvent.click(screen.getByLabelText('Show detail for THR-1'));
    expect(screen.getByText(/controlled by the deployment network/)).toBeInTheDocument();
  });
});

describe('ThreatTable — read-only (EDR-3)', () => {
  it('offers no editing affordance', () => {
    render_(doc(), { readOnly: true });
    expect(screen.queryByLabelText('Row actions')).toBeNull();
    expect(screen.getByLabelText('Exploitability of THR-1')).toBeDisabled();
    fireEvent.click(screen.getByText('An attacker asserts an identity header.'));
    expect(screen.queryByLabelText('Threat')).toBeNull();
  });
});
