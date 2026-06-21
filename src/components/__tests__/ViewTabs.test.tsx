import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewTabs from '../ViewTabs';

describe('ViewTabs', () => {
  const enabled = { overview: true, srs: true, vtp: true, testing: true, jobs: true, arch: true, releases: true, audit: true, trace: true };

  it('renders the three labels and marks the active one', () => {
    const { container } = render(<ViewTabs current="srs" enabled={enabled} onSelect={vi.fn()} />);
    expect(screen.getByText('Requirements')).toBeInTheDocument();
    expect(screen.getByText('Verification Tests')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(container.querySelector('li.active')?.textContent).toBe('Requirements');
  });

  it('leads with Overview and separates the tab groups', () => {
    const { container } = render(<ViewTabs current="overview" enabled={enabled} onSelect={vi.fn()} />);
    // Overview is the leftmost tab; Jobs is no longer first.
    expect(container.querySelector('li:first-child')?.textContent).toBe('Overview');
    // Two separators divide home | authoring | oversight.
    expect(container.querySelectorAll('li.tab-sep').length).toBe(2);
    // Jobs sits in the oversight group, after the authoring views.
    const labels = [...container.querySelectorAll('li:not(.tab-sep) > a')].map((a) => a.textContent);
    expect(labels).toEqual(['Overview', 'Requirements', 'Verification Tests', 'Results', 'Architecture', 'Auditor', 'Traceability', 'Releases', 'Jobs']);
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
      <ViewTabs current="srs" enabled={{ overview: true, srs: true, vtp: false, testing: false, jobs: false, arch: false, releases: false, audit: false, trace: false }} onSelect={onSelect} />,
    );
    const vtpTab = screen.getByText('Verification Tests').closest('li');
    expect(vtpTab?.className).toContain('disabled');
    fireEvent.click(screen.getByText('Verification Tests'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
