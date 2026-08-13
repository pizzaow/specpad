import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReferenceTable from '../ReferenceTable';
import type { ReferenceDoc } from '../../shared';

/**
 * The References tab (JOB-56).
 *
 * A plain table on purpose: the register exists to name the procedures SpecPad does not
 * hold, and it is meant to stay short, so the view does nothing to encourage length.
 */

const doc: ReferenceDoc = {
  schemaVersion: '1.0', type: 'reference', name: 'Acme', title: 'References',
  items: [
    { id: 'h_1', title: 'Quality system', heading: true },
    {
      id: 'f_1', code: 'REF-1', title: 'Software Problem Resolution Procedure',
      kind: 'sop', identifier: 'SOP-012 rev C', location: 'https://qms.acme.example/SOP-012',
      owner: 'Quality', covers: ['IEC 62304 clause 9', 'IEC 62304 8.2.4'],
    },
  ],
};

describe('ReferenceTable', () => {
  it('shows each entry with what it is, where it is, and what it covers', () => {
    render(<ReferenceTable doc={doc} onChange={() => {}} />);
    expect(screen.getByDisplayValue('Software Problem Resolution Procedure')).toBeInTheDocument();
    expect(screen.getByDisplayValue('SOP-012 rev C')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://qms.acme.example/SOP-012')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Quality')).toBeInTheDocument();
    // `covers` is a list, edited as one comma-separated field.
    expect(screen.getByDisplayValue('IEC 62304 clause 9, IEC 62304 8.2.4')).toBeInTheDocument();
  });

  it('reports an edit, splitting covers back into a list', () => {
    const onChange = vi.fn();
    render(<ReferenceTable doc={doc} onChange={onChange} />);

    fireEvent.change(screen.getByDisplayValue('Quality'), { target: { value: 'Regulatory' } });
    expect(onChange.mock.calls[0][0].items[1].owner).toBe('Regulatory');

    onChange.mockClear();
    fireEvent.change(screen.getByDisplayValue('IEC 62304 clause 9, IEC 62304 8.2.4'), {
      target: { value: 'IEC 62304 clause 9,  5.1 planning , ' },
    });
    // Trimmed, and the empty trailing entry dropped rather than stored blank.
    expect(onChange.mock.calls[0][0].items[1].covers).toEqual(['IEC 62304 clause 9', '5.1 planning']);
  });

  it('says plainly that an empty register is a legitimate answer', () => {
    render(<ReferenceTable doc={{ ...doc, items: [] }} onChange={() => {}} />);
    expect(screen.getByText(/No references/)).toBeInTheDocument();
  });

  it('offers no editing affordance when read-only', () => {
    const { container } = render(<ReferenceTable doc={doc} onChange={() => {}} readOnly />);
    expect(screen.queryByText('Add reference')).not.toBeInTheDocument();
    for (const input of container.querySelectorAll('input, select')) {
      expect(input).toBeDisabled();
    }
  });
});
