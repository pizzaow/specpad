import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReleasesView from '../ReleasesView';
import type { ReleasesDoc, JobRecord } from '../../shared';

const releases: ReleasesDoc = {
  schemaVersion: '1.0', type: 'releases', name: 'Acme', tagPattern: 'v*', baseline: 'v1.2',
  releases: [
    { version: 'v1.1', ref: 'aaa', date: '2026-05-30', author: { name: 'Sam', email: 's@x' }, snapshot: null },
    { version: 'v1.2', ref: 'bbb', date: '2026-06-19', author: { name: 'Geoff', email: 'g@x' }, snapshot: '.specpad/baseline' },
  ],
};

const jobs: JobRecord[] = [
  { id: 'j1', code: 'JOB-1', type: 'feature', version: 'v1.2', title: 'Jobs register', status: 'closed' },
  { id: 'j2', code: 'JOB-2', type: 'bugfix', version: 'v1.2', title: 'Fix audit', status: 'closed' },
  { id: 'j3', code: 'JOB-3', type: 'feature', title: 'In progress', status: 'open' },
  { id: 'j4', code: 'JOB-4', type: 'feature', title: 'Done, not released', status: 'closed' },
];

describe('ReleasesView', () => {
  it('shows each release newest-first with its jobs as release notes', () => {
    const { container } = render(<ReleasesView releases={releases} jobs={jobs} />);
    const headings = [...container.querySelectorAll('h4')].map((h) => h.textContent);
    // Unreleased first, then v1.2 (newest), then v1.1
    expect(headings[0]).toMatch(/Unreleased/);
    expect(headings[1]).toMatch(/v1\.2/);
    expect(headings[2]).toMatch(/v1\.1/);
    // v1.2 carries its jobs (a feature and a bugfix), with metadata
    expect(screen.getByText('Jobs register')).toBeInTheDocument();
    expect(screen.getByText('Fix audit')).toBeInTheDocument();
    expect(screen.getByText(/2026-06-19/)).toBeInTheDocument();
    expect(screen.getByText('Bugfixes')).toBeInTheDocument();
  });

  it('lists a closed job with no version under Unreleased; open jobs are excluded', () => {
    render(<ReleasesView releases={releases} jobs={jobs} />);
    expect(screen.getByText('Done, not released')).toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('shows an empty state with no releases', () => {
    render(<ReleasesView releases={null} jobs={[]} />);
    expect(screen.getByText(/No releases yet/)).toBeInTheDocument();
  });
});
