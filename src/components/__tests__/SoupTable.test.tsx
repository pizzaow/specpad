import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SoupTable from '../SoupTable';
import type { RiskDoc, SddDoc, SoupDoc, VtpDoc } from '../../shared';

/**
 * The SOUP tab (SOUP-10..12).
 *
 * The state worth surfacing is whether the anomaly evaluation still applies: it is the
 * field that rots silently, because an upgrade invalidates it and nothing else in the
 * record changes to say so.
 */

const sdd: SddDoc = {
  schemaVersion: '1.0', type: 'sdd', name: 'Acme', title: 'Detailed Design',
  items: [
    { id: 'd_1', code: 'SDD-1', title: 'validate' },
    { id: 'd_v', code: 'SDD-9', title: 'Dependency', kind: 'view' },
  ],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'Tests',
  items: [{ id: 't_1', code: 'TEST-1', text: 'Validate a bad document.', expected: 'Reported.' }],
};
const risk: RiskDoc = {
  schemaVersion: '1.0', type: 'risk', name: 'Acme', title: 'Risk',
  items: [{ id: 'k_1', code: 'RISK-1', text: 'A malformed document is accepted.', causes: ['s_1'] }],
};

const soup = (over: Partial<SoupDoc['items'][number]> = {}): SoupDoc => ({
  schemaVersion: '1.0', type: 'soup', name: 'Acme', title: 'SOUP',
  items: [
    {
      id: 's_1', code: 'SOUP-1', name: 'ajv', vendor: 'Evgeny Poberezkin', version: '8.20.0',
      requirements: 'Validates draft-07 and reports every violation.',
      anomalies: 'Issue tracker reviewed; nothing affects draft-07.',
      anomaliesReviewed: '2026-08-11',
      ...over,
    },
  ],
});

const render_ = (d: SoupDoc, props: Partial<React.ComponentProps<typeof SoupTable>> = {}) =>
  render(<SoupTable doc={d} sddDoc={sdd} vtpDoc={vtp} riskDoc={risk} onChange={vi.fn()} {...props} />);

describe('SoupTable — the row', () => {
  it('shows the identity an auditor checks first', () => {
    render_(soup());

    expect(screen.getByDisplayValue('ajv')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Evgeny Poberezkin')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8.20.0')).toBeInTheDocument();
  });

  it('dates the anomaly evaluation on the row, since staleness is the thing to notice', () => {
    render_(soup());
    expect(screen.getByText('2026-08-11')).toBeInTheDocument();
  });

  it('says plainly when the anomalies were never evaluated', () => {
    render_(soup({ anomalies: '' }));
    expect(screen.getByText('not evaluated')).toBeInTheDocument();
  });
});

describe('SoupTable — the assessment', () => {
  const expand = () => fireEvent.click(screen.getByLabelText(/Show assessment of ajv/));

  it('expands to every field the two regimes ask for', () => {
    render_(soup());
    expand();

    for (const label of [
      'Purpose and role',
      'Requirements placed on it',
      'What it needs to run',
      'Design limitations',
      'Published anomalies',
      'Support and end of life',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('offers only software units as users of the component', () => {
    render_(soup());
    expand();
    fireEvent.click(within(screen.getByRole('group', { name: /Units using ajv/ })).getByText(/add/));

    expect(screen.queryByRole('option', { name: /SDD-9/ })).toBeNull();
    expect(screen.getByRole('option', { name: /SDD-1/ })).toBeInTheDocument();
  });

  it('names the risks this component is said to cause', () => {
    render_(soup());
    expand();

    expect(screen.getByText('RISK-1')).toBeInTheDocument();
  });

  it('says so when no risk names it', () => {
    render_(soup(), { riskDoc: { ...risk, items: [] } });
    expand();

    expect(screen.getByText(/No risk names this component as a cause/)).toBeInTheDocument();
  });
});

describe('SoupTable — editing', () => {
  it('records a version change without touching the id', () => {
    const onChange = vi.fn();
    render_(soup(), { onChange });

    fireEvent.change(screen.getByDisplayValue('8.20.0'), { target: { value: '8.21.0' } });

    const next = onChange.mock.calls.at(-1)![0] as SoupDoc;
    expect(next.items[0]).toMatchObject({ id: 's_1', version: '8.21.0' });
  });

  it('adds a component with a fresh id', () => {
    const onChange = vi.fn();
    render_(soup(), { onChange });

    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(screen.getByText('Below'));

    const next = onChange.mock.calls.at(-1)![0] as SoupDoc;
    expect(next.items).toHaveLength(2);
    expect(next.items[1].id).toMatch(/^s_[0-9a-f]{6}$/);
  });

  it('offers no editing affordance when read-only, and still shows the assessment', () => {
    render_(soup(), { readOnly: true });

    expect(screen.queryByLabelText('Row actions')).toBeNull();
    expect(screen.queryByDisplayValue('ajv')).toBeNull();
    expect(screen.getByText('ajv')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Show assessment of ajv/));
    expect(screen.getByText(/Issue tracker reviewed/)).toBeInTheDocument();
  });

  it('reports an unrecorded field rather than showing an empty box', () => {
    render_(soup({ limitations: '' }), { readOnly: true });
    fireEvent.click(screen.getByLabelText(/Show assessment of ajv/));

    expect(screen.getAllByText('Not recorded.').length).toBeGreaterThan(0);
  });
});
