import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DetailedDesignView from '../DetailedDesignView';
import type { SddDoc, SrsDoc } from '../../shared';

/**
 * The Detailed Design tab (DD-11..13, DD-15..16).
 *
 * The document is continuous: every section is rendered, and editing happens on the
 * section in place rather than in a separate pane. The assertions that matter are the
 * trace ones — what references a section, and what a change to it puts in question.
 */

const doc: SddDoc = {
  schemaVersion: '1.0',
  type: 'sdd',
  name: 'AcmeApp',
  title: 'Detailed Design',
  items: [
    { id: 'h_1', title: 'Design views', heading: true },
    {
      id: 'd_aaa111',
      code: 'SDD-1',
      title: 'auth',
      source: ['src/auth.ts'],
      body: 'Establishes a session.\n\n![Flow](acme.auth.svg)',
    },
    { id: 'd_bbb222', code: 'SDD-2', title: 'report', body: 'Renders to PDF.' },
  ],
};

const srsDoc: SrsDoc = {
  schemaVersion: '1.0',
  type: 'srs',
  name: 'AcmeApp',
  title: 'Requirements',
  items: [
    { id: 'r_1', code: 'SSO-1', text: 'Authenticate via SAML.', design: ['d_aaa111'] },
    { id: 'r_2', code: 'SSO-2', text: 'Expire a session.', design: ['d_aaa111'] },
    { id: 'r_3', code: 'PDF-1', text: 'Render a report.', design: ['d_bbb222'] },
  ],
};

beforeEach(() => {
  // jsdom has neither; the view uses one for scrollspy and one for outline navigation.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The section element for a code, so assertions are scoped to one section. */
const section = (code: string) =>
  screen.getByRole('heading', { name: new RegExp(code) }).closest('section') as HTMLElement;

describe('DetailedDesignView — the document', () => {
  it('renders every section at once, in order, rather than one at a time', () => {
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} />);

    expect(screen.getByText('Establishes a session.')).toBeInTheDocument();
    expect(screen.getByText('Renders to PDF.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Design views' })).toBeInTheDocument();
  });

  it('lists every section in the outline and scrolls to one on click', () => {
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} />);
    const outline = screen.getByRole('navigation', { name: 'Design sections' });

    fireEvent.click(within(outline).getByRole('link', { name: /SDD-2/ }));

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('shows each section its own source paths and the requirements it implements', () => {
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} />);

    const auth = section('SDD-1');
    expect(auth).toHaveTextContent('src/auth.ts');
    expect(within(auth).getByText('SSO-1')).toBeInTheDocument();
    expect(within(auth).getByText('SSO-2')).toBeInTheDocument();
    expect(within(auth).queryByText('PDF-1')).toBeNull();
  });

  it('says when nothing references a section', () => {
    const orphan: SddDoc = { ...doc, items: [{ id: 'd_ccc333', code: 'SDD-9', title: 'unused' }] };
    render(<DetailedDesignView doc={orphan} srsDoc={srsDoc} />);

    expect(screen.getByText(/No requirement references this section/i)).toBeInTheDocument();
  });

  it('renders an embedded diagram inline, and names a missing one', () => {
    const { rerender } = render(
      <DetailedDesignView doc={doc} srsDoc={srsDoc} diagrams={{ 'acme.auth.svg': '<svg />' }} />,
    );
    expect(screen.getByRole('img', { name: 'Flow' })).toBeInTheDocument();

    rerender(<DetailedDesignView doc={doc} srsDoc={srsDoc} diagrams={{}} />);
    expect(screen.getByText('[diagram: acme.auth.svg]')).toBeInTheDocument();
  });

  it('reports an absent detailed design', () => {
    render(<DetailedDesignView doc={null} onChange={vi.fn()} />);
    expect(screen.getByText(/No detailed design for this project/i)).toBeInTheDocument();
  });
});

describe('DetailedDesignView — editing in place', () => {
  it('opens the clicked section for editing and leaves its neighbours rendered', () => {
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText('Establishes a session.'));

    // The edited section gained inputs; the other section is still shown as prose.
    expect(within(section('SDD-1')).getByLabelText('Section title')).toBeInTheDocument();
    expect(screen.getByText('Renders to PDF.')).toBeInTheDocument();
  });

  it('edits title, code and source without changing the section id', () => {
    const onChange = vi.fn();
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} onChange={onChange} />);
    fireEvent.click(screen.getByText('Renders to PDF.'));

    fireEvent.change(within(section('SDD-2')).getByLabelText('Section title'), {
      target: { value: 'renamed' },
    });
    let next = onChange.mock.calls.at(-1)![0] as SddDoc;
    expect(next.items.find((s) => s.id === 'd_bbb222')).toMatchObject({ id: 'd_bbb222', title: 'renamed' });

    fireEvent.change(within(section('SDD-2')).getByLabelText('Source paths'), {
      target: { value: 'src/report.ts, src/pdf.ts' },
    });
    next = onChange.mock.calls.at(-1)![0] as SddDoc;
    expect(next.items.find((s) => s.id === 'd_bbb222')!.source).toEqual(['src/report.ts', 'src/pdf.ts']);
  });

  it('warns that the referencing requirements are now in question (DD-8)', () => {
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} onChange={vi.fn()} />);

    fireEvent.click(screen.getByText('Establishes a session.'));

    const warning = within(section('SDD-1')).getByText(/2 requirement\(s\) reference this section/i);
    expect(warning.parentElement).toHaveTextContent('SSO-1');
    expect(warning.parentElement).toHaveTextContent('SSO-2');
  });

  it('does not warn for a section nothing references', () => {
    const withOrphan: SddDoc = {
      ...doc,
      items: [...doc.items, { id: 'd_ddd444', code: 'SDD-9', title: 'unused', body: 'Nothing points here.' }],
    };
    render(<DetailedDesignView doc={withOrphan} srsDoc={srsDoc} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Nothing points here.'));

    expect(within(section('SDD-9')).queryByText(/requirement\(s\) reference this section/i)).toBeNull();
  });
});

