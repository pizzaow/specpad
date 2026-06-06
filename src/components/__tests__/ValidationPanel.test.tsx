import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ValidationPanel from '../ValidationPanel';
import type { SrsDoc, VtpDoc } from '../../shared';

const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'AcmeApp', title: 'Requirements',
  items: [{ id: 'r_001', text: 'Shall authenticate.' }],
};
const vtpEmpty: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'AcmeApp', title: 'Tests', items: [],
};

describe('ValidationPanel', () => {
  it('shows a clean state when there are no problems', () => {
    const goodVtp: VtpDoc = { ...vtpEmpty, items: [{ id: 't_001', text: 'Login', verifies: ['r_001'], expected: 'ok' }] };
    render(<ValidationPanel srsDoc={srs} vtpDoc={goodVtp} projectDoc={null} />);
    expect(screen.getByText(/no problems/i)).toBeInTheDocument();
  });

  it('reports a traceability violation when a requirement has no test', () => {
    render(<ValidationPanel srsDoc={srs} vtpDoc={vtpEmpty} projectDoc={null} />);
    expect(screen.getByText(/no verifying test/i)).toBeInTheDocument();
  });
});
