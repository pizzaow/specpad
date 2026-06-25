import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SrsDoc, VtpDoc } from '../shared';

const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'Requirements',
  items: [{ id: 'r_001', text: 'Requirement A' }],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'Verification',
  items: [{ id: 't_001', text: 'Test A', verifies: ['r_001'], expected: 'ok', result: 'passed' }],
};

vi.mock('../localFileApi', () => ({
  isFileSystemAccessSupported: () => true,
  hasOpenDirectory: () => true,
  getCurrentProjectName: () => 'Acme',
  // single project → auto-loads to the Overview
  openProjectDirectory: vi.fn(async () => ({
    name: 'Acme',
    documents: [
      { type: 'srs', name: 'Acme', filename: 'Acme.srs.json' },
      { type: 'vtp', name: 'Acme', filename: 'Acme.vtp.json' },
    ],
  })),
  openProjectFile: vi.fn(),
  listDocuments: vi.fn(async () => []),
  loadProject: vi.fn(async () => null),
  loadPrd: vi.fn(async () => null),
  loadRun: vi.fn(async () => null),
  loadDocument: vi.fn(async (type: 'srs' | 'vtp') => (type === 'srs' ? srs : vtp)),
  saveDocument: vi.fn(),
  createNewDocument: vi.fn(),
  openFileFallback: vi.fn(),
  saveFileFallback: vi.fn(),
  serializeDocument: vi.fn(),
  loadReleases: vi.fn(async () => null),
  loadJob: vi.fn(async () => null),
  saveJob: vi.fn(async () => undefined),
  loadJobs: vi.fn(async () => null),
  saveJobs: vi.fn(async () => undefined),
  loadJobSnapshot: vi.fn(async () => null),
  loadJobCommits: vi.fn(async () => []),
  loadJobText: vi.fn(async () => null),
  loadProjectText: vi.fn(async () => null),
  saveProjectText: vi.fn(async () => undefined),
  loadSnapshot: vi.fn(async () => null),
  getDirHandle: vi.fn(() => null),
  verifyPermission: vi.fn(async () => false),
  openProjectFromHandle: vi.fn(),
}));

import LocalApp from '../LocalApp';

async function openProject() {
  render(<LocalApp />);
  fireEvent.click(screen.getByText('File ▾'));
  fireEvent.click(screen.getByText('Open project directory…'));
  // lands on the Overview
  expect(await screen.findByText(/Project overview/i)).toBeInTheDocument();
}

describe('LocalApp in-view navigation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('Overview jump buttons switch the active view', async () => {
    await openProject();
    fireEvent.click(screen.getByText('Open requirements'));
    expect(await screen.findByText('Requirement A')).toBeInTheDocument();
  });

  it('Auditor "View →" links switch the active view', async () => {
    await openProject();
    fireEvent.click(screen.getByText('Auditor')); // the tab
    // The Design Inputs row links to Requirements.
    const viewLinks = await screen.findAllByText('View →');
    fireEvent.click(viewLinks[0]);
    expect(await screen.findByText('Requirement A')).toBeInTheDocument();
  });

  it('Auditor → Traceability pointer switches to the matrix', async () => {
    await openProject();
    fireEvent.click(screen.getByText('Auditor'));
    fireEvent.click(await screen.findByRole('button', { name: 'Traceability' }));
    // Traceability view renders the Matrix heading.
    expect(await screen.findByText('Matrix')).toBeInTheDocument();
  });
});
