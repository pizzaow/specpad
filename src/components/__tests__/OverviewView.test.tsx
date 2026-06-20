import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import OverviewView from '../OverviewView';
import type { SrsDoc, VtpDoc, ReleasesDoc, JobRecord } from '../../shared';

const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'SRS',
  items: [
    { id: 'r_1', code: 'R-1', text: 'Verified.' },
    { id: 'r_2', code: 'R-2', text: 'Unverified.' },
  ],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'VTP',
  items: [{ id: 't_1', code: 'T-1', text: 'Test', verifies: ['r_1'], expected: 'ok', result: 'passed' }],
};
const releases: ReleasesDoc = {
  schemaVersion: '1.0', type: 'releases', name: 'Acme', tagPattern: 'v*', baseline: 'v1.2',
  releases: [{ version: 'v1.2', ref: 'abc', date: '2026-06-19', author: { name: 'Geoff', email: 'g@x' }, snapshot: null }],
};
const jobs: JobRecord[] = [
  { id: 'j1', code: 'JOB-9', type: 'feature', title: 'Live work', status: 'open' },
  { id: 'j2', code: 'JOB-8', type: 'feature', version: 'v1.2', title: 'Shipped work', status: 'closed' },
];

describe('OverviewView', () => {
  it('shows the coverage headline, in-progress jobs, and latest release', () => {
    render(<OverviewView projectName="Acme" prd={null} srs={srs} vtp={vtp} releases={releases} jobs={jobs} onNavigate={vi.fn()} />);
    expect(screen.getByText('Acme')).toBeInTheDocument();
    // coverage headline: 1 of 2 requirements verified
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getAllByText(/requirements verified/i).length).toBeGreaterThan(0);
    // in-progress job listed; latest release shown
    expect(screen.getByText('Live work')).toBeInTheDocument();
    expect(screen.getAllByText(/v1\.2/).length).toBeGreaterThan(0);
  });

  it('reports open governance findings (the unverified requirement)', () => {
    render(<OverviewView projectName="Acme" prd={null} srs={srs} vtp={vtp} releases={releases} jobs={jobs} onNavigate={vi.fn()} />);
    // r_2 is unverified → exactly one finding, shown with the singular label.
    expect(screen.getByText('open governance finding')).toBeInTheDocument();
  });

  it('navigates into a view from the quick-jump buttons', () => {
    const onNavigate = vi.fn();
    render(<OverviewView projectName="Acme" prd={null} srs={srs} vtp={vtp} releases={releases} jobs={jobs} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Open requirements'));
    expect(onNavigate).toHaveBeenCalledWith('srs');
    fireEvent.click(screen.getByText('Auditor view'));
    expect(onNavigate).toHaveBeenCalledWith('audit');
  });

  it('handles an empty project (no releases, no open jobs)', () => {
    render(<OverviewView projectName="Empty" prd={null} srs={null} vtp={null} releases={null} jobs={[]} onNavigate={vi.fn()} />);
    expect(screen.getByText(/No open jobs/i)).toBeInTheDocument();
    expect(screen.getByText(/No releases yet/i)).toBeInTheDocument();
  });
});
