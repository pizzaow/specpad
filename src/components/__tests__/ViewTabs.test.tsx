import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewTabs from '../ViewTabs';

describe('ViewTabs', () => {
  const enabled = { srs: true, vtp: true, testing: true, jobs: true, arch: true, releases: true, audit: true };

  it('renders the three labels and marks the active one', () => {
    const { container } = render(<ViewTabs current="srs" enabled={enabled} onSelect={vi.fn()} />);
    expect(screen.getByText('Requirements')).toBeInTheDocument();
    expect(screen.getByText('Verification Tests')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(container.querySelector('li.active')?.textContent).toBe('Requirements');
  });

  it('places Jobs as the leftmost tab', () => {
    const { container } = render(<ViewTabs current="srs" enabled={enabled} onSelect={vi.fn()} />);
    expect(container.querySelector('li:first-child')?.textContent).toBe('Jobs');
  });

  it('includes an Architecture tab', () => {
    render(<ViewTabs current="srs" enabled={enabled} onSelect={vi.fn()} />);
    expect(screen.getByText('Architecture')).toBeInTheDocument();
  });

  it('includes an Auditor tab', () => {
    render(<ViewTabs current="srs" enabled={enabled} onSelect={vi.fn()} />);
    expect(screen.getByText('Auditor')).toBeInTheDocument();
  });

  it('selects a tab on click', () => {
    const onSelect = vi.fn();
    render(<ViewTabs current="srs" enabled={enabled} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Verification Tests'));
    expect(onSelect).toHaveBeenCalledWith('vtp');
  });

  it('disables a tab whose document is absent and does not select it', () => {
    const onSelect = vi.fn();
    render(
      <ViewTabs current="srs" enabled={{ srs: true, vtp: false, testing: false, jobs: false, arch: false, releases: false, audit: false }} onSelect={onSelect} />,
    );
    const vtpTab = screen.getByText('Verification Tests').closest('li');
    expect(vtpTab?.className).toContain('disabled');
    fireEvent.click(screen.getByText('Verification Tests'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
