/**
 * MenuBar — the application menu bar: brand + project switcher, File menu, Save
 * (with an unsaved-changes dot), and the current-job chip. Presentational; every
 * action is a callback the shell (LocalApp) supplies. One open-menu at a time,
 * closed by a shared backdrop (same pattern as RowMenu).
 */
import React, { useState } from 'react';
import type { JobDoc, JobRecord } from '../shared';
import JobControl from './JobControl';
import { THEMES } from '../theme';
import type { ThemeId } from '../theme';

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
  jobs?: JobRecord[];
  activeIds?: string[];
  activeJobLabel?: string | null;
  onSetJob: (ids: string[], title?: string) => void;
  version?: string | null;
  onShowVersions?: () => void;
  theme: ThemeId;
  onSetTheme: (id: ThemeId) => void;
  demo?: boolean;
}

type OpenMenu = null | 'file' | 'project' | 'job' | 'theme';

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

      <span className="menubar-brand"><span className="brand-mark" aria-hidden="true">◆</span> <span>SpecPad</span></span>

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
        <span className="menubar-project">Job: {p.activeJobLabel ?? p.job.job}</span>
      )}
      {p.isDirectoryOpen && !p.demo && (
        <span className="menubar-dropdown">
          <button type="button" className={chip} onClick={() => toggle('job')}>
            {p.job ? `Job: ${p.activeJobLabel ?? p.job.job} ▾` : 'Set job ▾'}
          </button>
          {open === 'job' && (
            <div className="menubar-popover">
              <JobControl job={p.job} jobs={p.jobs} activeIds={p.activeIds} onSet={(ids, t) => { close(); p.onSetJob(ids, t); }} />
            </div>
          )}
        </span>
      )}

      {p.isDirectoryOpen && p.version && (
        <button type="button" className={chip} onClick={() => p.onShowVersions?.()}>{p.version} ▾</button>
      )}

      <span className="menubar-dropdown">
        <button type="button" className={chip} aria-label="Theme" onClick={() => toggle('theme')}>Theme ▾</button>
        {open === 'theme' && (
          <ul className="menubar-menu theme-menu">
            {THEMES.map((t) => (
              <li
                key={t.id}
                className={`theme-option${t.id === p.theme ? ' is-active' : ''}`}
                onClick={run(() => p.onSetTheme(t.id))}
              >
                <span className={`swatch swatch-${t.id}`} aria-hidden="true" />
                <span>
                  <span className="theme-label">{t.label}</span>
                  <br />
                  <span className="theme-blurb">{t.blurb}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </span>
    </div>
  );
};

export default MenuBar;
