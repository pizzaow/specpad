/**
 * MenuBar — the application menu bar: brand + project switcher, File menu, Save
 * (with an unsaved-changes dot), and the current-job chip. Presentational; every
 * action is a callback the shell (LocalApp) supplies. One open-menu at a time,
 * closed by a shared backdrop (same pattern as RowMenu).
 */
import React, { useState } from 'react';
import type { JobDoc } from '../shared';
import JobControl from './JobControl';

export interface MenuBarProps {
  projectName: string;
  projectNames: string[];
  onSelectProject: (name: string) => void;
  isDirectoryOpen: boolean;
  supportsFileSystemAccess: boolean;
  dirty: boolean;
  onSave: () => void;
  onNewDocument: () => void;
  onOpenDirectory: () => void;
  onOpenProjectFile: () => void;
  onOpenFallback: () => void;
  job: JobDoc | null;
  onSetJob: (job: string, title: string) => void;
  version?: string | null;
  onShowVersions?: () => void;
  demo?: boolean;
}

type OpenMenu = null | 'file' | 'project' | 'job';

const itemStyle: React.CSSProperties = { display: 'block', padding: '7px 14px', whiteSpace: 'nowrap', cursor: 'pointer' };
const chip = 'menubar-chip';

const MenuBar: React.FC<MenuBarProps> = (p) => {
  const [open, setOpen] = useState<OpenMenu>(null);
  const close = () => setOpen(null);
  const toggle = (m: OpenMenu) => setOpen((cur) => (cur === m ? null : m));
  const run = (fn: () => void) => () => { close(); fn(); };

  return (
    <div className="menubar">
      {open && <div data-testid="menubar-backdrop" className="menubar-backdrop" onClick={close} />}

      <span className="menubar-brand"><span aria-hidden="true">▣</span> <span>SpecPad</span></span>

      {p.isDirectoryOpen && p.projectName && (
        p.projectNames.length > 1 ? (
          <span className="menubar-dropdown">
            <button type="button" className={chip} onClick={() => toggle('project')}><span>{p.projectName}</span> ▾</button>
            {open === 'project' && (
              <ul className="menubar-menu">
                {p.projectNames.map((n) => (
                  <li key={n} style={itemStyle} onClick={run(() => p.onSelectProject(n))}>{n}</li>
                ))}
              </ul>
            )}
          </span>
        ) : (
          <span className="menubar-project">{p.projectName}</span>
        )
      )}

      {!p.demo && (
        <span className="menubar-dropdown">
          <button type="button" className={chip} onClick={() => toggle('file')}>File ▾</button>
          {open === 'file' && (
            <ul className="menubar-menu">
              {p.isDirectoryOpen && (
                <li style={itemStyle} onClick={run(p.onNewDocument)}>New document…</li>
              )}
              {p.supportsFileSystemAccess ? (
                <>
                  <li style={itemStyle} onClick={run(p.onOpenDirectory)}>Open project directory…</li>
                  <li style={itemStyle} onClick={run(p.onOpenProjectFile)}>Open project file…</li>
                  {p.isDirectoryOpen && <li style={itemStyle} onClick={run(p.onOpenDirectory)}>Change directory…</li>}
                </>
              ) : (
                <li style={itemStyle} onClick={run(p.onOpenFallback)}>Open document file…</li>
              )}
            </ul>
          )}
        </span>
      )}

      {p.isDirectoryOpen && !p.demo && (
        <button type="button" className={chip} aria-label="Save" disabled={!p.dirty} onClick={p.onSave}>
          💾 Save{p.dirty ? ' ●' : ''}
        </button>
      )}

      <span className="menubar-spacer" />

      {p.isDirectoryOpen && p.demo && p.job && (
        <span className="menubar-project">Job: {p.job.job}</span>
      )}
      {p.isDirectoryOpen && !p.demo && (
        <span className="menubar-dropdown">
          <button type="button" className={chip} onClick={() => toggle('job')}>
            {p.job ? `Job: ${p.job.job} ▾` : 'Set job ▾'}
          </button>
          {open === 'job' && (
            <div className="menubar-popover">
              <JobControl job={p.job} onSet={(j, t) => { close(); p.onSetJob(j, t); }} />
            </div>
          )}
        </span>
      )}

      {p.isDirectoryOpen && p.version && (
        <button type="button" className={chip} onClick={() => p.onShowVersions?.()}>{p.version} ▾</button>
      )}
    </div>
  );
};

export default MenuBar;
