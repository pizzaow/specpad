import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ItemInfo from '../ItemInfo';
import type { SrsItem } from '../../shared';
import type { AttributionView } from '../../changeTracking';

const req: SrsItem = { id: 'r_001', code: 'DOC-1', text: 'Shall work.', level: 1, tags: ['schema'], hazards: ['SEC-1'] };
const attribution: AttributionView = { addedIn: 'v0.1', addedBoundary: true, lastChangedIn: 'v1.0', author: { name: 'Sam', email: 's@x.com' } };

describe('ItemInfo', () => {
  it('shows the item metadata', () => {
    render(<ItemInfo item={req} code="DOC-1" testCount={3} attribution={attribution} onClose={vi.fn()} />);
    expect(screen.getByText('r_001')).toBeInTheDocument();
    expect(screen.getByText('DOC-1')).toBeInTheDocument();
    expect(screen.getByText('schema')).toBeInTheDocument();
    expect(screen.getByText('SEC-1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/≤v0.1/)).toBeInTheDocument();
    expect(screen.getByText(/v1.0 · Sam/)).toBeInTheDocument();
  });

  it('omits the Tests row for a heading', () => {
    const heading: SrsItem = { id: 'h_1', text: 'Section', heading: true };
    render(<ItemInfo item={heading} code="Section" testCount={0} onClose={vi.fn()} />);
    expect(screen.queryByText('Tests')).toBeNull();
  });

  it('calls onClose from the close button and the backdrop', () => {
    const onClose = vi.fn();
    render(<ItemInfo item={req} code="DOC-1" testCount={0} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close'));
    fireEvent.click(screen.getByTestId('item-info-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
