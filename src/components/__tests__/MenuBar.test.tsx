import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MenuBar from '../MenuBar';
import type { JobDoc } from '../../shared';

function props(over: Partial<React.ComponentProps<typeof MenuBar>> = {}) {
  return {
    projectName: 'AcmeApp',
    projectNames: ['AcmeApp'],
    onSelectProject: vi.fn(),
    isDirectoryOpen: true,
    supportsFileSystemAccess: true,
    dirty: false,
    onSave: vi.fn(),
    onNewDocument: vi.fn(),
    onOpenDirectory: vi.fn(),
    onOpenProjectFile: vi.fn(),
    onOpenFallback: vi.fn(),
    job: null as JobDoc | null,
    onSetJob: vi.fn(),
    version: null as string | null,
    onShowVersions: vi.fn(),
    ...over,
  };
}

describe('MenuBar', () => {
  it('shows the brand and project name', () => {
    render(<MenuBar {...props()} />);
    expect(screen.getByText('SpecPad')).toBeInTheDocument();
    expect(screen.getByText('AcmeApp')).toBeInTheDocument();
  });

  it('Save is disabled when clean and enabled with a dot when dirty', () => {
    const { rerender } = render(<MenuBar {...props({ dirty: false })} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    rerender(<MenuBar {...props({ dirty: true })} />);
    const save = screen.getByRole('button', { name: /save/i });
    expect(save).not.toBeDisabled();
    expect(save.textContent).toContain('●');
  });

  it('calls onSave when Save is clicked while dirty', () => {
    const p = props({ dirty: true });
    render(<MenuBar {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(p.onSave).toHaveBeenCalledTimes(1);
  });

  it('opens the File menu and fires New document', () => {
    const p = props();
    render(<MenuBar {...p} />);
    fireEvent.click(screen.getByText('File ▾'));
    fireEvent.click(screen.getByText('New document…'));
    expect(p.onNewDocument).toHaveBeenCalledTimes(1);
  });

  it('switches project from the brand dropdown when there are several', () => {
    const p = props({ projectNames: ['AcmeApp', 'OtherApp'] });
    render(<MenuBar {...p} />);
    fireEvent.click(screen.getByText('AcmeApp')); // brand switcher trigger
    fireEvent.click(screen.getByText('OtherApp'));
    expect(p.onSelectProject).toHaveBeenCalledWith('OtherApp');
  });

  it('opens the job popover and sets a job', () => {
    const p = props();
    render(<MenuBar {...p} />);
    fireEvent.click(screen.getByText('Set job ▾'));
    fireEvent.change(screen.getByPlaceholderText('Job id (e.g. PROJ-123)'), { target: { value: 'PROJ-9' } });
    fireEvent.click(screen.getByText('Set job'));
    expect(p.onSetJob).toHaveBeenCalledWith('PROJ-9', '');
  });

  it('shows the version chip and opens version history', () => {
    const p = props({ version: 'v1.0' });
    render(<MenuBar {...p} />);
    fireEvent.click(screen.getByText('v1.0 ▾'));
    expect(p.onShowVersions).toHaveBeenCalledTimes(1);
  });

  it('in the no-directory state, File offers Open project directory', () => {
    const p = props({ isDirectoryOpen: false, projectName: '', projectNames: [] });
    render(<MenuBar {...p} />);
    fireEvent.click(screen.getByText('File ▾'));
    fireEvent.click(screen.getByText('Open project directory…'));
    expect(p.onOpenDirectory).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull(); // no Save until a dir is open
  });
});
