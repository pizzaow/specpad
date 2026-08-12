import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SoupTable from '../SoupTable';
import type { RiskDoc, SddDoc, SoupDoc, VtpDoc } from '../../shared';

/**
 * The SOUP tab (SOUP-6..9).
 *
 * Display first: a component reads as a record, and clicking it opens the whole record
 * for editing. The state worth surfacing on the row is an end-of-life date that has
 * passed — a component whose supplier has stopped is invisible in prose.
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
      purpose: 'Validates every document against its schema.',
      ...over,
    },
  ],
});

const render_ = (d: SoupDoc, props: Partial<React.ComponentProps<typeof SoupTable>> = {}) =>
  render(
    <SoupTable doc={d} sddDoc={sdd} vtpDoc={vtp} riskDoc={risk} onChange={vi.fn()} today="2026-08-12" {...props} />,
  );

const openRecord = () => fireEvent.click(screen.getByText('ajv'));

describe('SoupTable — reading', () => {
  it('reads as a record rather than a grid of inputs', () => {
    render_(soup());

    expect(screen.getByText('ajv')).toBeInTheDocument();
    expect(screen.getByText('Evgeny Poberezkin')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('ajv')).toBeNull(); // nothing is an input until asked
  });

  it('shows the assessment without expanding anything', () => {
    render_(soup());

    expect(screen.getByText(/Validates draft-07/)).toBeInTheDocument();
    expect(screen.getByText('Purpose and role:')).toBeInTheDocument();
    expect(screen.getByText('Support and contingency:')).toBeInTheDocument();
  });

  it('names an unrecorded field rather than leaving a blank', () => {
    render_(soup({ limitations: '' }));
    expect(screen.getAllByText('Not recorded.').length).toBeGreaterThan(0);
  });
});

describe('SoupTable — end of life', () => {
  it('shows a future date plainly', () => {
    render_(soup({ endOfLife: '2027-04-30' }));
    expect(screen.getByText('2027-04-30')).toBeInTheDocument();
    expect(screen.queryByText(/ended /)).toBeNull();
  });

  it('marks a date that has already passed, which is the point of recording one', () => {
    const { container } = render_(soup({ endOfLife: '2019-07-24' }));

    expect(screen.getByText('ended 2019-07-24')).toBeInTheDocument();
    expect(container.querySelector('tr.warning')).not.toBeNull();
  });

  it('says none announced when there is no date', () => {
    render_(soup());
    expect(screen.getByText('none announced')).toBeInTheDocument();
  });
});

describe('SoupTable — clicking opens the whole record', () => {
  it('turns every field into an input at once, not just the one clicked', () => {
    render_(soup());
    openRecord();

    for (const label of ['Name of ajv', 'Supplier of ajv', 'Version of ajv', 'Licence of ajv', 'End of life of ajv']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    for (const label of ['Purpose and role of ajv', 'Requirements placed on it of ajv', 'Support and contingency of ajv']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('offers the fields hidden while reading — release date and source', () => {
    render_(soup());
    expect(screen.queryByLabelText('Release date of ajv')).toBeNull();
    expect(screen.queryByLabelText('Source of ajv')).toBeNull();

    openRecord();
    expect(screen.getByLabelText('Release date of ajv')).toBeInTheDocument();
    expect(screen.getByLabelText('Source of ajv')).toBeInTheDocument();
  });

  it('records the end-of-life date and where it came from', () => {
    const onChange = vi.fn();
    render_(soup(), { onChange });
    openRecord();

    fireEvent.change(screen.getByLabelText('End of life of ajv'), { target: { value: '2027-04-30' } });
    expect((onChange.mock.calls.at(-1)![0] as SoupDoc).items[0].endOfLife).toBe('2027-04-30');

    fireEvent.change(screen.getByLabelText('End-of-life source of ajv'), { target: { value: 'https://example.invalid' } });
    expect((onChange.mock.calls.at(-1)![0] as SoupDoc).items[0].endOfLifeSource).toBe('https://example.invalid');
  });

  it('closes on Done', () => {
    render_(soup());
    openRecord();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByLabelText('Name of ajv')).toBeNull();
  });

  it('offers only software units as users of the component', () => {
    render_(soup());
    openRecord();
    fireEvent.click(within(screen.getByRole('group', { name: /Units using ajv/ })).getByText(/add/));

    expect(screen.queryByRole('option', { name: /SDD-9/ })).toBeNull();
    expect(screen.getByRole('option', { name: /SDD-1/ })).toBeInTheDocument();
  });

  it('names the risks this component is said to cause, while reading', () => {
    render_(soup());
    expect(screen.getByText('RISK-1')).toBeInTheDocument();
  });

  it('says so when no risk names it', () => {
    render_(soup(), { riskDoc: { ...risk, items: [] } });
    expect(screen.getByText(/No risk names this component as a cause/)).toBeInTheDocument();
  });
});

describe('SoupTable — editing', () => {
  it('records a version change without touching the id', () => {
    const onChange = vi.fn();
    render_(soup(), { onChange });
    openRecord();

    fireEvent.change(screen.getByLabelText('Version of ajv'), { target: { value: '8.21.0' } });

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

  it('does not open the record when read-only, and still shows the assessment', () => {
    render_(soup(), { readOnly: true });

    expect(screen.queryByLabelText('Row actions')).toBeNull();
    fireEvent.click(screen.getByText('ajv'));

    expect(screen.queryByLabelText('Name of ajv')).toBeNull();
    expect(screen.getByText(/Validates draft-07/)).toBeInTheDocument();
  });
});
