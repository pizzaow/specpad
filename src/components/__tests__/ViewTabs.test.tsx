import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewTabs from '../ViewTabs';

const enabled = { overview: true, prd: true, srs: true, vtp: true, testing: true, jobs: true, arch: true, sdd: false, risk: false, soup: false, threat: false, sec: false, reference: false, releases: true, audit: true, trace: true };

describe('ViewTabs', () => {
  it('labels each document tab by its acronym, with the full name on hover', () => {
    render(<ViewTabs current="srs" enabled={enabled} onSelect={vi.fn()} />);
    // The acronym is what a regulated team says out loud; the full name must still be
    // reachable for someone who does not know it yet.
    expect(screen.getByText('PRD')).toHaveAttribute('title', 'Product Requirements');
    expect(screen.getByText('SAD')).toHaveAttribute('title', 'Software Architecture Document');
    expect(screen.getByText('SDD')).toHaveAttribute('title', 'Software Detailed Design');
    // Views that are not a document keep their word, and need no tooltip.
    expect(screen.getByText('Auditor')).not.toHaveAttribute('title');
  });

  it('renders the tabs and marks the active one', () => {
    const { container } = render(<ViewTabs current="srs" enabled={enabled} onSelect={vi.fn()} />);
    expect(screen.getByText('SRS')).toBeInTheDocument();
    expect(screen.getByText('VTP')).toBeInTheDocument();
    expect(screen.getByText('Auditor')).toBeInTheDocument();
    expect(container.querySelector('.view-tab.active')?.textContent).toBe('SRS');
  });

  it('orders the tabs chronologically through the design-control phases', () => {
    const { container } = render(<ViewTabs current="overview" enabled={enabled} onSelect={vi.fn()} />);
    const labels = [...container.querySelectorAll('.view-tab')].map((a) => a.textContent);
    expect(labels).toEqual(['Overview', 'PRD', 'SRS', 'Refs', 'SAD', 'SDD', 'SOUP', 'Security', 'Risk', 'Threats', 'VTP', 'Results', 'Auditor', 'Traceability', 'Releases', 'Jobs']);
  });

  it('labels each design-control phase with a band (Design Inputs spans the requirements tabs)', () => {
    const { container } = render(<ViewTabs current="overview" enabled={enabled} onSelect={vi.fn()} />);
    const bands = [...container.querySelectorAll('.phase-band')].map((b) => b.textContent);
    expect(bands).toEqual(['Design Inputs', 'Design Outputs', 'Risk Management', 'Design Verification', 'Design Controls', 'Traceability', 'Design History', 'Design Changes']);
    // "Design Inputs" spans PRD + SRS + Refs (columns 2–4).
    const inputs = [...container.querySelectorAll('.phase-band')].find((b) => b.textContent === 'Design Inputs') as HTMLElement;
    expect(inputs.style.gridColumn).toBe('2 / span 3');
    // "Design Verification" spans VTP + Results — columns 11–12: Design Outputs covers
    // SAD, SDD, SOUP and Security, and Risk Management covers Risk and Threats.
    const verification = [...container.querySelectorAll('.phase-band')].find((b) => b.textContent === 'Design Verification') as HTMLElement;
    expect(verification.style.gridColumn).toBe('11 / span 2');
  });

  it('selects a tab on click', () => {
    const onSelect = vi.fn();
    render(<ViewTabs current="srs" enabled={enabled} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('VTP'));
    expect(onSelect).toHaveBeenCalledWith('vtp');
  });

  it('disables a tab whose document is absent and does not select it', () => {
    const onSelect = vi.fn();
    render(
      <ViewTabs current="srs" enabled={{ overview: true, prd: false, srs: true, vtp: false, testing: false, jobs: false, arch: false, sdd: false, risk: false, soup: false, threat: false, sec: false, reference: false, releases: false, audit: false, trace: false }} onSelect={onSelect} />,
    );
    const vtpTab = screen.getByText('VTP');
    expect(vtpTab.className).toContain('disabled');
    fireEvent.click(vtpTab);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
