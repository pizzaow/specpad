import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { SrsDoc, VtpDoc, ProjectDoc } from '../shared';

const demoSrs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'specpad', title: 'SpecPad SRS',
  items: [{ id: 'r_001', text: 'Demo requirement text' }],
};
const demoVtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'specpad', title: 'SpecPad VTP',
  items: [{ id: 't_001', text: 'Demo test', verifies: ['r_001'], expected: 'Works' }],
};
const demoProj: ProjectDoc = {
  schemaVersion: '1.0', type: 'project', name: 'specpad', title: 'SpecPad',
  documents: [],
};

// CodeMirror needs real DOM measurement; stub it to a textarea for jsdom.
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: any) => (
    <textarea data-testid="cm" value={value} onChange={(e: any) => onChange?.(e.target.value)} />
  ),
}));
vi.mock('@codemirror/lang-markdown', () => ({ markdown: () => [] }));

vi.mock('../launchParams', () => ({
  parseLaunchParams: () => ({ demo: true }),
}));

vi.mock('../fileApi', () => ({
  isFileSystemAccessSupported: () => true,
  enableDemoMode: vi.fn(),
  disableDemoMode: vi.fn(),
  openDemoProject: vi.fn(async () => ({
    name: 'specpad',
    documents: [
      { type: 'proj', name: 'specpad', filename: 'specpad.proj.json' },
      { type: 'srs', name: 'specpad', filename: 'specpad.srs.json' },
      { type: 'vtp', name: 'specpad', filename: 'specpad.vtp.json' },
    ],
  })),
  hasOpenDirectory: () => true,
  getCurrentProjectName: () => 'specpad',
  openProjectDirectory: vi.fn(),
  openProjectFile: vi.fn(),
  listDocuments: vi.fn(async () => []),
  loadProject: vi.fn(async () => demoProj),
  loadSdd: vi.fn(async () => null),
  loadRisk: vi.fn(async () => null),
  loadSoup: vi.fn(async () => null),
  loadThreat: vi.fn(async () => null),
  loadPrd: vi.fn(async () => null),
  loadRun: vi.fn(async () => null),
  loadDocument: vi.fn(async (type: 'srs' | 'vtp') => (type === 'srs' ? demoSrs : demoVtp)),
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
  loadProjectText: vi.fn(async (f: string) => (f.endsWith('.sad.md') ? '# Architecture\n\nDemo SAD body.\n' : null)),
  saveProjectText: vi.fn(async () => undefined),
  loadSnapshot: vi.fn(async () => null),
  getDirHandle: vi.fn(() => null),
  verifyPermission: vi.fn(async () => false),
  openProjectFromHandle: vi.fn(),
  connectToSpecPadServer: vi.fn(async () => null),
  listServerProjects: vi.fn(async () => []),
  switchServerProject: vi.fn(async () => null),
  isProjectChoice: () => false,
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
import { enableDemoMode, openDemoProject, saveDocument, saveFileFallback } from '../fileApi';

describe('LocalApp demo mode', () => {
  it('auto-loads the demo project as an editable sandbox', async () => {
    render(<LocalApp />);

    // Demo project loads without any picker interaction, opening on the Overview;
    // switch to the SRS tab to see the spec table.
    fireEvent.click(await screen.findByText('SRS'));
    expect(await screen.findByText('Demo requirement text')).toBeInTheDocument();
    expect(enableDemoMode).toHaveBeenCalledWith('/demo/');
    expect(openDemoProject).toHaveBeenCalled();

    // The banner says what the sandbox is, rather than claiming read-only.
    expect(screen.getByText(/Demo — sandbox, nothing is saved/)).toBeInTheDocument();

    // Editing IS offered: the row menu is present, which it was not when the demo was
    // read-only. Opening a project folder is still not offered — there is nothing to open.
    expect(screen.getAllByLabelText(/row actions/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('File ▾')).toBeNull();

    // Nothing is ever written back: the demo has nowhere to write to.
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(saveDocument).not.toHaveBeenCalled();
  });

  it('hands an edited document back as a download instead of saving it', async () => {
    render(<LocalApp />);
    fireEvent.click(await screen.findByText('SRS'));

    // Edit a cell, then use the Download control the sandbox offers in place of Save.
    fireEvent.click(screen.getByText('Demo requirement text'));
    const field = await screen.findByDisplayValue('Demo requirement text');
    fireEvent.change(field, { target: { value: 'Edited in the sandbox' } });
    fireEvent.blur(field);
    expect(await screen.findByText('Edited in the sandbox')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Download'));

    expect(saveFileFallback).toHaveBeenCalled();
    expect(saveDocument).not.toHaveBeenCalled();
  });

  it('hands the ARCHITECTURE document back as a download too, not just the registers (EDS-11)', async () => {
    // The defect this pins: `persist` had the demo exit, but the SAD, the C4 DSL, the security
    // markdown and the jobs register called the write helpers directly, so in the sandbox they
    // hit the transport's read-only refusal and Save reported a failure — for documents the
    // demo explicitly promises are editable.
    const { saveProjectText, saveFileFallback } = await import('../fileApi');
    render(<LocalApp />);
    fireEvent.click(await screen.findByText('SAD'));

    const editTab = await screen.findByText('Edit');
    fireEvent.click(editTab);
    const area = await screen.findByTestId('cm');
    fireEvent.change(area, { target: { value: '# Architecture\n\nEdited in the sandbox.\n' } });

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await vi.waitFor(() => expect(saveFileFallback).toHaveBeenCalled());
    expect(saveProjectText).not.toHaveBeenCalled();
  });

  it('shows a friendly error when the demo fails to load', async () => {
    (openDemoProject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('HTTP 503'));
    render(<LocalApp />);
    expect(await screen.findByText(/Could not load the demo project/)).toBeInTheDocument();
  });
});
