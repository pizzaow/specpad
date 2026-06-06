import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import VTPTable from '../VTPTable';
import type { SrsDoc, VtpDoc } from '../../shared';

const srs: SrsDoc = {
  schemaVersion: '1.0',
  type: 'srs',
  name: 'AcmeApp',
  title: 'Requirements',
  items: [{ id: 'r_001', code: 'FUNC-1', text: 'Shall authenticate.' }],
};

const vtp: VtpDoc = {
  schemaVersion: '1.0',
  type: 'vtp',
  name: 'AcmeApp',
  title: 'Tests',
  items: [
    { id: 't_001', code: 'TEST-1', text: 'Login', verifies: ['r_001'], expected: 'ok' },
    { id: 't_002', text: 'Dangling', verifies: ['r_999'], expected: 'x' },
  ],
};

describe('VTPTable', () => {
  it('renders the verifying requirement label for a valid ref', () => {
    render(<VTPTable doc={vtp} srsDoc={srs} onSave={vi.fn()} />);
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText(/FUNC-1/)).toBeInTheDocument();
  });

  it('marks a row whose verifies ref does not resolve', () => {
    const { container } = render(<VTPTable doc={vtp} srsDoc={srs} onSave={vi.fn()} />);
    expect(container.querySelector('tr.danger')).not.toBeNull();
  });
});
