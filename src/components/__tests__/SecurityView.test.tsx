import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SecurityView from '../SecurityView';

// SEC-9: the four views, rendered as prose with diagrams, editable like the arc42 document.
const sec = '# Security\n\n## 1. Global system view\n\nThe perimeter.\n\n![Deployment](acme.deploy.svg)';

describe('SecurityView', () => {
  it('renders the document with its diagrams inline', () => {
    render(<SecurityView sec={sec} diagrams={{ 'acme.deploy.svg': '<svg />' }} />);

    expect(screen.getByRole('heading', { name: /Global system view/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Deployment' })).toBeInTheDocument();
  });

  it('names a diagram it cannot resolve rather than dropping it', () => {
    render(<SecurityView sec={sec} diagrams={{}} />);
    expect(screen.getByText('[diagram: acme.deploy.svg]')).toBeInTheDocument();
  });

  it('reports an absent document without offering an editor', () => {
    render(<SecurityView sec={null} onChange={vi.fn()} />);

    expect(screen.getByText(/No security architecture document/i)).toBeInTheDocument();
    expect(screen.queryByText('Edit')).toBeNull();
  });

  it('edits the markdown and reports every change', () => {
    const onChange = vi.fn();
    render(<SecurityView sec={sec} onChange={onChange} />);

    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByText(/global system, multi-patient harm/i)).toBeInTheDocument();
  });

  it('offers no editing when read-only', () => {
    render(<SecurityView sec={sec} onChange={vi.fn()} readOnly />);
    expect(screen.queryByText('Edit')).toBeNull();
  });
});
