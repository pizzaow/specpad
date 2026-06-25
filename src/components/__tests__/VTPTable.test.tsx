import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VTPTable from '../VTPTable';
import type { SrsDoc, VtpDoc } from '../../shared';
import type { RedlineView, AttributionView } from '../../changeTracking';

const srs: SrsDoc = {
  schemaVersion: '1.0',
  type: 'srs',
  name: 'AcmeApp',
  title: 'Requirements',
  items: [{ id: 'r_001', code: 'FUNC-1', text: 'Shall authenticate.' }],
};

const vtp: VtpDoc = {
  schemaVersion: '1.0',
  type: 'vtp',
  name: 'AcmeApp',
  title: 'Tests',
  items: [
    { id: 't_001', code: 'TEST-1', text: 'Login', verifies: ['r_001'], expected: 'ok' },
    { id: 't_002', text: 'Dangling', verifies: ['r_999'], expected: 'x' },
  ],
};

describe('VTPTable', () => {
  it('shows verifies as an expandable toggle that reveals the verified requirement label', () => {
    render(<VTPTable doc={vtp} srsDoc={srs} onChange={vi.fn()} />);
    expect(screen.getByText('Login')).toBeInTheDocument();
    // collapsed: the requirement label is not shown until the verifies toggle is expanded
    expect(screen.queryByText(/FUNC-1/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Show requirements verified by t_001'));
    expect(screen.getByText(/FUNC-1/)).toBeInTheDocument();
  });

  it('marks a row whose verifies ref does not resolve', () => {
    const { container } = render(<VTPTable doc={vtp} srsDoc={srs} onChange={vi.fn()} />);
    expect(container.querySelector('tr.danger')).not.toBeNull();
  });

  it('does not show a Result column (this is the plan, not the results)', () => {
    render(<VTPTable doc={vtp} srsDoc={srs} onChange={vi.fn()} />);
    expect(screen.queryByText('Result')).not.toBeInTheDocument();
  });

  it('offers SRS-style row actions via the hamburger', () => {
    render(<VTPTable doc={vtp} srsDoc={srs} onChange={vi.fn()} />);
    expect(screen.getAllByLabelText('Row actions')).toHaveLength(2);
  });
});

describe('VTPTable change tracking', () => {
  it('marks a modified row, lists removed tests, and surfaces attribution in the info dialog', () => {
    const redline: RedlineView = {
      byId: new Map([['t_001', { status: 'modified', changedFields: ['expected'] }]]),
      removed: [{ id: 't_old', status: 'removed', before: { id: 't_old', text: 'Old test' } }],
    };
    const attribution = new Map<string, AttributionView>([
      ['t_001', { addedIn: 'v1.0', addedBoundary: false, lastChangedIn: 'v1.0', author: { name: 'Sam', email: 's@x.com' } }],
    ]);
    const { container } = render(
      <VTPTable doc={vtp} srsDoc={srs} onChange={vi.fn()} redline={redline} attribution={attribution} />,
    );
    expect(container.querySelector('tr.warning')).not.toBeNull();
    expect(screen.getByText(/Removed since baseline/)).toBeInTheDocument();
    expect(screen.getByText('Old test')).toBeInTheDocument();
    // history (attribution) now lives in the info dialog, not a column
    expect(screen.queryByText('v1.0 · Sam')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
    fireEvent.click(screen.getByText('View information'));
    expect(screen.getByText('v1.0 · Sam')).toBeInTheDocument();
  });
});
