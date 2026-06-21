import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuditView from '../AuditView';
import type { PrdDoc, SrsDoc, VtpDoc, ReleasesDoc, JobRecord } from '../../shared';

const prd: PrdDoc = {
  schemaVersion: '1.0', type: 'prd', name: 'Acme', title: 'PRD',
  items: [
    { id: 'p_a', code: 'PROD-1', text: 'Built need.', status: 'implemented' },
    { id: 'p_b', code: 'PROD-2', text: 'Roadmap need.', status: 'proposed' },
  ],
};
const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'SRS',
  items: [{ id: 'r_1', code: 'R-1', text: 'A requirement.', satisfies: ['p_a'] }],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'VTP',
  items: [{ id: 't_1', code: 'T-1', text: 'Test', verifies: ['r_1'], expected: 'ok', result: 'passed' }],
};
const releases: ReleasesDoc = {
  schemaVersion: '1.0', type: 'releases', name: 'Acme', tagPattern: 'v*', baseline: 'v1',
  releases: [{ version: 'v1', ref: 'a', date: '2026-01-01', author: { name: 'G', email: 'g@x' }, snapshot: null }],
};
const jobs: JobRecord[] = [{ id: 'j1', code: 'JOB-1', title: 'Work', status: 'open' }];

const render_ = (onNavigate = vi.fn()) =>
  render(<AuditView prd={prd} srs={srs} vtp={vtp} jobs={jobs} releases={releases} hasArchitecture onNavigate={onNavigate} />);

describe('AuditView', () => {
  it('shows the scope disclaimer and the design-control map with citations', () => {
    render_();
    expect(screen.getByText(/not itself a quality-management system/i)).toBeInTheDocument();
    expect(screen.getByText('Design Inputs')).toBeInTheDocument();
    expect(screen.getByText('Design Verification')).toBeInTheDocument();
    expect(screen.getByText(/820\.30\(c\)/)).toBeInTheDocument(); // a formal citation
  });

  it('shows a status badge per element (including honest gaps)', () => {
    const { container } = render_();
    expect(container.querySelectorAll('.dc-status').length).toBeGreaterThanOrEqual(10);
    // Design Validation is a known gap
    expect(container.querySelector('.dc-status.gap')).toBeTruthy();
  });

  it('links an element to the tab that holds its evidence', () => {
    const onNavigate = vi.fn();
    render_(onNavigate);
    // The Traceability pointer at the bottom navigates to the trace tab.
    fireEvent.click(screen.getByRole('button', { name: 'Traceability' }));
    expect(onNavigate).toHaveBeenCalledWith('trace');
  });

  it('lists the roadmap (proposed PRD items) but not the trace matrix', () => {
    render_();
    expect(screen.getByText(/Roadmap \(proposed product requirements\)/i)).toBeInTheDocument();
    expect(screen.getByText('Roadmap need.')).toBeInTheDocument();
    // The matrix lives in the Traceability tab — the Auditor view has no "Matrix" heading.
    const headings = [...document.querySelectorAll('h4')].map((h) => h.textContent);
    expect(headings.some((h) => /Matrix/.test(h ?? ''))).toBe(false);
  });
});
