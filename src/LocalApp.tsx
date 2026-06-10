/**
 * LocalApp — SpecPad editor root.
 * Manages the open project (srs/vtp/proj), the active view, live validation, the
 * launcher deep-link (#name=&open=&dir=), and a recent-projects list backed by
 * persisted directory handles so return visits reopen without re-picking.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { ProjectDoc, SrsDoc, VtpDoc, ReleasesDoc, JobDoc } from './shared';
import {
  DocumentListItem,
  isFileSystemAccessSupported,
  enableDemoMode,
  disableDemoMode,
  openDemoProject,
  openProjectDirectory,
  openProjectFile,
  openProjectFromHandle,
  getDirHandle,
  verifyPermission,
  listDocuments,
  loadDocument,
  loadProject,
  saveDocument,
  createNewDocument,
  hasOpenDirectory,
  getCurrentProjectName,
  openFileFallback,
  saveFileFallback,
  serializeDocument,
  loadReleases,
  loadJob,
  saveJob,
  loadSnapshot,
} from './localFileApi';
import { buildRedline, computeAttribution } from './changeTracking';
import type { SnapshotInput } from './changeTracking';
import { cachedReleases } from './changeTrackingView';
import MenuBar from './components/MenuBar';
import VersionHistoryDialog from './components/VersionHistoryDialog';
import * as recentStore from './handleStore';
import type { RecentProject } from './handleStore';
import { parseLaunchParams } from './launchParams';
import SRSTable from './components/SRSTable';
import VTPTable from './components/VTPTable';
import TestingView from './components/TestingView';
import StatusBar from './components/StatusBar';
import ViewTabs from './components/ViewTabs';

type ViewMode = 'srs' | 'vtp' | 'testing';
type OpenResult = { name: string; documents: DocumentListItem[] };

const LocalApp: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [projectDoc, setProjectDoc] = useState<ProjectDoc | null>(null);
  const [srsDoc, setSrsDoc] = useState<SrsDoc | null>(null);
  const [vtpDoc, setVtpDoc] = useState<VtpDoc | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('srs');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocName, setSelectedDocName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [launch] = useState(parseLaunchParams);
  const [releases, setReleases] = useState<ReleasesDoc | null>(null);
  const [job, setJob] = useState<JobDoc | null>(null);
  const [srsBaseline, setSrsBaseline] = useState<SrsDoc | null>(null);
  const [vtpBaseline, setVtpBaseline] = useState<VtpDoc | null>(null);
  const [srsSnapshots, setSrsSnapshots] = useState<SnapshotInput[]>([]);
  const [vtpSnapshots, setVtpSnapshots] = useState<SnapshotInput[]>([]);
  const [dirtySrs, setDirtySrs] = useState(false);
  const [dirtyVtp, setDirtyVtp] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const supportsFileSystemAccess = isFileSystemAccessSupported();

  const vtpRedline = React.useMemo(
    () => (vtpDoc ? buildRedline(vtpBaseline, vtpDoc) : undefined),
    [vtpBaseline, vtpDoc],
  );
  const srsAttribution = React.useMemo(() => computeAttribution(srsSnapshots), [srsSnapshots]);
  const vtpAttribution = React.useMemo(() => computeAttribution(vtpSnapshots), [vtpSnapshots]);

  const handleSetJob = async (jobId: string, title: string) => {
    const name = selectedDocName || projectName;
    const doc: JobDoc = { schemaVersion: '1.0', type: 'job', job: jobId, ...(title ? { title } : {}) };
    try {
      await saveJob(name, doc);
      setJob(doc);
      setError(null);
    } catch (err: any) {
      setError(`Failed to set job: ${err.message}`);
    }
  };

  // Load the change-tracking cache for a project: manifest, job marker, and the
  // cached snapshots (oldest→newest) used for redline (baseline) and attribution.
  const loadChangeTracking = async (name: string) => {
    const rel = await loadReleases(name);
    setReleases(rel);
    setJob(await loadJob(name));
    const cached = cachedReleases(rel);
    const srsSnaps: SnapshotInput[] = [];
    const vtpSnaps: SnapshotInput[] = [];
    let srsBase: SrsDoc | null = null;
    let vtpBase: VtpDoc | null = null;
    for (const c of cached) {
      const s = (await loadSnapshot(c.location, 'srs', name)) as SrsDoc | null;
      const v = (await loadSnapshot(c.location, 'vtp', name)) as VtpDoc | null;
      if (s) srsSnaps.push({ version: c.version, author: c.author, doc: s });
      if (v) vtpSnaps.push({ version: c.version, author: c.author, doc: v });
      if (c.location === 'baseline') { srsBase = s; vtpBase = v; }
    }
    setSrsSnapshots(srsSnaps);
    setVtpSnapshots(vtpSnaps);
    setSrsBaseline(srsBase);
    setVtpBaseline(vtpBase);
  };

  const loadNamedDocs = async (name: string) => {
    const proj = documents.find((d) => d.name === name && d.type === 'proj');
    const srs = documents.find((d) => d.name === name && d.type === 'srs');
    const vtp = documents.find((d) => d.name === name && d.type === 'vtp');
    setProjectDoc(proj ? await loadProject(name) : null);
    setSrsDoc(srs ? await loadDocument('srs', name) : null);
    setVtpDoc(vtp ? await loadDocument('vtp', name) : null);
    setSelectedDocName(name);
    await loadChangeTracking(name);
    setDirtySrs(false);
    setDirtyVtp(false);
  };

  // Variant used right after open(), before `documents` state has settled.
  const loadNamedDocsFrom = async (docs: DocumentListItem[], name: string) => {
    const proj = docs.find((d) => d.name === name && d.type === 'proj');
    const srs = docs.find((d) => d.name === name && d.type === 'srs');
    const vtp = docs.find((d) => d.name === name && d.type === 'vtp');
    setProjectDoc(proj ? await loadProject(name) : null);
    setSrsDoc(srs ? await loadDocument('srs', name) : null);
    setVtpDoc(vtp ? await loadDocument('vtp', name) : null);
    setSelectedDocName(name);
    await loadChangeTracking(name);
    setDirtySrs(false);
    setDirtyVtp(false);
  };

  // Apply a freshly-opened project: set state, auto-load a single/requested doc,
  // and remember the folder handle for next time.
  const applyOpened = async (result: OpenResult, preferName?: string) => {
    setProjectName(result.name);
    setDocuments(result.documents);
    setIsDirectoryOpen(true);
    const names = Array.from(new Set(result.documents.map((d) => d.name)));
    const chosen =
      preferName && names.includes(preferName) ? preferName : names.length === 1 ? names[0] : '';
    if (chosen) {
      await loadNamedDocsFrom(result.documents, chosen);
    } else {
      setSelectedDocName('');
      setSrsDoc(null);
      setVtpDoc(null);
      setProjectDoc(null);
      setReleases(null);
      setJob(null);
      setSrsBaseline(null);
      setVtpBaseline(null);
      setSrsSnapshots([]);
      setVtpSnapshots([]);
    }
    if (recentStore.isSupported()) {
      const dh = getDirHandle();
      if (dh) {
        await recentStore.rememberProject(dh, {
          dir: launch.dir,
          projectNames: names,
          now: Date.now(),
        });
        setRecent(await recentStore.listRecent());
      }
    }
  };

  const handleOpenProject = async (useProjectFile: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = useProjectFile ? await openProjectFile() : await openProjectDirectory();
      await applyOpened(result, launch.name);
    } catch (err: any) {
      setError(`Failed to open project: ${err.message}`);
      setIsDirectoryOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const openFromRecent = async (record: RecentProject) => {
    setLoading(true);
    setError(null);
    try {
      if (!(await verifyPermission(record.handle, true))) {
        setError('Permission to that folder was not granted.');
        return;
      }
      const result = await openProjectFromHandle(record.handle);
      await applyOpened(result, launch.name);
    } catch {
      await recentStore.forgetProject(record.id);
      setRecent(await recentStore.listRecent());
      setError('That folder is no longer available — please open it again.');
    } finally {
      setLoading(false);
    }
  };

  const forgetRecent = async (id: number) => {
    await recentStore.forgetProject(id);
    setRecent(await recentStore.listRecent());
  };

  // On load: pick the initial view, list recent projects, and — when the launcher
  // points at a folder whose permission already persisted — reopen it silently.
  useEffect(() => {
    if (launch.open) setCurrentView(launch.open);
    if (launch.demo) {
      let cancelled = false;
      void (async () => {
        setLoading(true);
        try {
          enableDemoMode('/demo/');
          const result = await openDemoProject();
          if (!cancelled) await applyOpened(result, launch.name);
        } catch (err) {
          disableDemoMode();
          console.error('Demo load failed:', err);
          if (!cancelled) setError('Could not load the demo project — please try again later.');
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    if (!supportsFileSystemAccess || !recentStore.isSupported()) return;
    let cancelled = false;
    (async () => {
      const list = await recentStore.listRecent();
      if (cancelled) return;
      setRecent(list);
      let candidate = launch.dir ? list.find((r) => r.dir === launch.dir) : undefined;
      if (!candidate && launch.name) {
        const wantName = launch.name;
        const named = list.filter((r) => r.projectNames.includes(wantName));
        if (named.length === 1) candidate = named[0];
      }
      if (candidate && (await verifyPermission(candidate.handle, false))) {
        try {
          const result = await openProjectFromHandle(candidate.handle);
          if (!cancelled) await applyOpened(result, launch.name);
        } catch {
          /* stale handle — leave it for the user to reopen manually */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectDocument = async (name: string) => {
    if (!name || !hasOpenDirectory()) return;
    if (dirty && !window.confirm('You have unsaved changes that will be lost. Switch anyway?')) return;
    setLoading(true);
    setError(null);
    try {
      await loadNamedDocs(name);
    } catch (err: any) {
      setError(`Failed to open document: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNewDocument = async () => {
    if (!hasOpenDirectory()) { setError('Open a project directory first'); return; }
    const name = prompt('Document name:', getCurrentProjectName() || 'mydoc');
    if (!name) return;
    const title = prompt('Document title:', 'Requirements');
    if (!title) return;
    const type = confirm('Create SRS? (Cancel for VTP)') ? 'srs' : 'vtp';
    try {
      const doc = await createNewDocument(name, title, type);
      if (doc.type === 'srs') setSrsDoc(doc); else setVtpDoc(doc);
      setSelectedDocName(name);
      setCurrentView(type);
      setDocuments(await listDocuments());
    } catch (err: any) {
      setError(`Failed to create document: ${err.message}`);
    }
  };

  // Tables are controlled: an edit replaces the working doc and marks it dirty.
  const handleChange = (next: SrsDoc | VtpDoc) => {
    if (next.type === 'srs') { setSrsDoc(next); setDirtySrs(true); }
    else { setVtpDoc(next); setDirtyVtp(true); }
  };

  const persist = async (doc: SrsDoc | VtpDoc) => {
    if (supportsFileSystemAccess && hasOpenDirectory()) await saveDocument(doc);
    else saveFileFallback(serializeDocument(doc), `${doc.name}.${doc.type}.json`);
  };

  const dirty = dirtySrs || dirtyVtp;

  const save = async () => {
    try {
      if (dirtySrs && srsDoc) { await persist(srsDoc); setDirtySrs(false); }
      if (dirtyVtp && vtpDoc) { await persist(vtpDoc); setDirtyVtp(false); }
      setError(null);
    } catch (err: any) {
      setError(`Failed to save: ${err.message}`);
    }
  };

  // Keep the latest dirty/save for the global key + unload handlers (avoids a
  // stale closure when a second document becomes dirty without re-saving).
  const shortcutRef = useRef({ dirty, save });
  shortcutRef.current = { dirty, save };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!launch.demo && shortcutRef.current.dirty) void shortcutRef.current.save();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!launch.demo && shortcutRef.current.dirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenFallback = async () => {
    try {
      const file = await openFileFallback('.json');
      const data = JSON.parse(await file.text());
      if (file.name.endsWith('.srs.json')) { setSrsDoc(data); setCurrentView('srs'); }
      else if (file.name.endsWith('.vtp.json')) { setVtpDoc(data); setCurrentView('vtp'); }
      setIsDirectoryOpen(true);
      setDirtySrs(false);
      setDirtyVtp(false);
    } catch (err: any) {
      setError(`Failed to open file: ${err.message}`);
    }
  };

  const uniqueDocNames = Array.from(new Set(documents.map((d) => d.name))).sort();

  return (
    <div className="container-fluid">
      <MenuBar
        projectName={projectName}
        projectNames={uniqueDocNames}
        onSelectProject={handleSelectDocument}
        isDirectoryOpen={isDirectoryOpen}
        supportsFileSystemAccess={supportsFileSystemAccess}
        dirty={dirty}
        onSave={save}
        onNewDocument={handleNewDocument}
        onOpenDirectory={() => handleOpenProject(false)}
        onOpenProjectFile={() => handleOpenProject(true)}
        onOpenFallback={handleOpenFallback}
        job={job}
        onSetJob={handleSetJob}
        version={releases?.baseline ?? null}
        onShowVersions={() => setShowVersions(true)}
        demo={launch.demo}
      />

      {!supportsFileSystemAccess && !launch.demo && (
        <div className="alert alert-warning">
          Your browser doesn't support the File System Access API. Use Chrome or Edge for full editing.
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
          <button type="button" className="close" onClick={() => setError(null)} aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      )}

      {(srsDoc || vtpDoc) && (
        <ViewTabs
          current={currentView}
          enabled={{ srs: !!srsDoc, vtp: !!vtpDoc, testing: !!vtpDoc }}
          onSelect={setCurrentView}
        />
      )}

      {loading && <div className="alert alert-info">Loading...</div>}

      <div className="content">
        {/* key={selectedDocName} remounts the table when the open document changes,
            so each table re-seeds its working copy instead of editing the prior doc. */}
        {currentView === 'srs' && srsDoc && <SRSTable key={selectedDocName} doc={srsDoc} vtpDoc={vtpDoc} onChange={handleChange} baseline={srsBaseline} attribution={srsSnapshots.length ? srsAttribution : undefined} />}
        {currentView === 'vtp' && vtpDoc && <VTPTable key={selectedDocName} doc={vtpDoc} srsDoc={srsDoc} onChange={handleChange} redline={vtpRedline} attribution={vtpSnapshots.length ? vtpAttribution : undefined} />}
        {currentView === 'testing' && vtpDoc && <TestingView key={selectedDocName} doc={vtpDoc} onChange={handleChange} />}

        {!isDirectoryOpen && !loading && (
          <>
            {supportsFileSystemAccess && recent.length > 0 && (
              <div className="panel panel-default" style={{ marginBottom: 15 }}>
                <div className="panel-heading"><strong>Recent projects</strong></div>
                <ul className="list-group">
                  {recent.map((r) => (
                    <li key={r.id} className="list-group-item"
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>
                        <strong>{r.projectNames.join(', ') || r.dirName}</strong>
                        <span className="text-muted"> — {r.dir || r.dirName}</span>
                      </span>
                      <span>
                        <button className="btn btn-primary btn-xs" disabled={loading} onClick={() => openFromRecent(r)}>Open</button>
                        <button className="btn btn-link btn-xs" onClick={() => forgetRecent(r.id)}>Forget</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="alert alert-info">
              <h4>Welcome to SpecPad</h4>
              <p>Open the <code>docs/specpad/</code> folder in your repo to edit requirements and tests. Changes are written to disk for you to commit with git.</p>
            </div>
          </>
        )}
      </div>

      {isDirectoryOpen && (
        <StatusBar
          path={launch.demo ? 'demo (hosted copy of docs/specpad/)' : `docs/specpad/${projectName}`}
          srsDoc={srsDoc} vtpDoc={vtpDoc} projectDoc={projectDoc}
          demo={launch.demo}
        />
      )}

      {showVersions && <VersionHistoryDialog releases={releases} onClose={() => setShowVersions(false)} />}
    </div>
  );
};

export default LocalApp;
