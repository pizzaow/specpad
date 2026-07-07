import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RowMenu from '../RowMenu';

function handlers() {
  return {
    onAddAbove: vi.fn(), onAddBelow: vi.fn(), onAddChild: vi.fn(), onAddHeading: vi.fn(),
    onIndent: vi.fn(), onOutdent: vi.fn(), onDelete: vi.fn(), onViewInfo: vi.fn(),
  };
}

describe('RowMenu', () => {
  it('hides the menu until the trigger is clicked', () => {
    render(<RowMenu {...handlers()} />);
    expect(screen.queryByText('Below')).toBeNull();
    fireEvent.click(screen.getByLabelText('Row actions'));
    expect(screen.getByText('Below')).toBeInTheDocument();
    expect(screen.getByText('Add heading')).toBeInTheDocument();
    expect(screen.getByText('View information')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.queryByText('Move')).toBeNull();
  });

  it('fires the matching callback and closes on selection', () => {
    const h = handlers();
    render(<RowMenu {...h} />);
    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(screen.getByText('Child'));
    expect(h.onAddChild).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Child')).toBeNull();
  });

  it('does not fire Outdent when canOutdent is false', () => {
    const h = handlers();
    render(<RowMenu {...h} canOutdent={false} />);
    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(screen.getByText('Outdent'));
    expect(h.onOutdent).not.toHaveBeenCalled();
  });

  it('renders the open menu in a body portal at popover z-index (EDA-8)', () => {
    render(
      <div data-testid="table-container">
        <RowMenu {...handlers()} />
      </div>,
    );
    fireEvent.click(screen.getByLabelText('Row actions'));
    const menu = document.querySelector('.row-menu-dropdown') as HTMLElement;
    expect(menu).toBeTruthy();
    // Portaled out of the table subtree so no row/column stacking context can obscure it.
    expect(screen.getByTestId('table-container').contains(menu)).toBe(false);
    expect(menu.parentElement).toBe(document.body);
    expect(menu.style.position).toBe('fixed');
    expect(menu.style.zIndex).toBe('1050');
  });

  it('closes via the backdrop without firing a callback', () => {
    const h = handlers();
    render(<RowMenu {...h} />);
    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(screen.getByTestId('row-menu-backdrop'));
    expect(screen.queryByText('Below')).toBeNull();
    expect(h.onAddBelow).not.toHaveBeenCalled();
  });
});
