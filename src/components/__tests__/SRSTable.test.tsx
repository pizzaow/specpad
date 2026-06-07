import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SRSTable from '../SRSTable';
import type { SrsDoc, VtpDoc } from '../../shared';
import type { RedlineView, AttributionView } from '../../changeTracking';

const srs: SrsDoc = {
  schemaVersion: '1.0',
  type: 'srs',
  name: 'AcmeApp',
  title: 'Requirements',
  items: [
    { id: 'h_001', heading: true, text: 'Functional' },
    { id: 'r_001', code: 'FUNC-1', text: 'Shall authenticate.' },
  ],
};

const vtp: VtpDoc = {
  schemaVersion: '1.0',
  type: 'vtp',
  name: 'AcmeApp',
  title: 'Tests',
  items: [{ id: 't_001', text: 'Login', verifies: ['r_001'], expected: 'ok' }],
};

describe('SRSTable', () => {
  it('renders requirement text and code', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    expect(screen.getByText('Shall authenticate.')).toBeInTheDocument();
    expect(screen.getByText('FUNC-1')).toBeInTheDocument();
  });

  it('computes test count per requirement from vtp.verifies', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    // r_001 has exactly one verifying test
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('accumulates the count when multiple tests verify the same requirement', () => {
    const vtp2: VtpDoc = {
      ...vtp,
      items: [
        { id: 't_001', text: 'A', verifies: ['r_001'], expected: '' },
        { id: 't_002', text: 'B', verifies: ['r_001'], expected: '' },
      ],
    };
    render(<SRSTable doc={srs} vtpDoc={vtp2} onSave={vi.fn()} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

describe('SRSTable change tracking', () => {
  it('marks added and modified rows and renders the History column + removed panel', () => {
    const redline: RedlineView = {
      byId: new Map([
        ['r_001', { status: 'modified', changedFields: ['text'] }],
      ]),
      removed: [{ id: 'r_old', status: 'removed', before: { id: 'r_old', text: 'Old requirement' } }],
    };
    const attribution = new Map<string, AttributionView>([
      ['r_001', { addedIn: 'v1.0', addedBoundary: true, lastChangedIn: 'v2.0', author: { name: 'Sam', email: 's@x.com' } }],
    ]);
    const { container } = render(
      <SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} redline={redline} attribution={attribution} />,
    );
    expect(container.querySelector('tr.warning')).not.toBeNull();
    expect(screen.getByText('added ≤v1.0 · changed v2.0 · Sam')).toBeInTheDocument();
    expect(screen.getByText(/Removed since baseline/)).toBeInTheDocument();
    expect(screen.getByText('Old requirement')).toBeInTheDocument();
  });

  it('renders normally with no redline/attribution props (no History column)', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    expect(screen.queryByText('History')).toBeNull();
  });
});
