import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AuditView from '../AuditView';
import type { PrdDoc, SrsDoc, VtpDoc } from '../../shared';

const prd: PrdDoc = {
  schemaVersion: '1.0', type: 'prd', name: 'Acme', title: 'PRD',
  items: [
    { id: 'p_a', code: 'PROD-1', text: 'Built need.', status: 'implemented' },
    { id: 'p_b', code: 'PROD-2', text: 'Roadmap need.', status: 'proposed' },
  ],
};
const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'SRS',
  items: [
    { id: 'r_1', code: 'R-1', text: 'Verified requirement.', satisfies: ['p_a'] },
    { id: 'r_2', code: 'R-2', text: 'Unverified requirement.' },
  ],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'VTP',
  items: [{ id: 't_1', code: 'T-1', text: 'Test', verifies: ['r_1'], expected: 'ok', result: 'passed' }],
};

describe('AuditView', () => {
  it('renders coverage, the trace matrix, gaps, and the scope disclaimer', () => {
    const { container } = render(<AuditView prd={prd} srs={srs} vtp={vtp} />);
    const headings = [...container.querySelectorAll('h4')].map((h) => h.textContent);
    expect(headings.some((h) => /Coverage/.test(h ?? ''))).toBe(true);
    expect(headings.some((h) => /Traceability matrix/.test(h ?? ''))).toBe(true);
    expect(headings.some((h) => /Gaps/.test(h ?? ''))).toBe(true);
    // disclaimer
    expect(screen.getByText(/not itself a quality-management system/i)).toBeInTheDocument();
    // trace matrix links PRD and test codes
    expect(screen.getByText('PROD-1')).toBeInTheDocument();
    expect(screen.getByText('T-1')).toBeInTheDocument();
  });

  it('flags an unverified requirement (no_test row, gap listed)', () => {
    const { container } = render(<AuditView prd={prd} srs={srs} vtp={vtp} />);
    // r_2 has no verifying test → its row is marked danger
    expect(container.querySelector('tr.danger')).toBeTruthy();
    // and it appears in the gap list as a traceability finding
    expect(screen.getByText(/has no verifying test/i)).toBeInTheDocument();
  });

  it('shows the proposed-PRD roadmap section', () => {
    render(<AuditView prd={prd} srs={srs} vtp={vtp} />);
    expect(screen.getByText(/Roadmap \(proposed product requirements\)/i)).toBeInTheDocument();
    expect(screen.getByText('Roadmap need.')).toBeInTheDocument();
  });

  it('reports governance-clean when there are no violations', () => {
    const cleanSrs: SrsDoc = { ...srs, items: [{ id: 'r_1', code: 'R-1', text: 'Verified.', satisfies: ['p_a'] }] };
    render(<AuditView prd={prd} srs={cleanSrs} vtp={vtp} />);
    expect(screen.getByText(/Governance-clean/i)).toBeInTheDocument();
  });

  it('works without a PRD register', () => {
    render(<AuditView prd={null} srs={srs} vtp={vtp} />);
    expect(screen.getByText(/Requirement → verification \(no PRD register\)/i)).toBeInTheDocument();
  });
});
