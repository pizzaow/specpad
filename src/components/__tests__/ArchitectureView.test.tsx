import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArchitectureView from '../ArchitectureView';

const sad = `# SpecPad SAD

## 1. Introduction and Goals
SpecPad governs **structured** documentation.

## 3. Context and Scope
- A developer authors specs.
- A reviewer approves in the eQMS.
`;

const dsl = `workspace "SpecPad" {
  model { specpad = softwareSystem "SpecPad" }
}`;

describe('ArchitectureView', () => {
  it('renders the arc42 document headings and content', () => {
    render(<ArchitectureView sad={sad} dsl={dsl} />);
    expect(screen.getByText('1. Introduction and Goals')).toBeInTheDocument();
    expect(screen.getByText('3. Context and Scope')).toBeInTheDocument();
    expect(screen.getByText('A developer authors specs.')).toBeInTheDocument();
    // inline markdown emphasis is stripped, not shown literally
    expect(screen.getByText(/SpecPad governs structured documentation\./)).toBeInTheDocument();
  });

  it('presents the C4 Structurizr DSL with a link to render it', () => {
    render(<ArchitectureView sad={sad} dsl={dsl} />);
    expect(screen.getByText('C4 model (Structurizr DSL)')).toBeInTheDocument();
    expect(screen.getByText(/workspace "SpecPad"/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Structurizr' })).toHaveAttribute('href', expect.stringContaining('structurizr'));
  });

  it('shows an empty state when there is no architecture document', () => {
    render(<ArchitectureView sad={null} dsl={null} />);
    expect(screen.getByText(/No architecture document/)).toBeInTheDocument();
  });
});
