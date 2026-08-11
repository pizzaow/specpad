import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SRSTable from '../SRSTable';
import type { SrsDoc, VtpDoc } from '../../shared';
const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'AcmeApp', title: 'Requirements',
  items: [
    { id: 'h_001', heading: true, text: 'Functional', code: 'Func' },
    { id: 'r_001', code: 'FUNC-1', text: 'Shall authenticate.', level: 1 },
  ],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'AcmeApp', title: 'Tests',
  items: [{ id: 't_001', code: 'TEST-1', text: 'Login test', verifies: ['r_001'], expected: 'ok', result: 'passed' }],
};

describe('SRSTable structure', () => {
  it('renders requirement text and code, no Hazards column', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} />);
    expect(screen.getByText('Shall authenticate.')).toBeInTheDocument();
    expect(screen.getByText('FUNC-1')).toBeInTheDocument();
    expect(screen.queryByText('Hazards')).toBeNull();
  });

  it('shows a derived dotted code for headings (not the word "heading")', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} />);
    expect(screen.getByText('Func')).toBeInTheDocument();
    expect(screen.queryByText('heading')).toBeNull();
  });

  it('uses a per-row hamburger menu instead of action buttons', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} />);
    expect(screen.queryByTitle('Add row below')).toBeNull(); // old buttons gone
    expect(screen.getAllByLabelText('Row actions').length).toBe(2); // one per row
  });

  it('test count column shows the verifying-test count', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});

describe('SRSTable hierarchy + menu actions', () => {
  it('adds a child below at level+1 via the menu', () => {
    const onChange = vi.fn();
    render(<SRSTable doc={srs} vtpDoc={vtp} onChange={onChange} />);
    fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
    fireEvent.click(screen.getByText('Child'));
    const next = onChange.mock.calls.at(-1)![0] as SrsDoc;
    expect(next.items.length).toBe(3);
    expect(next.items[1].level).toBe(1);
  });

  it('deletes a requirement after confirmation', () => {
    const onChange = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SRSTable doc={srs} vtpDoc={vtp} onChange={onChange} />);
    fireEvent.click(screen.getAllByLabelText('Row actions')[1]);
    fireEvent.click(screen.getByText('Delete'));
    const next = onChange.mock.calls.at(-1)![0] as SrsDoc;
    expect(next.items.find((i) => i.id === 'r_001')).toBeUndefined();
    vi.restoreAllMocks();
  });

  it('outdent is disabled for a level-0 row', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} />);
    fireEvent.click(screen.getAllByLabelText('Row actions')[0]); // heading, level 0
    const outdent = screen.getByText('Outdent').closest('li');
    expect(outdent?.className).toContain('disabled');
  });
});

describe('SRSTable show-tests + info', () => {
  it('expands the verifying tests inline for a requirement', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Show tests for r_001'));
    expect(screen.getByText('Login test')).toBeInTheDocument();
    expect(screen.getByText(/TEST-1/)).toBeInTheDocument();
  });

  it('opens the info modal from the menu', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} />);
    fireEvent.click(screen.getAllByLabelText('Row actions')[1]);
    fireEvent.click(screen.getByText('View information'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('r_001')).toBeInTheDocument();
  });
});

describe('SRSTable redline (Word-style)', () => {
  it('marks modified inline and shows removed rows struck through (no panel)', () => {
    // working doc = `srs` (h_001 heading + r_001 "Shall authenticate.")
    const baseline: SrsDoc = {
      schemaVersion: '1.0', type: 'srs', name: 'AcmeApp', title: 'Requirements',
      items: [
        { id: 'r_001', code: 'FUNC-1', text: 'Old text', level: 1 },
        { id: 'r_old', code: 'OLD-1', text: 'Old requirement', level: 1 },
      ],
    };
    const { container } = render(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} baseline={baseline} />);
    // r_001 modified vs baseline -> warning row
    expect(container.querySelector('tr.warning')).not.toBeNull();
    // r_old removed -> inline struck-through row (not a panel)
    const removed = container.querySelector('tr.ct-removed-row');
    expect(removed).not.toBeNull();
    expect(removed?.textContent).toContain('Old requirement');
    expect(screen.queryByText(/Removed since baseline/)).toBeNull(); // panel gone
  });

  it('treats everything as unchanged when there is no baseline', () => {
    const { container } = render(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} />);
    expect(container.querySelector('tr.warning')).toBeNull();
    expect(container.querySelector('tr.ct-removed-row')).toBeNull();
  });
});

describe('SRSTable advisory presence (CE-3, CE-4)', () => {
  const presence = new Map([['r_001', ['Kim Patel']]]);

  it('marks a row someone else is editing, naming them', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} presence={presence} />);
    expect(screen.getByTitle('Kim Patel editing this now')).toBeInTheDocument();
  });

  it('never prevents editing a row someone else has claimed (CE-4)', () => {
    const onChange = vi.fn();
    render(<SRSTable doc={srs} vtpDoc={vtp} onChange={onChange} presence={presence} />);

    // A claim is a courtesy: the second person is told, and edits anyway.
    fireEvent.click(screen.getByText('Shall authenticate.'));
    const input = screen.getByDisplayValue('Shall authenticate.');
    fireEvent.change(input, { target: { value: 'Shall authenticate users.' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0].items[1].text).toBe('Shall authenticate users.');
  });

  it('reports which row is open so the shell can announce it', () => {
    const onEditingItem = vi.fn();
    render(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} onEditingItem={onEditingItem} />);

    fireEvent.click(screen.getByText('Shall authenticate.'));
    expect(onEditingItem).toHaveBeenCalledWith('r_001');
  });

  it('renders no presence marker when nobody else is in the document', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} />);
    expect(screen.queryByTitle(/editing this now/)).toBeNull();
  });
});


// EDR-3: a role that cannot write gets a read-only editor, not one that lets you type
// into changes the server would refuse.
describe('SRSTable — read-only (EDR-3)', () => {
  it('offers no row menu', () => {
    const { rerender } = render(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} />);
    expect(screen.getAllByLabelText(/row actions/i).length).toBeGreaterThan(0);

    rerender(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} readOnly />);
    expect(screen.queryByLabelText(/row actions/i)).toBeNull();
  });

  it('does not open a cell for editing when clicked', () => {
    const onChange = vi.fn();
    render(<SRSTable doc={srs} vtpDoc={vtp} onChange={onChange} readOnly />);

    fireEvent.click(screen.getByText('Shall authenticate.'));

    expect(screen.queryByDisplayValue('Shall authenticate.')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
