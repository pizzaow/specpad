import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StatusBar from '../StatusBar';
import type { SrsDoc, VtpDoc } from '../../shared';

const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'AcmeApp', title: 'Requirements',
  items: [{ id: 'r_001', text: 'Shall authenticate.' }, { id: 'r_002', text: 'Shall log out.' }],
};
const cleanVtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'AcmeApp', title: 'Tests',
  items: [
    { id: 't_001', text: 'Login', verifies: ['r_001'], expected: 'ok' },
    { id: 't_002', text: 'Logout', verifies: ['r_002'], expected: 'ok' },
  ],
};

describe('StatusBar', () => {
  it('shows the path and a clean status when there are no problems', () => {
    render(<StatusBar path="docs/specpad/AcmeApp" srsDoc={srs} vtpDoc={cleanVtp} projectDoc={null} />);
    expect(screen.getByText('docs/specpad/AcmeApp')).toBeInTheDocument();
    expect(screen.getByText(/No problems found/)).toBeInTheDocument();
  });

  it('summarizes problems and expands details on click', () => {
    // r_002 has no verifying test (traceability); t_002 below has empty expected (missing-expected)
    const vtp: VtpDoc = {
      schemaVersion: '1.0', type: 'vtp', name: 'AcmeApp', title: 'Tests',
      items: [
        { id: 't_001', text: 'Login', verifies: ['r_001'], expected: 'ok' },
        { id: 't_002', text: 'Logout', verifies: [], expected: '' },
      ],
    };
    render(<StatusBar path="p" srsDoc={srs} vtpDoc={vtp} projectDoc={null} />);
    const summary = screen.getByText(/error|warning|problem/i);
    fireEvent.click(summary);
    expect(screen.getByText(/r_002/)).toBeInTheDocument(); // a governance detail naming the item
  });
});
