import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SRSTable from '../SRSTable';
import type { SrsDoc, VtpDoc, PrdDoc, SddDoc , ThreatDoc } from '../../shared';
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
    fireEvent.click(screen.getByLabelText('Show trace for r_001'));
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

// The requirement is where every trace edge is stored, so it is where they are authored.
describe('SRSTable — authoring the trace (TR-1)', () => {
  const prd: PrdDoc = {
    schemaVersion: '1.0', type: 'prd', name: 'AcmeApp', title: 'Product Requirements',
    items: [{ id: 'p_001', code: 'PROD-1', text: 'Users sign in with SSO.', status: 'implemented' }],
  };
  const sdd: SddDoc = {
    schemaVersion: '1.0', type: 'sdd', name: 'AcmeApp', title: 'Detailed Design',
    items: [
      { id: 'h_x', title: 'Units', heading: true },
      { id: 'd_001', code: 'SDD-1', title: 'auth' },
      { id: 'd_002', code: 'SDD-2', title: 'session' },
    ],
  };

  const expand = () => fireEvent.click(screen.getByLabelText('Show trace for r_001'));

  it('offers the design and satisfies pickers only when those documents exist', () => {
    const { rerender } = render(<SRSTable doc={srs} vtpDoc={vtp} onChange={vi.fn()} />);
    expand();
    expect(screen.queryByText('Design:')).toBeNull();
    expect(screen.queryByText('Satisfies:')).toBeNull();

    rerender(<SRSTable doc={srs} vtpDoc={vtp} prdDoc={prd} sddDoc={sdd} onChange={vi.fn()} />);
    expect(screen.getByText('Design:')).toBeInTheDocument();
    expect(screen.getByText('Satisfies:')).toBeInTheDocument();
  });

  it('links a design section by picking it, storing its id', () => {
    const onChange = vi.fn();
    render(<SRSTable doc={srs} vtpDoc={vtp} prdDoc={prd} sddDoc={sdd} onChange={onChange} />);
    expand();

    fireEvent.click(within(screen.getByRole('group', { name: /Design sections implementing FUNC-1/ })).getByText(/add/));
    fireEvent.mouseDown(screen.getByRole('option', { name: /SDD-2/ }));

    const next = onChange.mock.calls.at(-1)![0] as SrsDoc;
    expect(next.items.find((i) => i.id === 'r_001')!.design).toEqual(['d_002']);
  });

  it('does not offer a heading as a link target', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} prdDoc={prd} sddDoc={sdd} onChange={vi.fn()} />);
    expand();
    fireEvent.click(within(screen.getByRole('group', { name: /Design sections implementing FUNC-1/ })).getByText(/add/));

    expect(screen.queryByRole('option', { name: /Units/ })).toBeNull();
  });

  it('removes a link', () => {
    const onChange = vi.fn();
    const linked: SrsDoc = {
      ...srs,
      items: srs.items.map((i) => (i.id === 'r_001' ? { ...i, design: ['d_001'] } : i)),
    };
    render(<SRSTable doc={linked} vtpDoc={vtp} prdDoc={prd} sddDoc={sdd} onChange={onChange} />);
    expand();

    fireEvent.click(screen.getByLabelText('Remove SDD-1'));

    const next = onChange.mock.calls.at(-1)![0] as SrsDoc;
    expect(next.items.find((i) => i.id === 'r_001')!.design).toEqual([]);
  });

  it('shows an unresolved reference rather than dropping it', () => {
    const dangling: SrsDoc = {
      ...srs,
      items: srs.items.map((i) => (i.id === 'r_001' ? { ...i, design: ['d_gone'] } : i)),
    };
    render(<SRSTable doc={dangling} vtpDoc={vtp} prdDoc={prd} sddDoc={sdd} onChange={vi.fn()} />);
    expand();

    expect(screen.getByText(/d_gone \(unresolved\)/)).toBeInTheDocument();
  });

  it('offers no picker controls when read-only', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} prdDoc={prd} sddDoc={sdd} onChange={vi.fn()} readOnly />);
    expand();

    expect(screen.queryByText(/add/)).toBeNull();
  });
});

describe('security control authoring (JOB-59, found by an adversary pass)', () => {
  // The field, the governance rule and the whole Controls view shipped with nothing that
  // could set the value — it was only ever read. The view could only show every category
  // empty. Found by a review pass that had not seen the reasoning.
  const threat: ThreatDoc = {
    schemaVersion: '1.0', type: 'threat', name: 'A', title: 'Threats',
    items: [{ id: 'x_1', code: 'THR-1', text: 'Spoofed header.', controls: ['r_001'] }],
  };

  it('offers the FDA control picker on a requirement a threat names as a control', () => {
    render(<SRSTable doc={srs} vtpDoc={null} threatDoc={threat} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/FDA security control categories for/)).toBeInTheDocument();
  });

  it('does not ask it of a requirement no threat relies on', () => {
    // Asking every requirement would be noise on a register mostly not about security.
    render(<SRSTable doc={srs} vtpDoc={null} threatDoc={{ ...threat, items: [] }} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/FDA security control categories for/)).toBeNull();
  });

  it('does not ask it at all when the project has no threat model', () => {
    render(<SRSTable doc={srs} vtpDoc={null} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/FDA security control categories for/)).toBeNull();
  });
});
