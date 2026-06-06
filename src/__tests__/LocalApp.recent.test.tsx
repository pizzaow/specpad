import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SrsDoc } from '../shared';

// The launcher points at a folder (dir=/x) for project "acme".
vi.mock('../launchParams', () => ({
  parseLaunchParams: () => ({ name: 'acme', open: 'srs', dir: '/x' }),
}));

// A remembered folder whose grant has persisted, matching the launcher's dir.
const recentRecord = {
  id: 1,
  handle: {} as FileSystemDirectoryHandle,
  dirName: 'repo',
  dir: '/x',
  projectNames: ['acme'],
  lastOpenedAt: 1,
};
vi.mock('../handleStore', () => ({
  isSupported: () => true,
  listRecent: vi.fn(async () => [recentRecord]),
  rememberProject: vi.fn(async () => undefined),
  forgetProject: vi.fn(async () => undefined),
}));

const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'acme', title: 'Requirements',
  items: [{ id: 'r_001', text: 'Auto-opened requirement' }],
};

const verifyPermission = vi.fn(async () => true);
const openProjectFromHandle = vi.fn(async () => ({
  name: 'acme',
  documents: [{ type: 'srs', name: 'acme', filename: 'acme.srs.json' }],
}));
vi.mock('../localFileApi', () => ({
  isFileSystemAccessSupported: () => true,
  hasOpenDirectory: () => true,
  getCurrentProjectName: () => 'acme',
  getDirHandle: () => ({}),
  verifyPermission: (...a: unknown[]) => verifyPermission(...(a as [])),
  openProjectFromHandle: (...a: unknown[]) => openProjectFromHandle(...(a as [])),
  loadDocument: vi.fn(async (_t: string, _n: string) => srs),
  loadProject: vi.fn(),
  openProjectDirectory: vi.fn(),
  openProjectFile: vi.fn(),
  listDocuments: vi.fn(async () => []),
  saveDocument: vi.fn(),
  createNewDocument: vi.fn(),
  openFileFallback: vi.fn(),
  saveFileFallback: vi.fn(),
  serializeDocument: vi.fn(),
}));

import LocalApp from '../LocalApp';

describe('LocalApp recent-project auto-open', () => {
  it('silently reopens the launcher folder when its grant persisted', async () => {
    render(<LocalApp />);
    // No click: the dir match + already-granted permission opens and loads the SRS.
    expect(await screen.findByText('Auto-opened requirement')).toBeInTheDocument();
    expect(verifyPermission).toHaveBeenCalledWith(recentRecord.handle, false);
    expect(openProjectFromHandle).toHaveBeenCalledWith(recentRecord.handle);
  });
});
