import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SRSTable from '../SRSTable';
import type { SrsDoc, VtpDoc } from '../../shared';
import type { RedlineView, AttributionView } from '../../changeTracking';

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
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    expect(screen.getByText('Shall authenticate.')).toBeInTheDocument();
    expect(screen.getByText('FUNC-1')).toBeInTheDocument();
    expect(screen.queryByText('Hazards')).toBeNull();
  });

  it('shows a derived dotted code for headings (not the word "heading")', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    expect(screen.getByText('Func')).toBeInTheDocument();
    expect(screen.queryByText('heading')).toBeNull();
  });

  it('uses a per-row hamburger menu instead of action buttons', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    expect(screen.queryByTitle('Add row below')).toBeNull(); // old buttons gone
    expect(screen.getAllByLabelText('Row actions').length).toBe(2); // one per row
  });

  it('test count column shows the verifying-test count', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});

describe('SRSTable hierarchy + menu actions', () => {
  it('adds a child below at level+1 via the menu', () => {
    const onSave = vi.fn();
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={onSave} />);
    // open the heading row's menu (first), add child
    fireEvent.click(screen.getAllByLabelText('Row actions')[0]);
    fireEvent.click(screen.getByText('Child'));
    fireEvent.click(screen.getByText('Save'));
    const saved = onSave.mock.calls[0][0] as SrsDoc;
    expect(saved.items.length).toBe(3);
    expect(saved.items[1].level).toBe(1); // child of a level-0 heading
  });

  it('deletes a requirement after confirmation', () => {
    const onSave = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={onSave} />);
    fireEvent.click(screen.getAllByLabelText('Row actions')[1]); // r_001
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Save'));
    const saved = onSave.mock.calls[0][0] as SrsDoc;
    expect(saved.items.find((i) => i.id === 'r_001')).toBeUndefined();
    vi.restoreAllMocks();
  });

  it('outdent is disabled for a level-0 row', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    fireEvent.click(screen.getAllByLabelText('Row actions')[0]); // heading, level 0
    const outdent = screen.getByText('Outdent').closest('li');
    expect(outdent?.className).toContain('disabled');
  });
});

describe('SRSTable show-tests + info', () => {
  it('expands the verifying tests inline for a requirement', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Show tests for r_001'));
    expect(screen.getByText('Login test')).toBeInTheDocument();
    expect(screen.getByText(/TEST-1/)).toBeInTheDocument();
  });

  it('opens the info modal from the menu', () => {
    render(<SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} />);
    fireEvent.click(screen.getAllByLabelText('Row actions')[1]);
    fireEvent.click(screen.getByText('View information'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('r_001')).toBeInTheDocument();
  });
});

describe('SRSTable redline (preserved)', () => {
  it('marks a modified row and lists removed items', () => {
    const redline: RedlineView = {
      byId: new Map([['r_001', { status: 'modified', changedFields: ['text'] }]]),
      removed: [{ id: 'r_old', status: 'removed', before: { id: 'r_old', text: 'Old requirement' } }],
    };
    const attribution = new Map<string, AttributionView>();
    const { container } = render(
      <SRSTable doc={srs} vtpDoc={vtp} onSave={vi.fn()} redline={redline} attribution={attribution} />,
    );
    expect(container.querySelector('tr.warning')).not.toBeNull();
    expect(screen.getByText(/Removed since baseline/)).toBeInTheDocument();
    expect(screen.getByText('Old requirement')).toBeInTheDocument();
  });
});
