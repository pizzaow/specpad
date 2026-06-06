import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SRSTable from '../SRSTable';
import type { SrsDoc, VtpDoc } from '../../shared';

const srs: SrsDoc = {
  schemaVersion: '1.0',
  type: 'srs',
  name: 'AcmeApp',
  title: 'Requirements',
  items: [
    { id: 'h_001', heading: true, text: 'Functional' },
    { id: 'r_001', code: 'FUNC-1', text: 'Shall authenticate.' },
  ],
};

const vtp: VtpDoc = {
  schemaVersion: '1.0',
  type: 'vtp',
  name: 'AcmeApp',
  title: 'Tests',
  items: [{ id: 't_001', text: 'Login', verifies: ['r_001'], expected: 'ok' }],
};

describe('SRSTable', () => {
  it('renders requirement text and code', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    expect(screen.getByText('Shall authenticate.')).toBeInTheDocument();
    expect(screen.getByText('FUNC-1')).toBeInTheDocument();
  });

  it('computes test count per requirement from vtp.verifies', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    // r_001 has exactly one verifying test
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('accumulates the count when multiple tests verify the same requirement', () => {
    const vtp2: VtpDoc = {
      ...vtp,
      items: [
        { id: 't_001', text: 'A', verifies: ['r_001'], expected: '' },
        { id: 't_002', text: 'B', verifies: ['r_001'], expected: '' },
      ],
    };
    render(<SRSTable doc={srs} vtpDoc={vtp2} onSave={vi.fn()} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
