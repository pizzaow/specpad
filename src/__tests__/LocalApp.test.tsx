import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { SrsDoc } from '../shared';

// Two single-doc projects sharing one directory; switching between them in the
// dropdown must re-seed the table (regression guard for the key={selectedDocName}
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
  loadSnapshot: vi.fn(async () => null),
}));

import LocalApp from '../LocalApp';

describe('LocalApp document switching', () => {
  beforeEach(() => vi.clearAllMocks());

  it('re-seeds the table when the selected document changes', async () => {
    render(<LocalApp />);

    fireEvent.click(screen.getByText('Open Project Directory'));

    // After open, a document picker with both names appears (no auto-load for 2 docs).
    const picker = await screen.findByRole('combobox');
    fireEvent.change(picker, { target: { value: 'AppB' } });
    expect(await screen.findByText('Requirement B')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'AppA' } });
    expect(await screen.findByText('Requirement A')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Requirement B')).toBeNull());
  });
});
