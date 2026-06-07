import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VersionTimeline from '../VersionTimeline';
import type { ReleasesDoc } from '../../shared';

const sam = { name: 'Sam', email: 's@x.com' };
const releases: ReleasesDoc = {
  schemaVersion: '1.0', type: 'releases', name: 'AcmeApp', tagPattern: 'v*', baseline: 'v2.0',
  releases: [
    { version: 'v1.0', ref: 'v1.0', date: '2025-01-01', author: sam, snapshot: '.specpad/snapshots/v1.0' },
    { version: 'v2.0', ref: 'v2.0', date: '2026-01-01', author: sam, snapshot: '.specpad/baseline' },
  ],
};

describe('VersionTimeline', () => {
  it('renders nothing when there are no releases', () => {
    const { container } = render(<VersionTimeline releases={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('lists each release with its date and author, flagging the baseline', () => {
    render(<VersionTimeline releases={releases} />);
    expect(screen.getByText('v1.0')).toBeInTheDocument();
    expect(screen.getByText('v2.0')).toBeInTheDocument();
    expect(screen.getByText(/baseline/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Sam/).length).toBeGreaterThan(0);
  });
});
