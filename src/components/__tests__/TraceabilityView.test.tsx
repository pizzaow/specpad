import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TraceabilityView from '../TraceabilityView';
import type { PrdDoc, SrsDoc, VtpDoc } from '../../shared';

const prd: PrdDoc = {
  schemaVersion: '1.0', type: 'prd', name: 'Acme', title: 'PRD',
  items: [{ id: 'p_a', code: 'PROD-1', text: 'Built need.', status: 'implemented' }],
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

describe('TraceabilityView', () => {
  it('renders coverage and the matrix linking PRD → requirement → test', () => {
    const { container } = render(<TraceabilityView prd={prd} srs={srs} vtp={vtp} />);
    const headings = [...container.querySelectorAll('h4')].map((h) => h.textContent);
    expect(headings.some((h) => /Coverage/.test(h ?? ''))).toBe(true);
    expect(headings.some((h) => /Matrix/.test(h ?? ''))).toBe(true);
    expect(screen.getByText('1/2')).toBeInTheDocument(); // 1 of 2 verified
    expect(screen.getByText('PROD-1')).toBeInTheDocument();
    expect(screen.getByText('T-1')).toBeInTheDocument();
  });

  it('flags an unverified requirement and lists the governance finding', () => {
    const { container } = render(<TraceabilityView prd={prd} srs={srs} vtp={vtp} />);
    expect(container.querySelector('tr.danger')).toBeTruthy();
    expect(screen.getByText(/has no verifying test/i)).toBeInTheDocument();
  });

  it('reports governance-clean when there are no violations', () => {
    const cleanSrs: SrsDoc = { ...srs, items: [{ id: 'r_1', code: 'R-1', text: 'Verified.', satisfies: ['p_a'] }] };
    render(<TraceabilityView prd={prd} srs={cleanSrs} vtp={vtp} />);
    expect(screen.getByText(/Governance-clean/i)).toBeInTheDocument();
  });

  it('works without a PRD register', () => {
    render(<TraceabilityView prd={null} srs={srs} vtp={vtp} />);
    expect(screen.getByText(/Requirement → verification \(no PRD register\)/i)).toBeInTheDocument();
  });
});
