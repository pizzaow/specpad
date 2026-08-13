import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AuditView from '../AuditView';
import type { PrdDoc, SrsDoc, VtpDoc, ReferenceDoc, ReleasesDoc, JobRecord } from '../../shared';

const prd: PrdDoc = {
  schemaVersion: '1.0', type: 'prd', name: 'Acme', title: 'PRD',
  items: [
    { id: 'p_a', code: 'PROD-1', text: 'Built need.', status: 'implemented' },
    { id: 'p_b', code: 'PROD-2', text: 'Roadmap need.', status: 'proposed' },
  ],
};
const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'SRS',
  items: [{ id: 'r_1', code: 'R-1', text: 'A requirement.', satisfies: ['p_a'], category: ['functional'] }],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'VTP',
  items: [{ id: 't_1', code: 'T-1', text: 'Test', verifies: ['r_1'], expected: 'ok', result: 'passed', verificationLevel: 'system' }],
};
const releases: ReleasesDoc = {
  schemaVersion: '1.0', type: 'releases', name: 'Acme', tagPattern: 'v*', baseline: 'v1',
  releases: [{ version: 'v1', ref: 'a', date: '2026-01-01', author: { name: 'G', email: 'g@x' }, snapshot: null }],
};
const reference: ReferenceDoc = {
  schemaVersion: '1.0', type: 'reference', name: 'Acme', title: 'References',
  items: [{
    id: 'f_1', code: 'REF-1', title: 'Software Problem Resolution Procedure',
    kind: 'sop', identifier: 'SOP-012 rev C', location: 'https://qms/SOP-012', owner: 'Quality',
    covers: ['IEC 62304 clause 9'],
  }],
};
const jobs: JobRecord[] = [{ id: 'j1', code: 'JOB-1', title: 'Work', status: 'open' }];

/** The tab strip, so a label that also appears in the conformity table is unambiguous. */
const openTab = (label: string) =>
  fireEvent.click(within(document.querySelector('.nav-tabs') as HTMLElement).getByText(label));

const render_ = (onNavigate = vi.fn(), props = {}) =>
  render(
    <AuditView prd={prd} srs={srs} vtp={vtp} jobs={jobs} releases={releases}
      reference={reference} hasArchitecture onNavigate={onNavigate} {...props} />,
  );

describe('AuditView', () => {
  it('shows the scope disclaimer and the design-control map', () => {
    render_();
    expect(screen.getByText(/not itself a quality-management system/i)).toBeInTheDocument();
    expect(screen.getByText('Design Inputs')).toBeInTheDocument();
    expect(screen.getByText('Design Verification')).toBeInTheDocument();
  });

  it('cites design controls at ISO 13485, not the superseded Part 820 clauses', () => {
    const { container } = render_();
    // The QMSR incorporated ISO 13485 by reference into Part 820 on 2 February 2026, so
    // 820.30(x) is no longer where a reviewer looks up a design control.
    expect(container.textContent).not.toMatch(/820\.30/);
    expect(screen.getByText(/ISO 13485 §7\.3\.3/)).toBeInTheDocument();
  });

  it('never labels a clause a gap — what it does not hold, it points at', () => {
    const { container } = render_();
    expect(container.querySelector('.dc-status.gap')).toBeNull();
    expect(container.querySelectorAll('.dc-status.elsewhere').length).toBeGreaterThan(0);
    expect(screen.getAllByText('held elsewhere').length).toBeGreaterThan(0);
  });

  it('offers a tab per standard, and opens it', () => {
    render_();
    const tabs = within(document.querySelector('.nav-tabs') as HTMLElement);
    for (const label of ['Conformity', 'IEC 62304', 'FDA Software', 'FDA Cybersecurity', 'FDA OTS', 'Connected standards']) {
      expect(tabs.getByText(label)).toBeInTheDocument();
    }
    openTab('IEC 62304');
    expect(screen.getByText(/software life cycle processes/i)).toBeInTheDocument();
    expect(screen.getByText('Software problem resolution')).toBeInTheDocument();
  });

  it('resolves a clause held elsewhere to the reference that accounts for it', () => {
    render_();
    openTab('IEC 62304');
    // Clause 9 is covered by REF-1, so the row names the document rather than reporting a hole.
    expect(screen.getByText(/Software Problem Resolution Procedure \(SOP-012 rev C\), owned by Quality/)).toBeInTheDocument();
  });

  it('says so when nothing in the register accounts for a clause', () => {
    render_(vi.fn(), { reference: null });
    openTab('IEC 62304');
    expect(screen.getAllByText(/not yet named in the references register/i).length).toBeGreaterThan(0);
  });

  it('states what is deliberately not held here, and the standards around it', () => {
    render_();
    expect(screen.getByText(/SpecPad is not a quality management system/i)).toBeInTheDocument();
    expect(screen.getByText(/No SBOM is generated here/i)).toBeInTheDocument();

    openTab('Connected standards');
    expect(screen.getByText(/ISO 13485:2016/)).toBeInTheDocument();
    expect(screen.getByText(/ISO 14971:2019/)).toBeInTheDocument();
  });

  it('links an element to the tab that holds its evidence', () => {
    const onNavigate = vi.fn();
    render_(onNavigate);
    fireEvent.click(screen.getByRole('button', { name: 'Traceability' }));
    expect(onNavigate).toHaveBeenCalledWith('trace');
  });

  it('lists the roadmap but not the trace matrix', () => {
    render_();
    expect(screen.getByText(/Roadmap \(proposed product requirements\)/i)).toBeInTheDocument();
    expect(screen.getByText('Roadmap need.')).toBeInTheDocument();
    const headings = [...document.querySelectorAll('h4')].map((h) => h.textContent);
    expect(headings.some((h) => /Matrix/.test(h ?? ''))).toBe(false);
  });
});
