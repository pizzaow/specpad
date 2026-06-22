import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PrdTable from '../PrdTable';
import type { PrdDoc } from '../../shared';

const doc: PrdDoc = {
  schemaVersion: '1.0', type: 'prd', name: 'Acme', title: 'Product Requirements',
  items: [
    { id: 'h_0', heading: true, text: 'Vision' },
    { id: 'p_a', code: 'PROD-1', text: 'Built need.', status: 'implemented', tags: ['product'] },
    { id: 'p_b', code: 'PROD-2', text: 'Roadmap need.', status: 'proposed' },
  ],
};

describe('PrdTable', () => {
  it('renders PRD items with an inline status control', () => {
    render(<PrdTable doc={doc} onChange={vi.fn()} />);
    expect(screen.getByText('PROD-1')).toBeInTheDocument();
    expect(screen.getByText('Roadmap need.')).toBeInTheDocument();
    // status dropdown reflects the item's status
    const sel = screen.getByLabelText('Status for PROD-1') as HTMLSelectElement;
    expect(sel.value).toBe('implemented');
  });

  it('edits status inline via onChange', () => {
    const onChange = vi.fn();
    render(<PrdTable doc={doc} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Status for PROD-2'), { target: { value: 'implemented' } });
    const next = onChange.mock.calls.at(-1)![0] as PrdDoc;
    expect(next.items.find((i) => i.id === 'p_b')!.status).toBe('implemented');
  });

  it('adds and removes items', () => {
    const onChange = vi.fn();
    render(<PrdTable doc={doc} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Product requirement'));
    expect((onChange.mock.calls.at(-1)![0] as PrdDoc).items).toHaveLength(4);
  });

  it('shows the since-baseline redline (added rows highlighted)', () => {
    const baseline: PrdDoc = { ...doc, items: [doc.items[0], doc.items[1]] }; // p_b is new since baseline
    const { container } = render(<PrdTable doc={doc} onChange={vi.fn()} baseline={baseline} />);
    // the added row carries the redline 'added' row class
    expect(container.querySelector('tr.success, tr.ct-added, .ct-changed')).toBeTruthy();
    expect(screen.getByText('Roadmap need.')).toBeInTheDocument();
  });

  it('is read-only in demo mode (no add/edit controls)', () => {
    render(<PrdTable doc={doc} onChange={vi.fn()} readOnly />);
    expect(screen.queryByText('+ Product requirement')).not.toBeInTheDocument();
    expect((screen.getByLabelText('Status for PROD-1') as HTMLSelectElement).disabled).toBe(true);
  });
});