describe('DetailedDesignView — structure', () => {
  const openMenu = (code: string) => {
    const menu = within(section(code)).getByLabelText(/row actions/i);
    fireEvent.click(menu);
  };

  it('adds a section below with a fresh id', () => {
    const onChange = vi.fn();
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} onChange={onChange} />);

    openMenu('SDD-1');
    fireEvent.click(screen.getByText('Below'));

    const next = onChange.mock.calls.at(-1)![0] as SddDoc;
    expect(next.items).toHaveLength(4);
    expect(next.items[2].id).toMatch(/^d_[0-9a-f]{6}$/);
  });

  it('names the requirements a deletion would leave dangling, and abandons on cancel', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onChange = vi.fn();
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} onChange={onChange} />);

    openMenu('SDD-1');
    fireEvent.click(screen.getByText(/delete/i));

    expect(confirmSpy.mock.calls[0][0]).toContain('SSO-1');
    expect(confirmSpy.mock.calls[0][0]).toContain('SSO-2');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('deletes when confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onChange = vi.fn();
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} onChange={onChange} />);

    openMenu('SDD-2');
    fireEvent.click(screen.getByText(/delete/i));

    const next = onChange.mock.calls.at(-1)![0] as SddDoc;
    expect(next.items.map((s) => s.id)).not.toContain('d_bbb222');
  });

  it('reorders with the move controls', () => {
    const onChange = vi.fn();
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} onChange={onChange} />);
    fireEvent.click(screen.getByText('Renders to PDF.'));

    fireEvent.click(within(section('SDD-2')).getByRole('button', { name: 'Move up' }));

    const next = onChange.mock.calls.at(-1)![0] as SddDoc;
    expect(next.items.map((s) => s.id)).toEqual(['h_1', 'd_bbb222', 'd_aaa111']);
  });

  it('offers a drag handle per outline entry when editable', () => {
    const { rerender } = render(<DetailedDesignView doc={doc} srsDoc={srsDoc} onChange={vi.fn()} />);
    expect(screen.getAllByLabelText(/^Reorder /).length).toBe(doc.items.length);

    rerender(<DetailedDesignView doc={doc} srsDoc={srsDoc} onChange={vi.fn()} readOnly />);
    expect(screen.queryByLabelText(/^Reorder /)).toBeNull();
  });
});

describe('DetailedDesignView — read-only (EDR-3)', () => {
  it('offers no menu, no drag handle, and does not open a section when clicked', () => {
    const onChange = vi.fn();
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} onChange={onChange} readOnly />);

    fireEvent.click(screen.getByText('Establishes a session.'));

    expect(screen.queryByLabelText(/row actions/i)).toBeNull();
    expect(screen.queryByLabelText('Section title')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add section' })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

// The edge is stored on the requirement, so linking from the design writes to the SRS.
describe('DetailedDesignView — linking requirements from the design (TR-2)', () => {
  it('adds a requirement to a section by editing that requirement', () => {
    const onChangeSrs = vi.fn();
    render(
      <DetailedDesignView doc={doc} srsDoc={srsDoc} onChange={vi.fn()} onChangeSrs={onChangeSrs} />,
    );

    const picker = within(section('SDD-2')).getByRole('group', { name: /Requirements implemented by/ });
    fireEvent.click(within(picker).getByText(/add/));
    fireEvent.mouseDown(screen.getByRole('option', { name: /SSO-1/ }));

    const next = onChangeSrs.mock.calls.at(-1)![0] as SrsDoc;
    expect(next.items.find((r) => r.id === 'r_1')!.design).toEqual(['d_aaa111', 'd_bbb222']);
  });

  it('removes a requirement from a section, leaving its other links alone', () => {
    const onChangeSrs = vi.fn();
    render(
      <DetailedDesignView doc={doc} srsDoc={srsDoc} onChange={vi.fn()} onChangeSrs={onChangeSrs} />,
    );

    fireEvent.click(within(section('SDD-1')).getByLabelText('Remove SSO-1'));

    const next = onChangeSrs.mock.calls.at(-1)![0] as SrsDoc;
    expect(next.items.find((r) => r.id === 'r_1')!.design).toEqual([]);
    expect(next.items.find((r) => r.id === 'r_2')!.design).toEqual(['d_aaa111']);
    expect(next.items.find((r) => r.id === 'r_3')!.design).toEqual(['d_bbb222']);
  });

  it('is read-only when the shell offers no way to write the requirements', () => {
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} onChange={vi.fn()} />);
    expect(within(section('SDD-1')).queryByText(/add/)).toBeNull();
  });
});
