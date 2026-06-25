import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PrdTable from '../PrdTable';
import type { PrdDoc, SrsDoc } from '../../shared';

const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'SRS',
  items: [{ id: 'r_1', code: 'R-1', text: 'Realizes the built need.', satisfies: ['p_a'] }],
};

const doc: PrdDoc = {
  schemaVersion: '1.0', type: 'prd', name: 'Acme', title: 'Product Requirements',
  items: [
    { id: 'h_0', heading: true, text: 'Vision' },
    { id: 'p_a', code: 'PROD-1', text: 'Built need.', status: 'implemented', tags: ['product'] },
    { id: 'p_b', code: 'PROD-2', text: 'Roadmap need.', status: 'proposed' },
  ],
};

describe('PrdTable', () => {
  it('renders PRD items but hides the Status and Tags columns', () => {
    render(<PrdTable doc={doc} onChange={vi.fn()} />);
    expect(screen.getByText('PROD-1')).toBeInTheDocument();
    expect(screen.getByText('Roadmap need.')).toBeInTheDocument();
    // status is assumed implemented — no inline status control
    expect(screen.queryByLabelText('Status for PROD-1')).not.toBeInTheDocument();
    // no Tags column header
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
  });

  it('flags a proposed item with a bold PROPOSED note (implemented items have none)', () => {
    render(<PrdTable doc={doc} onChange={vi.fn()} />);
    const notes = screen.getAllByText('PROPOSED');
    expect(notes).toHaveLength(1); // only PROD-2 is proposed
  });

  it('offers row actions (add/move/delete/view info) via the hamburger', () => {
    render(<PrdTable doc={doc} onChange={vi.fn()} />);
    // one row menu per non-removed row (3 items)
    expect(screen.getAllByLabelText('Row actions')).toHaveLength(3);
    fireEvent.click(screen.getAllByLabelText('Row actions')[1]);
    expect(screen.getByText('View information')).toBeInTheDocument();
    expect(screen.getByText('Above')).toBeInTheDocument();
  });

  it('shows the since-baseline redline (added rows highlighted)', () => {
    const baseline: PrdDoc = { ...doc, items: [doc.items[0], doc.items[1]] }; // p_b is new since baseline
    const { container } = render(<PrdTable doc={doc} onChange={vi.fn()} baseline={baseline} />);
    expect(container.querySelector('tr.success, tr.ct-added, .ct-changed')).toBeTruthy();
    expect(screen.getByText('Roadmap need.')).toBeInTheDocument();
  });

  it('shows each item\'s downward trace as an expandable Satisfied-by toggle', () => {
    render(<PrdTable doc={doc} srs={srs} onChange={vi.fn()} />);
    // p_a (implemented) is satisfied by R-1 — expand its toggle to see it
    fireEvent.click(screen.getByLabelText('Show requirements satisfying p_a'));
    expect(screen.getByText('R-1')).toBeInTheDocument();
    // p_b (proposed) reads as roadmap when expanded
    fireEvent.click(screen.getByLabelText('Show requirements satisfying p_b'));
    expect(screen.getByText(/roadmap/)).toBeInTheDocument();
  });

  it('flags an implemented PRD item with no satisfying requirement as a gap', () => {
    const gapDoc: PrdDoc = { ...doc, items: [{ id: 'p_c', code: 'PROD-9', text: 'Built but untraced.', status: 'implemented' }] };
    render(<PrdTable doc={gapDoc} srs={srs} onChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Show requirements satisfying p_c'));
    expect(screen.getByText(/gap/)).toBeInTheDocument();
  });

  it('is read-only in demo mode (no row actions)', () => {
    render(<PrdTable doc={doc} onChange={vi.fn()} readOnly />);
    expect(screen.queryByLabelText('Row actions')).not.toBeInTheDocument();
  });
});
