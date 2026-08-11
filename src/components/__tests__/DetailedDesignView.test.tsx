import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DetailedDesignView from '../DetailedDesignView';
import type { SddDoc, SrsDoc } from '../../shared';

/**
 * The Detailed Design tab (DD-11..13).
 *
 * The assertions that matter are about the trace, not the chrome: a section shows which
 * requirements point at it, editing one warns that those requirements are now in
 * question, and deleting one says exactly what it would break.
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
      title: 'auth — session establishment',
      source: ['src/auth.ts'],
      body: '## Secret\nWhich identity provider is in use.\n\n![Flow](acme.auth.svg)',
    },
    { id: 'd_bbb222', code: 'SDD-2', title: 'report — rendering', body: 'Renders to PDF.' },
  ],
};

const srsDoc: SrsDoc = {
  schemaVersion: '1.0',
  type: 'srs',
  name: 'AcmeApp',
  title: 'Requirements',
  items: [
    { id: 'r_1', code: 'SSO-1', text: 'The system shall authenticate via SAML.', design: ['d_aaa111'] },
    { id: 'r_2', code: 'SSO-2', text: 'The system shall expire a session.', design: ['d_aaa111'] },
    { id: 'r_3', code: 'PDF-1', text: 'The system shall render a report.', design: ['d_bbb222'] },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe('DetailedDesignView — display', () => {
  it('lists every section and opens one', () => {
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} />);

    expect(screen.getByRole('navigation', { name: 'Design sections' })).toHaveTextContent('SDD-2');
    fireEvent.click(screen.getByRole('link', { name: /SDD-2/ }));

    expect(screen.getByRole('heading', { name: /report — rendering/ })).toBeInTheDocument();
    expect(screen.getByText('Renders to PDF.')).toBeInTheDocument();
  });

  it('shows which requirements the section implements', () => {
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} />);
    fireEvent.click(screen.getByRole('link', { name: /SDD-1/ }));

    expect(screen.getByText('SSO-1')).toBeInTheDocument();
    expect(screen.getByText('SSO-2')).toBeInTheDocument();
    expect(screen.queryByText('PDF-1')).toBeNull();
  });

  it('says so when nothing references a section, rather than showing an empty row', () => {
    const orphan: SddDoc = { ...doc, items: [{ id: 'd_ccc333', title: 'unreferenced' }] };
    render(<DetailedDesignView doc={orphan} srsDoc={srsDoc} />);

    expect(screen.getByText(/No requirement references this section/i)).toBeInTheDocument();
  });

  it('renders an embedded diagram inline, and names a missing one', () => {
    const { rerender } = render(
      <DetailedDesignView doc={doc} srsDoc={srsDoc} diagrams={{ 'acme.auth.svg': '<svg><title>flow</title></svg>' }} />,
    );
    fireEvent.click(screen.getByRole('link', { name: /SDD-1/ }));
    expect(screen.getByRole('img', { name: 'Flow' })).toBeInTheDocument();

    rerender(<DetailedDesignView doc={doc} srsDoc={srsDoc} diagrams={{}} />);
    fireEvent.click(screen.getByRole('link', { name: /SDD-1/ }));
    expect(screen.getByText('[diagram: acme.auth.svg]')).toBeInTheDocument();
  });

  it('reports an absent detailed design without offering an editor', () => {
    render(<DetailedDesignView doc={null} onChange={vi.fn()} />);

    expect(screen.getByText(/No detailed design for this project/i)).toBeInTheDocument();
    expect(screen.queryByText('Edit')).toBeNull();
  });
});

describe('DetailedDesignView — editing', () => {
  const openEdit = (onChange = vi.fn()) => {
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} onChange={onChange} />);
    fireEvent.click(screen.getByText('Edit'));
    return onChange;
  };

  it('edits a section title without touching its identity', () => {
    const onChange = openEdit();
    fireEvent.click(screen.getByRole('link', { name: /SDD-2/ }));
    fireEvent.change(screen.getByLabelText('Section title'), { target: { value: 'renamed entirely' } });

    const next = onChange.mock.calls.at(-1)![0] as SddDoc;
    const edited = next.items.find((s) => s.id === 'd_bbb222')!;
    expect(edited.title).toBe('renamed entirely');
    expect(edited.id).toBe('d_bbb222'); // the link target is untouched
  });

  it('warns that the referencing requirements are now in question (DD-8)', () => {
    openEdit();
    fireEvent.click(screen.getByRole('link', { name: /SDD-1/ }));

    const warning = screen.getByText(/2 requirement\(s\) reference this section/i);
    expect(warning).toBeInTheDocument();
    expect(warning.parentElement).toHaveTextContent('SSO-1');
    expect(warning.parentElement).toHaveTextContent('SSO-2');
  });

  it('records source paths as a list', () => {
    const onChange = openEdit();
    fireEvent.click(screen.getByRole('link', { name: /SDD-2/ }));
    fireEvent.change(screen.getByLabelText('Source paths'), {
      target: { value: 'src/report.ts, src/pdf.ts' },
    });

    const next = onChange.mock.calls.at(-1)![0] as SddDoc;
    expect(next.items.find((s) => s.id === 'd_bbb222')!.source).toEqual(['src/report.ts', 'src/pdf.ts']);
  });

  it('adds a section with a fresh id after the selected one', () => {
    const onChange = openEdit();
    fireEvent.click(screen.getByRole('link', { name: /SDD-1/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add section' }));

    const next = onChange.mock.calls.at(-1)![0] as SddDoc;
    expect(next.items).toHaveLength(4);
    expect(next.items[2].id).toMatch(/^d_[0-9a-f]{6}$/);
    expect(next.items[2].id).not.toBe('d_aaa111');
  });

  it('names the requirements a deletion would leave dangling, and abandons on cancel', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onChange = openEdit();
    fireEvent.click(screen.getByRole('link', { name: /SDD-1/ }));
    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Delete section' }));

    expect(confirmSpy.mock.calls[0][0]).toContain('SSO-1');
    expect(confirmSpy.mock.calls[0][0]).toContain('SSO-2');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('deletes when confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onChange = openEdit();
    fireEvent.click(screen.getByRole('link', { name: /SDD-2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete section' }));

    const next = onChange.mock.calls.at(-1)![0] as SddDoc;
    expect(next.items.map((s) => s.id)).not.toContain('d_bbb222');
  });

  it('reorders sections', () => {
    const onChange = openEdit();
    fireEvent.click(screen.getByRole('link', { name: /SDD-2/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Move up' }));

    const next = onChange.mock.calls.at(-1)![0] as SddDoc;
    expect(next.items.map((s) => s.id)).toEqual(['h_1', 'd_bbb222', 'd_aaa111']);
  });

  it('offers no editing at all when read-only', () => {
    render(<DetailedDesignView doc={doc} srsDoc={srsDoc} readOnly onChange={vi.fn()} />);

    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add section' })).toBeNull();
  });
});
