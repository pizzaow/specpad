import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { SrsDoc } from '../shared';

// Two single-doc projects sharing one directory; switching between them in the
// brand dropdown must re-seed the table (regression guard for the key={selectedDocName}
// remount in LocalApp — without it, the table keeps editing the prior document).
const docA: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'AppA', title: 'Requirements',
  items: [{ id: 'r_001', text: 'Requirement A' }],
};
const docB: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'AppB', title: 'Requirements',
  items: [{ id: 'r_002', text: 'Requirement B' }],
};

vi.mock('../localFileApi', () => ({
  isFileSystemAccessSupported: () => true,
  hasOpenDirectory: () => true,
  getCurrentProjectName: () => 'AppA',
  openProjectDirectory: vi.fn(async () => ({
    name: 'AppA',
    documents: [
      { type: 'srs', name: 'AppA', filename: 'AppA.srs.json' },
      { type: 'srs', name: 'AppB', filename: 'AppB.srs.json' },
    ],
  })),
  openProjectFile: vi.fn(),
  listDocuments: vi.fn(async () => []),
  loadProject: vi.fn(),
  loadDocument: vi.fn(async (_type: 'srs' | 'vtp', name: string) => (name === 'AppA' ? docA : docB)),
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
  loadSnapshot: vi.fn(async () => null),
  getDirHandle: vi.fn(() => null),
  verifyPermission: vi.fn(async () => false),
  openProjectFromHandle: vi.fn(),
}));

import LocalApp from '../LocalApp';

describe('LocalApp document switching', () => {
  beforeEach(() => vi.clearAllMocks());

  it('re-seeds the table when the selected document changes', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<LocalApp />);

    // Open via File menu → Open project directory…
    fireEvent.click(screen.getByText('File ▾'));
    fireEvent.click(screen.getByText('Open project directory…'));

    // Two projects — no auto-load. Brand dropdown appears with projectName 'AppA'.
    // The brand button renders <span>AppA</span> ▾; click the span to open switcher.
    const brandTrigger = await screen.findByText('AppA');
    fireEvent.click(brandTrigger);

    // Dropdown shows both project names; pick AppB.
    fireEvent.click(await screen.findByText('AppB'));
    expect(await screen.findByText('Requirement B')).toBeInTheDocument();

    // Switch back: brand still shows AppA (directory name unchanged).
    fireEvent.click(screen.getByText('AppA'));
    fireEvent.click(await screen.findByText('AppA', { selector: 'li' }));
    expect(await screen.findByText('Requirement A')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Requirement B')).toBeNull());

    // Switching between documents with no unsaved edits must never prompt.
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
