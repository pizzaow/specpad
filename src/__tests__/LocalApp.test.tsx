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

vi.mock('../fileApi', () => ({
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
  loadSdd: vi.fn(async () => null),
  loadPrd: vi.fn(async () => null),
  loadRun: vi.fn(async () => null),
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
  loadJobSnapshot: vi.fn(async () => null),
  loadJobCommits: vi.fn(async () => []),
  loadProjectText: vi.fn(async () => null),
  saveProjectText: vi.fn(async () => undefined),
  loadSnapshot: vi.fn(async () => null),
  getDirHandle: vi.fn(() => null),
  verifyPermission: vi.fn(async () => false),
  openProjectFromHandle: vi.fn(),
  // No SpecPad server is serving these tests: the editor falls through to local files.
  connectToSpecPadServer: vi.fn(async () => null),
  listServerProjects: vi.fn(async () => []),
  switchServerProject: vi.fn(async () => null),
  isProjectChoice: (r: unknown) => typeof r === 'object' && r !== null && 'chooseProject' in r,
  serverApiBase: (id?: string) => (id ? `/api/v1/p/${id}` : '/api/v1'),
  isServerMode: () => false,
  openServerProject: vi.fn(),
  serverStatus: vi.fn(async () => ({ changed: [], dirty: false })),
  serverCommit: vi.fn(),
  serverDiscard: vi.fn(),
  serverSubscribe: vi.fn(() => () => undefined),
  serverClaimPresence: vi.fn(async () => undefined),
  serverReleasePresence: vi.fn(async () => undefined),
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

    // Two projects — no auto-load (opens on Overview). The brand dropdown shows
    // projectName 'AppA' (the menubar chip; the Overview also titles 'AppA', so
    // target the button specifically).
    const brandTrigger = await screen.findByRole('button', { name: /AppA/ });
    fireEvent.click(brandTrigger);

    // Dropdown shows both project names; pick AppB.
    fireEvent.click(await screen.findByText('AppB'));
    // The editor opens on the Overview; switch to the SRS tab to see the table.
    fireEvent.click(await screen.findByText('SRS'));
    expect(await screen.findByText('Requirement B')).toBeInTheDocument();

    // Switch back: brand still shows AppA (directory name unchanged). The Requirements
    // tab stays selected across the switch, so the table re-seeds with AppA's items.
    fireEvent.click(screen.getByText('AppA'));
    fireEvent.click(await screen.findByText('AppA', { selector: 'li' }));
    expect(await screen.findByText('Requirement A')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Requirement B')).toBeNull());

    // Switching between documents with no unsaved edits must never prompt.
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('opens on the Overview by default', async () => {
    render(<LocalApp />);
    fireEvent.click(screen.getByText('File ▾'));
    fireEvent.click(screen.getByText('Open project directory…'));
    expect(await screen.findByText(/Project overview/i)).toBeInTheDocument();
  });

  // MPT-9: a server hosting several projects, opened without one named in the URL.
  it('asks which project to open rather than picking one or falling back to files', async () => {
    const { connectToSpecPadServer } = await import('../fileApi');
    (connectToSpecPadServer as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      chooseProject: [
        { id: 'alpha', title: 'Alpha Device', branch: 'main', role: 'committer' },
        { id: 'beta', title: 'Beta Device', branch: 'release', role: 'reader' },
      ],
    });

    render(<LocalApp />);

    expect(await screen.findByText(/Choose a project/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Alpha Device' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Beta Device' })).toBeInTheDocument();
    // Not the local-files path: no folder picker prompt is offered in its place.
    expect(screen.queryByText(/doesn't support the File System Access API/i)).toBeNull();

    // Choosing one opens it in place, rather than navigating away (MPT-11).
    const { switchServerProject } = await import('../fileApi');
    fireEvent.click(screen.getByRole('button', { name: 'Beta Device' }));
    await waitFor(() => expect(switchServerProject).toHaveBeenCalledWith('beta'));
  });

  // MPT-12: switching reloads from the new project and leaves the URL naming it.
  it('reloads from the newly-selected project and rewrites the URL to name it', async () => {
    const fileApi = await import('../fileApi');
    const connect = fileApi.connectToSpecPadServer as unknown as ReturnType<typeof vi.fn>;
    const switchTo = fileApi.switchServerProject as unknown as ReturnType<typeof vi.fn>;
    const listProjects = fileApi.listServerProjects as unknown as ReturnType<typeof vi.fn>;
    const openServer = fileApi.openServerProject as unknown as ReturnType<typeof vi.fn>;

    const sessionFor = (projectId: string, project: string) => ({
      principal: { id: 'jane', displayName: 'Jane Smith', email: 'jane@corp.example' },
      role: 'committer' as const,
      capabilities: { read: true, write: true, commit: true },
      repo: { branch: 'main', projectDir: 'docs/specpad' },
      projectId,
      project,
      activeJob: null,
      commitPolicy: { requireActiveJob: true, requireGovernanceClean: 'warn' },
    });

    connect.mockResolvedValueOnce(sessionFor('alpha', 'AppA'));
    listProjects.mockResolvedValueOnce([
      { id: 'alpha', title: 'Alpha Device', branch: 'main', role: 'committer' },
      { id: 'beta', title: 'Beta Device', branch: 'main', role: 'committer' },
    ]);
    openServer.mockResolvedValue({ name: 'AppA', documents: [{ type: 'srs', name: 'AppA', filename: 'AppA.srs.json' }] });

    render(<LocalApp />);

    const chip = await screen.findByRole('button', { name: /Alpha Device/ });

    // Choosing Beta switches the transport and re-opens through the normal path.
    switchTo.mockResolvedValueOnce(sessionFor('beta', 'AppB'));
    openServer.mockResolvedValue({ name: 'AppB', documents: [{ type: 'srs', name: 'AppB', filename: 'AppB.srs.json' }] });
    fireEvent.click(chip);
    fireEvent.click(await screen.findByText('Beta Device'));

    await waitFor(() => expect(switchTo).toHaveBeenCalledWith('beta'));
    // The chip now names Beta, and a reload would come back to it.
    expect(await screen.findByRole('button', { name: /Beta Device/ })).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toContain('project=beta'));
  });
});