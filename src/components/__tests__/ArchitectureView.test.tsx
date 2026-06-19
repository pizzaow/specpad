import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ArchitectureView from '../ArchitectureView';

// CodeMirror needs real DOM measurement; stub it to a textarea for jsdom.
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: any) => (
    <textarea data-testid="cm" value={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}));
vi.mock('@codemirror/lang-markdown', () => ({ markdown: () => [] }));

const sad = `# SpecPad SAD

## 1. Introduction and Goals
SpecPad governs documentation.

## 3. Context and Scope
- A developer authors specs.
`;
const dsl = `workspace "SpecPad" { model { specpad = softwareSystem "SpecPad" } }`;
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>CONTEXT-DIAGRAM</text></svg>';

describe('ArchitectureView', () => {
  it('renders the arc42 markdown as HTML headings and the C4 source', () => {
    render(<ArchitectureView sad={sad} dsl={dsl} />);
    expect(screen.getByText('1. Introduction and Goals')).toBeInTheDocument();
    expect(screen.getByText('A developer authors specs.')).toBeInTheDocument();
    expect(screen.getByText(/workspace "SpecPad"/)).toBeInTheDocument();
  });

  it('renders an embedded diagram SVG inline', () => {
    const { container } = render(<ArchitectureView sad={sad} dsl={dsl} diagramSvg={svg} />);
    expect(container.querySelector('.arch-diagram svg')).toBeTruthy();
    expect(container.innerHTML).toContain('CONTEXT-DIAGRAM');
  });

  it('shows Edit/Display sub-tabs only when editing is enabled, and emits edits', () => {
    const onChangeSad = vi.fn();
    render(<ArchitectureView sad={sad} dsl={dsl} onChangeSad={onChangeSad} onChangeDsl={vi.fn()} />);
    fireEvent.click(screen.getByText('Edit'));
    const editors = screen.getAllByTestId('cm');
    fireEvent.change(editors[0], { target: { value: '# changed' } });
    expect(onChangeSad).toHaveBeenCalledWith('# changed');
  });

  it('has no sub-tabs when read-only (no edit callbacks)', () => {
    render(<ArchitectureView sad={sad} dsl={dsl} />);
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });

  it('surfaces the authoring guide in a panel when provided', () => {
    render(<ArchitectureView sad={sad} dsl={dsl} guide={'# Guide\n\n- be concise'} />);
    expect(screen.getByText('Authoring guide')).toBeInTheDocument();
    expect(screen.getByText('be concise')).toBeInTheDocument();
  });

  it('shows an empty state when there is no architecture document', () => {
    render(<ArchitectureView sad={null} dsl={null} />);
    expect(screen.getByText(/No architecture document/)).toBeInTheDocument();
  });
});
