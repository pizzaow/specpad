import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewTabs from '../ViewTabs';

const enabled = { overview: true, prd: true, srs: true, vtp: true, testing: true, jobs: true, arch: true, releases: true, audit: true, trace: true };

describe('ViewTabs', () => {
  it('renders the tabs and marks the active one', () => {
    const { container } = render(<ViewTabs current="srs" enabled={enabled} onSelect={vi.fn()} />);
    expect(screen.getByText('Requirements')).toBeInTheDocument();
    expect(screen.getByText('Verification Tests')).toBeInTheDocument();
    expect(screen.getByText('Auditor')).toBeInTheDocument();
    expect(container.querySelector('.view-tab.active')?.textContent).toBe('Requirements');
  });

  it('leads with Overview, then Product Requirements, in order', () => {
    const { container } = render(<ViewTabs current="overview" enabled={enabled} onSelect={vi.fn()} />);
    const labels = [...container.querySelectorAll('.view-tab')].map((a) => a.textContent);
    expect(labels).toEqual(['Overview', 'Product Requirements', 'Requirements', 'Verification Tests', 'Results', 'Architecture', 'Auditor', 'Traceability', 'Releases', 'Jobs']);
  });

  it('labels each design-control phase with a band (Design Inputs spans the requirements tabs)', () => {
    const { container } = render(<ViewTabs current="overview" enabled={enabled} onSelect={vi.fn()} />);
    const bands = [...container.querySelectorAll('.phase-band')].map((b) => b.textContent);
    expect(bands).toEqual(['Design Inputs', 'Design Verification', 'Design Outputs', 'Design Controls', 'Traceability', 'Design History', 'Design Changes']);
    // "Design Inputs" spans Product Requirements + Requirements (columns 2–3).
    const inputs = [...container.querySelectorAll('.phase-band')].find((b) => b.textContent === 'Design Inputs') as HTMLElement;
    expect(inputs.style.gridColumn).toBe('2 / span 2');
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
      <ViewTabs current="srs" enabled={{ overview: true, prd: false, srs: true, vtp: false, testing: false, jobs: false, arch: false, releases: false, audit: false, trace: false }} onSelect={onSelect} />,
    );
    const vtpTab = screen.getByText('Verification Tests');
    expect(vtpTab.className).toContain('disabled');
    fireEvent.click(vtpTab);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
