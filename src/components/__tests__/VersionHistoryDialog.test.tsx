import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VersionHistoryDialog from '../VersionHistoryDialog';
import type { ReleasesDoc } from '../../shared';

const releases: ReleasesDoc = {
  schemaVersion: '1.0', type: 'releases', name: 'AcmeApp', tagPattern: 'v*', baseline: 'v1.0',
  releases: [
    { version: 'v0.1', ref: 'v0.1', date: '2025-01-01', author: { name: 'Geoff', email: 'g@x.com' }, snapshot: '.specpad/snapshots/v0.1' },
    { version: 'v1.0', ref: 'v1.0', date: '2026-01-01', author: { name: 'Sam', email: 's@x.com' }, snapshot: '.specpad/baseline' },
  ],
};

describe('VersionHistoryDialog', () => {
  it('lists releases and closes', () => {
    const onClose = vi.fn();
    render(<VersionHistoryDialog releases={releases} onClose={onClose} />);
    expect(screen.getByText('v1.0')).toBeInTheDocument();
    expect(screen.getByText('v0.1')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an empty state with no manifest', () => {
    render(<VersionHistoryDialog releases={null} onClose={vi.fn()} />);
    expect(screen.getByText(/specpad refresh/)).toBeInTheDocument();
  });
});
