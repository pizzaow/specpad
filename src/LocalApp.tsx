/**
 * LocalApp — SpecPad editor root.
 * Manages the open project (srs/vtp/proj), the active view, live validation,
 * and the ?name=&open= deep-link the generated launcher uses.
 */
import React, { useEffect, useState } from 'react';
import type { ProjectDoc, SrsDoc, VtpDoc } from './shared';
import {
  DocumentListItem,
  isFileSystemAccessSupported,
  openProjectDirectory,
  openProjectFile,
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
} from './localFileApi';
import SRSTable from './components/SRSTable';
import VTPTable from './components/VTPTable';
import TestingView from './components/TestingView';
import ValidationPanel from './components/ValidationPanel';

type ViewMode = 'srs' | 'vtp' | 'testing';

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

  const supportsFileSystemAccess = isFileSystemAccessSupported();

  // Deep-link support: ?open=srs|vtp|testing chooses the initial view.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const open = params.get('open');
    if (open === 'srs' || open === 'vtp' || open === 'testing') setCurrentView(open);
  }, []);

  const loadNamedDocs = async (name: string) => {
    const proj = documents.find((d) => d.name === name && d.type === 'proj');
    const srs = documents.find((d) => d.name === name && d.type === 'srs');
    const vtp = documents.find((d) => d.name === name && d.type === 'vtp');
    setProjectDoc(proj ? await loadProject(name) : null);
    setSrsDoc(srs ? await loadDocument('srs', name) : null);
    setVtpDoc(vtp ? await loadDocument('vtp', name) : null);
    setSelectedDocName(name);
  };

  const handleOpenProject = async (useProjectFile: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = useProjectFile ? await openProjectFile() : await openProjectDirectory();
      setProjectName(result.name);
      setDocuments(result.documents);
      setIsDirectoryOpen(true);
      const names = Array.from(new Set(result.documents.map((d) => d.name)));
      if (names.length === 1) await loadNamedDocsFrom(result.documents, names[0]);
      else { setSelectedDocName(''); setSrsDoc(null); setVtpDoc(null); setProjectDoc(null); }
    } catch (err: any) {
      setError(`Failed to open project: ${err.message}`);
      setIsDirectoryOpen(false);
    } finally {
      setLoading(false);
    }
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
  };

  const handleSelectDocument = async (name: string) => {
    if (!name || !hasOpenDirectory()) return;
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

  const handleSave = async (doc: SrsDoc | VtpDoc) => {
    try {
      if (supportsFileSystemAccess && hasOpenDirectory()) await saveDocument(doc);
      else saveFileFallback(serializeDocument(doc), `${doc.name}.${doc.type}.json`);
      if (doc.type === 'srs') setSrsDoc(doc); else setVtpDoc(doc);
      setError(null);
    } catch (err: any) {
      setError(`Failed to save document: ${err.message}`);
    }
  };

  const handleOpenFallback = async () => {
    try {
      const file = await openFileFallback('.json');
      const data = JSON.parse(await file.text());
      if (file.name.endsWith('.srs.json')) { setSrsDoc(data); setCurrentView('srs'); }
      else if (file.name.endsWith('.vtp.json')) { setVtpDoc(data); setCurrentView('vtp'); }
      setIsDirectoryOpen(true);
    } catch (err: any) {
      setError(`Failed to open file: ${err.message}`);
    }
  };

  const uniqueDocNames = Array.from(new Set(documents.map((d) => d.name))).sort();

  return (
    <div className="container-fluid">
      <header className="page-header">
        <h1>SpecPad{projectName && <span className="text-muted"> — {projectName}</span>}</h1>
        {!supportsFileSystemAccess && (
          <div className="alert alert-warning" style={{ marginTop: 10 }}>
            Your browser doesn't support the File System Access API. Use Chrome or Edge for full editing.
          </div>
        )}
      </header>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
          <button type="button" className="close" onClick={() => setError(null)} aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      )}

      <div className="toolbar" style={{ marginBottom: 20 }}>
        <div className="btn-group" role="group">
          {!isDirectoryOpen ? (
            supportsFileSystemAccess ? (
              <>
                <button className="btn btn-primary" disabled={loading} onClick={() => handleOpenProject(true)}>Open Project File (.proj.json)</button>
                <button className="btn btn-primary" style={{ marginLeft: 5 }} disabled={loading} onClick={() => handleOpenProject(false)}>Open Project Directory</button>
              </>
            ) : (
              <button className="btn btn-primary" disabled={loading} onClick={handleOpenFallback}>Open Document File</button>
            )
          ) : (
            <>
              <button className="btn btn-success" disabled={!supportsFileSystemAccess} onClick={handleNewDocument}>New Document</button>
              <button className="btn btn-default" style={{ marginLeft: 5 }} onClick={() => handleOpenProject(false)}>Change Directory</button>
              {uniqueDocNames.length > 0 && (
                <select className="form-control" style={{ display: 'inline-block', width: 'auto', marginLeft: 10 }}
                  value={selectedDocName} disabled={loading} onChange={(e) => handleSelectDocument(e.target.value)}>
                  <option value="">-- Select Document --</option>
                  {uniqueDocNames.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              )}
              {(srsDoc || vtpDoc) && (
                <div className="btn-group" style={{ marginLeft: 20 }}>
                  <button className={`btn ${currentView === 'srs' ? 'btn-info' : 'btn-default'}`} disabled={!srsDoc} onClick={() => setCurrentView('srs')}>SRS</button>
                  <button className={`btn ${currentView === 'vtp' ? 'btn-info' : 'btn-default'}`} disabled={!vtpDoc} onClick={() => setCurrentView('vtp')}>VTP</button>
                  <button className={`btn ${currentView === 'testing' ? 'btn-info' : 'btn-default'}`} disabled={!vtpDoc} onClick={() => setCurrentView('testing')}>Testing</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {loading && <div className="alert alert-info">Loading...</div>}

      {(srsDoc || vtpDoc || projectDoc) && (
        <ValidationPanel srsDoc={srsDoc} vtpDoc={vtpDoc} projectDoc={projectDoc} />
      )}

      <div className="content">
        {/* key={selectedDocName} remounts the table when the open document changes,
            so each table re-seeds its working copy instead of editing the prior doc. */}
        {currentView === 'srs' && srsDoc && <SRSTable key={selectedDocName} doc={srsDoc} vtpDoc={vtpDoc} onSave={handleSave} />}
        {currentView === 'vtp' && vtpDoc && <VTPTable key={selectedDocName} doc={vtpDoc} srsDoc={srsDoc} onSave={handleSave} />}
        {currentView === 'testing' && vtpDoc && <TestingView key={selectedDocName} doc={vtpDoc} onSave={handleSave} />}

        {!isDirectoryOpen && !loading && (
          <div className="alert alert-info">
            <h4>Welcome to SpecPad</h4>
            <p>Open the <code>docs/specpad/</code> folder in your repo to edit requirements and tests. Changes are written to disk for you to commit with git.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LocalApp;
