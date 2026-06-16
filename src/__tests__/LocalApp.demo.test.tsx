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

vi.mock('../launchParams', () => ({
  parseLaunchParams: () => ({ demo: true }),
}));

vi.mock('../localFileApi', () => ({
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
  loadSnapshot: vi.fn(async () => null),
  getDirHandle: vi.fn(() => null),
  verifyPermission: vi.fn(async () => false),
  openProjectFromHandle: vi.fn(),
}));

import LocalApp from '../LocalApp';
import { enableDemoMode, openDemoProject, saveDocument } from '../localFileApi';

describe('LocalApp demo mode', () => {
  it('auto-loads the demo project read-only', async () => {
    render(<LocalApp />);

    // Demo project loads without any picker interaction.
    expect(await screen.findByText('Demo requirement text')).toBeInTheDocument();
    expect(enableDemoMode).toHaveBeenCalledWith('/demo/');
    expect(openDemoProject).toHaveBeenCalled();

    // Read-only indicator is visible.
    expect(screen.getByText(/Demo — read-only/)).toBeInTheDocument();

    // No write affordances: no Save button and no File menu at all in demo.
    expect(screen.queryByLabelText('Save')).toBeNull();
    expect(screen.queryByText('File ▾')).toBeNull();

    // Ctrl+S is a no-op in demo mode — saveDocument must never be called.
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(saveDocument).not.toHaveBeenCalled();
  });

  it('shows a friendly error when the demo fails to load', async () => {
    (openDemoProject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('HTTP 503'));
    render(<LocalApp />);
    expect(await screen.findByText(/Could not load the demo project/)).toBeInTheDocument();
  });
});
