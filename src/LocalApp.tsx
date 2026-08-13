/**
 * LocalApp — SpecPad editor root.
 * Manages the open project (srs/vtp/proj), the active view, live validation, the
 * launcher deep-link (#name=&open=&dir=), and a recent-projects list backed by
 * persisted directory handles so return visits reopen without re-picking.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { ProjectDoc, SrsDoc, VtpDoc, PrdDoc, SddDoc, RiskDoc, SoupDoc, ThreatDoc, ReleasesDoc, JobDoc, JobsDoc, RunRecord } from './shared';
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
  loadPrd,
  loadSdd,
  loadRisk,
  loadSoup,
  loadThreat,
  loadRun,
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
  loadJobs,
  saveJobs,
  loadSnapshot,
  loadJobSnapshot,
  loadJobCommits,
  loadJobText,
  loadProjectText,
  saveProjectText,
  connectToSpecPadServer,
  openServerProject,
  isServerMode,
  serverStatus,
  serverCommit,
  serverDiscard,
  serverSubscribe,
  serverClaimPresence,
  serverReleasePresence,
  isProjectChoice,
  listServerProjects,
  switchServerProject,
} from './fileApi';
import type {
  ServerSession,
  ServerStatus,
  Presence,
  UpstreamMoved,
  ProjectSummary,
} from './fileApi';
import { activeJobIds, diffItems, REGISTER_TYPES } from './shared';
import type { DocDiff, SrsItem, VtpItem, PrdItem, SpecPadDoc, JobCommit } from './shared';
import { buildRedline, computeAttribution } from './changeTracking';
import type { SnapshotInput } from './changeTracking';
import { cachedReleases } from './changeTrackingView';
import { mdSectionDiff } from './archDiff';
import type { MdFileDiff } from './archDiff';
import MenuBar from './components/MenuBar';
import VersionHistoryDialog from './components/VersionHistoryDialog';
import ServerBar from './components/ServerBar';
import CommitDialog from './components/CommitDialog';
import * as recentStore from './handleStore';
import type { RecentProject } from './handleStore';
import { parseLaunchParams } from './launchParams';

// Presence claims expire server-side after 45s; refresh well inside that (CE-4).
const PRESENCE_HEARTBEAT_MS = 20_000;
import SRSTable from './components/SRSTable';
import VTPTable from './components/VTPTable';
import TestingView from './components/TestingView';
import JobsView from './components/JobsView';
import ArchitectureView from './components/ArchitectureView';
import DetailedDesignView from './components/DetailedDesignView';
import RiskTable from './components/RiskTable';
import SoupTable from './components/SoupTable';
import ThreatTable from './components/ThreatTable';
import SecurityView from './components/SecurityView';
import ReleasesView from './components/ReleasesView';
import AuditView from './components/AuditView';
import TraceabilityView from './components/TraceabilityView';
import PrdTable from './components/PrdTable';
import OverviewView from './components/OverviewView';
import { readStoredTheme, applyTheme } from './theme';
import type { ThemeId } from './theme';
import StatusBar from './components/StatusBar';
import ViewTabs from './components/ViewTabs';

type ViewMode = 'overview' | 'prd' | 'srs' | 'vtp' | 'testing' | 'jobs' | 'arch' | 'sdd' | 'risk' | 'soup' | 'threat' | 'sec' | 'releases' | 'audit' | 'trace';
type OpenResult = { name: string; documents: DocumentListItem[] };
// Items of any id-keyed register document (srs/vtp/prd/…); a per-job diff is keyed by doc type,
// so newly-registered register types are diffed without changing this code.
type RegisterItem = SrsItem | VtpItem | PrdItem;
type JobDiff = Record<string, DocDiff<RegisterItem>>;
const itemsOf = (doc: SpecPadDoc): RegisterItem[] => (doc as { items?: RegisterItem[] }).items ?? [];
export type ArchChange = {
  added: string[];
  removed: string[];
  modified: string[];
  mdDiffs?: MdFileDiff[]; // section-level diffs for each modified markdown file
};

// For a closed job, compute which architecture files it added/modified/removed
// (coarse, file-level) plus a section-level diff for each modified markdown file.
async function loadJobArch(jobId: string): Promise<ArchChange | undefined> {
  const before: string[] = JSON.parse((await loadJobText(jobId, 'before', 'arch-files.json')) ?? '[]');
  const after: string[] = JSON.parse((await loadJobText(jobId, 'after', 'arch-files.json')) ?? '[]');
  const bSet = new Set(before), aSet = new Set(after);
  const added = after.filter((f) => !bSet.has(f));
  const removed = before.filter((f) => !aSet.has(f));
  const modified: string[] = [];
  const mdDiffs: MdFileDiff[] = [];
  for (const f of after.filter((x) => bSet.has(x))) {
    const [b, a] = await Promise.all([loadJobText(jobId, 'before', f), loadJobText(jobId, 'after', f)]);
    if (b !== a) {
      modified.push(f);
      if (f.endsWith('.md') && b != null && a != null) {
        const sections = mdSectionDiff(b, a);
        if (sections.length) mdDiffs.push({ file: f, sections });
      }
    }
  }
  if (added.length || removed.length || modified.length) return { added, removed, modified, mdDiffs: mdDiffs.length ? mdDiffs : undefined };
  return undefined;
}

// For each CLOSED job, diff its committed before/after spec snapshots and load its
// commit list, so the browser editor can show the job's SRS/VTP changes and the code
// commits behind them (the cache is frozen on close).
async function loadJobCaches(
  name: string,
  jd: JobsDoc | null,
): Promise<{ diffs: Record<string, JobDiff>; commits: Record<string, JobCommit[]>; arch: Record<string, ArchChange>; runs: Record<string, RunRecord> }> {
  const diffs: Record<string, JobDiff> = {};
  const commits: Record<string, JobCommit[]> = {};
  const arch: Record<string, ArchChange> = {};
  const runs: Record<string, RunRecord> = {};
  // Load every closed job's cache in parallel — on the network-backed demo this is the
  // bulk of the load, and sequential per-job fetching made it tens of seconds. Writes are
  // keyed by job id, so the parallel branches never collide.
  await Promise.all((jd?.jobs ?? []).filter((j) => j.status === 'closed').map(async (j) => {
    // Diff every register document type the job cached (srs/vtp/prd/…) — new types flow in here.
    const entry: JobDiff = {};
    await Promise.all(REGISTER_TYPES.map(async (dt) => {
      const [b, a] = await Promise.all([
        loadJobSnapshot(j.id, 'before', dt.type, name),
        loadJobSnapshot(j.id, 'after', dt.type, name),
      ]);
      if (b && a) entry[dt.type] = diffItems<RegisterItem>(itemsOf(b), itemsOf(a));
    }));
    const [cs, ac, runText] = await Promise.all([loadJobCommits(j.id), loadJobArch(j.id), loadJobText(j.id, 'after', `${name}.run.json`)]);
    if (Object.keys(entry).length) diffs[j.id] = entry;
    if (cs.length) commits[j.id] = cs;
    if (ac) arch[j.id] = ac;
    if (runText) { try { runs[j.id] = JSON.parse(runText) as RunRecord; } catch { /* ignore malformed */ } }
  }));
  return { diffs, commits, arch, runs };
}

// Every prose document declares its diagrams via ![alt](name.svg); load exactly those
// referenced files so each view can render them inline at their place. All prose sources
// are scanned together — the security views carry figures the architecture never mentions,
// and scanning only the arc42 text left those unresolved (JOB-55).
export async function loadDiagrams(...sources: (string | null | undefined)[]): Promise<Record<string, string>> {
  const refs = new Set<string>();
  for (const src of sources) {
    if (!src) continue;
    for (const m of src.matchAll(/!\[[^\]]*\]\(([^)]+\.svg)\)/g)) refs.add(m[1]);
  }
  const out: Record<string, string> = {};
  for (const ref of refs) {
    const svg = await loadProjectText(ref);
    if (svg) out[ref] = svg;
  }
  return out;
}

const LocalApp: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [projectDoc, setProjectDoc] = useState<ProjectDoc | null>(null);
  const [srsDoc, setSrsDoc] = useState<SrsDoc | null>(null);
  const [vtpDoc, setVtpDoc] = useState<VtpDoc | null>(null);
  const [prdDoc, setPrdDoc] = useState<PrdDoc | null>(null);
  // The detailed design: loaded so its governance runs live, and so the design a
  // requirement points at can be resolved for display (JOB-44).
  const [sddDoc, setSddDoc] = useState<SddDoc | null>(null);
  const [riskDoc, setRiskDoc] = useState<RiskDoc | null>(null);
  const [soupDoc, setSoupDoc] = useState<SoupDoc | null>(null);
  const [threatDoc, setThreatDoc] = useState<ThreatDoc | null>(null);
  const [sec, setSec] = useState<string | null>(null);
  const [prdBaseline, setPrdBaseline] = useState<PrdDoc | null>(null);
  const [runRecord, setRunRecord] = useState<RunRecord | null>(null);
  const [dirtyPrd, setDirtyPrd] = useState(false);
  const [dirtySdd, setDirtySdd] = useState(false);
  const [dirtyRisk, setDirtyRisk] = useState(false);
  const [dirtySoup, setDirtySoup] = useState(false);
  const [dirtyThreat, setDirtyThreat] = useState(false);
  const [dirtySec, setDirtySec] = useState(false);
  const [currentView, setCurrentView] = useState<ViewMode>('overview');
  const [theme, setTheme] = useState<ThemeId>(readStoredTheme);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocName, setSelectedDocName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(false);
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [launch] = useState(parseLaunchParams);
  const [releases, setReleases] = useState<ReleasesDoc | null>(null);
  const [job, setJob] = useState<JobDoc | null>(null);
  const [jobsDoc, setJobsDoc] = useState<JobsDoc | null>(null);
  const [dirtyJobs, setDirtyJobs] = useState(false);
  // Per closed-job SRS/VTP diffs + commit lists, from the committed .specpad/jobs/<id>/ cache.
  const [jobDiffs, setJobDiffs] = useState<Record<string, { srs?: DocDiff<SrsItem | VtpItem>; vtp?: DocDiff<SrsItem | VtpItem> }>>({});
  const [jobCommits, setJobCommits] = useState<Record<string, JobCommit[]>>({});
  const [jobArch, setJobArch] = useState<Record<string, ArchChange>>({});
  const [jobRuns, setJobRuns] = useState<Record<string, RunRecord>>({});
  // Cached `before` snapshots for active OPEN jobs (jobId → docType → snapshot), diffed below.
  const [activeBefore, setActiveBefore] = useState<Record<string, Record<string, SpecPadDoc>>>({});
  // Cached `before` architecture (file list + contents) for active OPEN jobs, for the in-progress arch diff.
  const [activeBeforeArch, setActiveBeforeArch] = useState<Record<string, { files: string[]; contents: Record<string, string> }>>({});
  // Architecture spec: arc42 markdown + the C4 Structurizr DSL (both optional, tracked text files).
  const [sad, setSad] = useState<string | null>(null);
  const [dsl, setDsl] = useState<string | null>(null);
  const [sadGuide, setSadGuide] = useState<string | null>(null);
  const [diagrams, setDiagrams] = useState<Record<string, string>>({});
  const [dirtySad, setDirtySad] = useState(false);
  const [dirtyDsl, setDirtyDsl] = useState(false);
  const [srsBaseline, setSrsBaseline] = useState<SrsDoc | null>(null);
  const [vtpBaseline, setVtpBaseline] = useState<VtpDoc | null>(null);
  const [srsSnapshots, setSrsSnapshots] = useState<SnapshotInput[]>([]);
  const [vtpSnapshots, setVtpSnapshots] = useState<SnapshotInput[]>([]);
  const [prdSnapshots, setPrdSnapshots] = useState<SnapshotInput[]>([]);
  const [dirtySrs, setDirtySrs] = useState(false);
  const [dirtyVtp, setDirtyVtp] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  // Server (remote) mode: the project lives in a clone the server owns (EDR-2).
  const [serverSession, setServerSession] = useState<ServerSession | null>(null);
  // A multi-project server reached without a project named in the URL (MPT-9).
  const [projectChoice, setProjectChoice] = useState<ProjectSummary[] | null>(null);
  // Every project this user may open on this server, for the switcher (MPT-11).
  const [serverProjects, setServerProjects] = useState<ProjectSummary[]>([]);
  const [serverState, setServerState] = useState<ServerStatus | null>(null);
  const [showCommit, setShowCommit] = useState(false);
  // Advisory presence and the upstream-moved signal (CE-3). Neither affects editing.
  const [presence, setPresence] = useState<Presence[]>([]);
  const [upstream, setUpstream] = useState<UpstreamMoved | null>(null);
  const editingItemRef = useRef<{ doc: string | null; itemId: string | null }>({
    doc: null,
    itemId: null,
  });

  const supportsFileSystemAccess = isFileSystemAccessSupported();

  /**
   * Announce which row this user has open, so others see it before they duplicate the
   * work. Entirely advisory: a failure here is swallowed and changes nothing (CE-4).
   */
  const announceEditing = (itemId: string | null) => {
    const doc = selectedDocName || projectName;
    const where = { doc: doc ? `${doc}.${currentView === 'vtp' ? 'vtp' : 'srs'}.json` : null, itemId };
    editingItemRef.current = where;
    void serverClaimPresence(where.doc, itemId);
  };

  /** Refresh the pending-change set behind the Commit badge. Never fatal. */
  const refreshServerStatus = async () => {
    if (!isServerMode()) return;
    try {
      setServerState(await serverStatus());
    } catch {
      /* the badge is informational — a failed refresh must not break editing */
    }
  };

  const vtpRedline = React.useMemo(
    () => (vtpDoc ? buildRedline(vtpBaseline, vtpDoc) : undefined),
    [vtpBaseline, vtpDoc],
  );
  const srsAttribution = React.useMemo(() => computeAttribution(srsSnapshots), [srsSnapshots]);
  const vtpAttribution = React.useMemo(() => computeAttribution(vtpSnapshots), [vtpSnapshots]);
  const prdAttribution = React.useMemo(() => computeAttribution(prdSnapshots), [prdSnapshots]);

  // Live in-progress diff for each active open job: its `before` snapshot vs the working copy,
  // per register document type (srs/vtp/prd/…) — new types are picked up automatically.
  const activeDiffs = React.useMemo(() => {
    const working: Record<string, SpecPadDoc | null> = { srs: srsDoc, vtp: vtpDoc, prd: prdDoc, sdd: sddDoc, risk: riskDoc, soup: soupDoc, threat: threatDoc };
    const out: Record<string, JobDiff> = {};
    for (const [id, before] of Object.entries(activeBefore)) {
      const entry: JobDiff = {};
      for (const [t, beforeDoc] of Object.entries(before)) {
        const w = working[t];
        if (w) entry[t] = diffItems<RegisterItem>(itemsOf(beforeDoc), itemsOf(w));
      }
      if (Object.keys(entry).length) out[id] = entry;
    }
    return out;
  }, [activeBefore, srsDoc, vtpDoc, prdDoc, sddDoc, riskDoc, soupDoc, threatDoc]);

  // Live in-progress architecture diff for active open jobs: before arch snapshot vs the working SAD/diagrams.
  const activeArch = React.useMemo(() => {
    const out: Record<string, ArchChange> = {};
    const name = selectedDocName || projectName;
    for (const [id, before] of Object.entries(activeBeforeArch)) {
      const working: Record<string, string> = {};
      if (sad != null) working[`${name}.sad.md`] = sad;
      if (sadGuide != null) working[`${name}.sad.guide.md`] = sadGuide;
      if (dsl != null) working[`${name}.workspace.dsl`] = dsl;
      // The security architecture is prose tracked the same way: its figures already
      // reach the working set through the diagram map, so omitting the document itself
      // reported the figures as added while never showing what the text said (JOB-51).
      if (sec != null) working[`${name}.sec.md`] = sec;
      for (const [k, v] of Object.entries(diagrams)) working[k] = v;
      const after = Object.keys(working);
      const bSet = new Set(before.files), aSet = new Set(after);
      const added = after.filter((f) => !bSet.has(f));
      const removed = before.files.filter((f) => !aSet.has(f));
      const modified: string[] = [];
      const mdDiffs: MdFileDiff[] = [];
      for (const f of after.filter((x) => bSet.has(x))) {
        const b = before.contents[f];
        const a = working[f];
        if (b !== a) {
          modified.push(f);
          if (f.endsWith('.md') && b != null && a != null) {
            const sections = mdSectionDiff(b, a);
            if (sections.length) mdDiffs.push({ file: f, sections });
          }
        }
      }
      if (added.length || removed.length || modified.length) out[id] = { added, removed, modified, mdDiffs: mdDiffs.length ? mdDiffs : undefined };
    }
    return out;
  }, [activeBeforeArch, sad, sadGuide, dsl, sec, diagrams, selectedDocName, projectName]);

  // Set the active jobs (one or many). Writes the canonical `jobs` array form;
  // `title` is only kept for a single free-text job with no register.
  const handleSetTheme = (id: ThemeId) => {
    setTheme(id);
    applyTheme(id);
  };

  const handleSetJob = async (ids: string[], title?: string) => {
    const name = selectedDocName || projectName;
    const doc: JobDoc = {
      schemaVersion: '1.0',
      type: 'job',
      jobs: ids,
      ...(title && ids.length === 1 ? { title } : {}),
    };
    try {
      await saveJob(name, doc);
      setJob(doc);
      setError(null);
    } catch (err: any) {
      setError(`Failed to set job: ${err.message}`);
    }
  };

  // Jobs register edits are buffered like the spec docs: changing it marks dirty,
  // and `save` writes <name>.jobs.json.
  const handleJobsChange = (next: JobsDoc) => {
    setJobsDoc(next);
    setDirtyJobs(true);
  };

  // Load the change-tracking cache for a project: manifest, job marker, and the
  // cached snapshots (oldest→newest) used for redline (baseline) and attribution.
  const loadChangeTracking = async (name: string) => {
    const rel = await loadReleases(name);
    setReleases(rel);
    const jm = await loadJob(name);
    setJob(jm);
    const jd = await loadJobs(name);
    setJobsDoc(jd);
    setDirtyJobs(false);
    // Load the verification run early — before the per-job cache storm below — so the
    // run-derived Results/Overview/Traceability roll-ups populate fast on the (network)
    // demo instead of waiting on hundreds of sequential per-job snapshot fetches.
    setRunRecord(await loadRun(name));
    const caches = await loadJobCaches(name, jd);
    setJobDiffs(caches.diffs);
    setJobCommits(caches.commits);
    setJobArch(caches.arch);
    setJobRuns(caches.runs);
    // Active open jobs: load each one's `before` snapshot so its in-progress changes
    // (before vs the working copy) can be shown without git or closing the job.
    const before: Record<string, Record<string, SpecPadDoc>> = {};
    const beforeArch: Record<string, { files: string[]; contents: Record<string, string> }> = {};
    for (const id of activeJobIds(jm)) {
      const rec = jd?.jobs.find((j) => j.id === id);
      if (!rec || rec.status !== 'open') continue;
      // Every register doc type's `before` snapshot, so each shows its in-progress diff.
      const entry: Record<string, SpecPadDoc> = {};
      for (const dt of REGISTER_TYPES) {
        const b = await loadJobSnapshot(id, 'before', dt.type, name);
        if (b) entry[dt.type] = b;
      }
      if (Object.keys(entry).length) before[id] = entry;
      // Architecture: only when the before snapshot carries an arch-files manifest, so a job
      // created before the full-doc-set snapshot existed shows no spurious "added" files.
      const manifest = await loadJobText(id, 'before', 'arch-files.json');
      if (manifest) {
        const files: string[] = JSON.parse(manifest);
        const contents: Record<string, string> = {};
        for (const f of files) {
          const c = await loadJobText(id, 'before', f);
          if (c != null) contents[f] = c;
        }
        beforeArch[id] = { files, contents };
      }
    }
    setActiveBefore(before);
    setActiveBeforeArch(beforeArch);
    const sadText = await loadProjectText(`${name}.sad.md`);
    setSad(sadText);
    setDsl(await loadProjectText(`${name}.workspace.dsl`));
    setSadGuide(await loadProjectText(`${name}.sad.guide.md`));
    const secText = await loadProjectText(`${name}.sec.md`);
    setSec(secText);
    setDiagrams(await loadDiagrams(sadText, secText));
    setDirtySad(false);
    setDirtyDsl(false);
    const cached = cachedReleases(rel);
    const srsSnaps: SnapshotInput[] = [];
    const vtpSnaps: SnapshotInput[] = [];
    const prdSnaps: SnapshotInput[] = [];
    let srsBase: SrsDoc | null = null;
    let vtpBase: VtpDoc | null = null;
    let prdBase: PrdDoc | null = null;
    for (const c of cached) {
      const s = (await loadSnapshot(c.location, 'srs', name)) as SrsDoc | null;
      const v = (await loadSnapshot(c.location, 'vtp', name)) as VtpDoc | null;
      const p = (await loadSnapshot(c.location, 'prd', name)) as PrdDoc | null;
      if (s) srsSnaps.push({ version: c.version, author: c.author, doc: s });
      if (v) vtpSnaps.push({ version: c.version, author: c.author, doc: v });
      if (p) prdSnaps.push({ version: c.version, author: c.author, doc: p });
      if (c.location === 'baseline') {
        srsBase = s; vtpBase = v; prdBase = p;
      }
    }
    setSrsSnapshots(srsSnaps);
    setVtpSnapshots(vtpSnaps);
    setPrdSnapshots(prdSnaps);
    setPrdBaseline(prdBase);
    setSrsBaseline(srsBase);
    setVtpBaseline(vtpBase);
  };

  const loadNamedDocs = async (name: string) => {
    const proj = documents.find((d) => d.name === name && d.type === 'proj');
    const srs = documents.find((d) => d.name === name && d.type === 'srs');
    const vtp = documents.find((d) => d.name === name && d.type === 'vtp');
    const prd = documents.find((d) => d.name === name && d.type === 'prd');
    const sdd = documents.find((d) => d.name === name && d.type === 'sdd');
    const rsk = documents.find((d) => d.name === name && d.type === 'risk');
    const spu = documents.find((d) => d.name === name && d.type === 'soup');
    const thr = documents.find((d) => d.name === name && d.type === 'threat');
    setProjectDoc(proj ? await loadProject(name) : null);
    setSrsDoc(srs ? await loadDocument('srs', name) : null);
    setVtpDoc(vtp ? await loadDocument('vtp', name) : null);
    setPrdDoc(prd ? await loadPrd(name) : null);
    setSddDoc(sdd ? await loadSdd(name) : null);
    setRiskDoc(rsk ? await loadRisk(name) : null);
    setSoupDoc(spu ? await loadSoup(name) : null);
    setThreatDoc(thr ? await loadThreat(name) : null);
    setSelectedDocName(name);
    await loadChangeTracking(name);
    setDirtySrs(false);
    setDirtyVtp(false);
    setDirtyPrd(false);
    setDirtySdd(false);
    setDirtyRisk(false);
    setDirtySoup(false);
    setDirtyThreat(false);
    setDirtySec(false);
  };

  // Variant used right after open(), before `documents` state has settled.
  const loadNamedDocsFrom = async (docs: DocumentListItem[], name: string) => {
    const proj = docs.find((d) => d.name === name && d.type === 'proj');
    const srs = docs.find((d) => d.name === name && d.type === 'srs');
    const vtp = docs.find((d) => d.name === name && d.type === 'vtp');
    const prd = docs.find((d) => d.name === name && d.type === 'prd');
    const sdd = docs.find((d) => d.name === name && d.type === 'sdd');
    const rsk = docs.find((d) => d.name === name && d.type === 'risk');
    const spu = docs.find((d) => d.name === name && d.type === 'soup');
    const thr = docs.find((d) => d.name === name && d.type === 'threat');
    setProjectDoc(proj ? await loadProject(name) : null);
    setSrsDoc(srs ? await loadDocument('srs', name) : null);
    setVtpDoc(vtp ? await loadDocument('vtp', name) : null);
    setPrdDoc(prd ? await loadPrd(name) : null);
    setSddDoc(sdd ? await loadSdd(name) : null);
    setRiskDoc(rsk ? await loadRisk(name) : null);
    setSoupDoc(spu ? await loadSoup(name) : null);
    setThreatDoc(thr ? await loadThreat(name) : null);
    setSelectedDocName(name);
    await loadChangeTracking(name);
    setDirtySrs(false);
    setDirtyVtp(false);
    setDirtyPrd(false);
    setDirtySdd(false);
    setDirtyRisk(false);
    setDirtySoup(false);
    setDirtyThreat(false);
    setDirtySec(false);
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
      setPrdDoc(null);
      setSddDoc(null);
      setRiskDoc(null);
      setSoupDoc(null);
      setThreatDoc(null);
      setSec(null);
      setPrdBaseline(null);
      setRunRecord(null);
      setDirtyPrd(false);
      setProjectDoc(null);
      setReleases(null);
      setJob(null);
      setJobsDoc(null);
      setDirtyJobs(false);
      setJobDiffs({});
      setJobCommits({});
      setJobArch({});
      setJobRuns({});
      setActiveBefore({});
      setActiveBeforeArch({});
      setSad(null);
      setDsl(null);
      setSadGuide(null);
      setDiagrams({});
      setDirtySad(false);
      setDirtyDsl(false);
      setSrsBaseline(null);
      setVtpBaseline(null);
      setSrsSnapshots([]);
      setVtpSnapshots([]);
      setPrdSnapshots([]);
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

  /**
   * Open another project on the same server (MPT-11, MPT-12).
   *
   * Everything the editor holds — documents, baselines, job caches, presence — belongs
   * to the project it was loaded from, so this reloads through the same path the first
   * open takes rather than patching state in place. The URL is rewritten to name the
   * new project so a reload comes back here, not to where the session started.
   */
  const handleSwitchProject = async (projectId: string) => {
    if (projectId === serverSession?.projectId) return;
    setLoading(true);
    setError(null);
    try {
      const session = await switchServerProject(projectId);
      if (!session) {
        setError('Could not open that project. You are still in the current one.');
        return;
      }
      setProjectChoice(null);
      setServerSession(session);
      setPresence([]);
      setUpstream(null);
      await applyOpened(await openServerProject(), launch.name);
      await refreshServerStatus();
      const url = new URL(window.location.href);
      url.searchParams.set('project', projectId);
      window.history.replaceState(null, '', url.toString());
    } catch (err: any) {
      setError(`Could not open that project: ${err.message}`);
    } finally {
      setLoading(false);
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

  // On load: pick the initial view, then work out how this session reaches its files —
  // a SpecPad server serving this page, the hosted demo, or local files (EDR-1).
  useEffect(() => {
    if (launch.open) setCurrentView(launch.open);
    let cancelled = false;

    void (async () => {
      // 1. Is a SpecPad server serving this page? If so it owns the project: there is
      //    no folder to pick, and the signed-in identity comes from the server (EDR-2).
      //    Which project it owns comes from the URL when the server hosts several (MPT-9).
      const session = await connectToSpecPadServer(launch.project);
      if (cancelled) return;
      // A server hosting several projects, reached without one named: ask, rather than
      // opening an arbitrary project or falling back to the local folder picker.
      if (isProjectChoice(session)) {
        setProjectChoice(session.chooseProject);
        setIsDirectoryOpen(false);
        return;
      }
      if (session) {
        setServerSession(session);
        // What else may this person open? Advisory: a failure here costs the switcher,
        // never the session (MPT-11).
        void listServerProjects().then((ps) => {
          if (!cancelled) setServerProjects(ps);
        });
        setLoading(true);
        try {
          const result = await openServerProject();
          if (!cancelled) {
            await applyOpened(result, launch.name);
            await refreshServerStatus();
          }
        } catch (err: any) {
          if (!cancelled) {
            setIsDirectoryOpen(false);
            setError(`Could not open the project on the server: ${err.message}`);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      // 2. The read-only hosted demo.
      if (launch.demo) {
        setLoading(true);
        try {
          enableDemoMode(import.meta.env.VITE_DEMO_BASE || '/demo/');
          const result = await openDemoProject();
          if (!cancelled) await applyOpened(result, launch.name);
        } catch (err) {
          if (!cancelled) disableDemoMode();
          console.error('Demo load failed:', err);
          if (!cancelled) {
            setIsDirectoryOpen(false);
            setError('Could not load the demo project — please try again later.');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      // 3. Local files: list recent projects and silently reopen one still permitted.
      if (!supportsFileSystemAccess || !recentStore.isSupported()) return;
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

  // Presence and the upstream-moved signal, while connected to a server (CE-3).
  // Everything here is a courtesy: if the stream never connects, the editor simply
  // says less, and editing, committing, and merging are unaffected (CE-4).
  useEffect(() => {
    if (!serverSession) return;
    const me = serverSession.principal.id;

    const unsubscribe = serverSubscribe({
      onHello: (info) => setPresence(info.presence ?? []),
      onPresence: (list) => setPresence(list.filter((p) => p.userId !== me)),
      onUpstream: (moved) => setUpstream(moved),
    });

    // Refresh the claim so it does not expire while someone is still typing.
    const beat = window.setInterval(() => {
      const { doc, itemId } = editingItemRef.current;
      if (itemId) void serverClaimPresence(doc, itemId);
    }, PRESENCE_HEARTBEAT_MS);

    return () => {
      unsubscribe();
      window.clearInterval(beat);
      void serverReleasePresence();
    };
  }, [serverSession]);

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
    const title = prompt('Document title:', 'Software Requirements');
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
  const handlePrdChange = (next: PrdDoc) => { setPrdDoc(next); setDirtyPrd(true); };
  const handleSddChange = (next: SddDoc) => { setSddDoc(next); setDirtySdd(true); };
  const handleRiskChange = (next: RiskDoc) => { setRiskDoc(next); setDirtyRisk(true); };
  const handleSoupChange = (next: SoupDoc) => { setSoupDoc(next); setDirtySoup(true); };
  const handleThreatChange = (next: ThreatDoc) => { setThreatDoc(next); setDirtyThreat(true); };

  /**
   * May this session edit? One answer, used by every view (EDR-3).
   *
   * A server role that cannot write is the only thing that makes the editor read-only.
   * The demo is deliberately NOT read-only: it is a sandbox whose edits live in memory
   * and are offered as a download rather than written anywhere.
   */
  const sessionReadOnly = !!serverSession && !serverSession.capabilities.write;

  const persist = async (doc: SrsDoc | VtpDoc | PrdDoc | SddDoc | RiskDoc | SoupDoc | ThreatDoc) => {
    // The demo has nowhere to write: hand the document back as a file instead, so the
    // sandbox has an exit and an edit is never silently lost.
    if (launch.demo) {
      saveFileFallback(serializeDocument(doc), `${doc.name}.${doc.type}.json`);
      return;
    }
    // Server mode writes over HTTP, so it needs no File System Access support — without
    // this a Firefox user on a server would silently get a download instead of a save.
    if (isServerMode() || (supportsFileSystemAccess && hasOpenDirectory())) await saveDocument(doc);
    else saveFileFallback(serializeDocument(doc), `${doc.name}.${doc.type}.json`);
  };

  const dirty = dirtySrs || dirtyVtp || dirtyPrd || dirtySdd || dirtyRisk || dirtySoup || dirtyThreat || dirtySec || dirtyJobs || dirtySad || dirtyDsl;

  // ---- Presence, resolved for display (CE-3) ----

  const currentDocFilename = `${selectedDocName || projectName}.${currentView === 'vtp' ? 'vtp' : 'srs'}.json`;

  /** Others editing a row of the document on screen, keyed by item id. */
  const presenceByItem = React.useMemo(() => {
    const byItem = new Map<string, string[]>();
    for (const person of presence) {
      if (!person.itemId) continue;
      if (person.doc && person.doc !== currentDocFilename) continue;
      byItem.set(person.itemId, [...(byItem.get(person.itemId) ?? []), person.displayName]);
    }
    return byItem;
  }, [presence, currentDocFilename]);

  /** Name each person's location the way a human would: by code, not by stable id. */
  const presenceLabels = React.useMemo(() => {
    const codeById = new Map<string, string>();
    for (const doc of [srsDoc, vtpDoc, prdDoc]) {
      for (const item of doc?.items ?? []) {
        if (item.code) codeById.set(item.id, item.code);
      }
    }
    return presence.map((person) => ({
      userId: person.userId,
      displayName: person.displayName,
      where: person.itemId ? (codeById.get(person.itemId) ?? person.itemId) : null,
    }));
  }, [presence, srsDoc, vtpDoc, prdDoc]);

  const save = async () => {
    const name = selectedDocName || projectName;
    try {
      if (dirtySrs && srsDoc) { await persist(srsDoc); setDirtySrs(false); }
      if (dirtyVtp && vtpDoc) { await persist(vtpDoc); setDirtyVtp(false); }
      if (dirtyPrd && prdDoc) { await persist(prdDoc); setDirtyPrd(false); }
      if (dirtySdd && sddDoc) { await persist(sddDoc); setDirtySdd(false); }
      if (dirtyRisk && riskDoc) { await persist(riskDoc); setDirtyRisk(false); }
      if (dirtySoup && soupDoc) { await persist(soupDoc); setDirtySoup(false); }
      if (dirtyThreat && threatDoc) { await persist(threatDoc); setDirtyThreat(false); }
      if (dirtySec && sec !== null) { await saveProjectText(`${selectedDocName || projectName}.sec.md`, sec); setDirtySec(false); }
      if (dirtyJobs && jobsDoc) { await saveJobs(name, jobsDoc); setDirtyJobs(false); }
      if (dirtySad && sad !== null) { await saveProjectText(`${name}.sad.md`, sad); setDirtySad(false); }
      if (dirtyDsl && dsl !== null) { await saveProjectText(`${name}.workspace.dsl`, dsl); setDirtyDsl(false); }
      setError(null);
      // In server mode a save lands in this user's working copy, uncommitted (CMT-2),
      // so the pending-change badge has to catch up.
      await refreshServerStatus();
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
        if (shortcutRef.current.dirty) void shortcutRef.current.save();
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
  const activeIds = activeJobIds(job);
  const labelFor = (id: string) => {
    const rec = jobsDoc?.jobs.find((j) => j.id === id);
    return rec ? (rec.code ?? rec.title) : id;
  };
  const activeJobLabel = activeIds.length
    ? activeIds.length <= 2
      ? activeIds.map(labelFor).join(', ')
      : `${labelFor(activeIds[0])} +${activeIds.length - 1}`
    : null;

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
        jobs={jobsDoc?.jobs}
        activeIds={activeIds}
        activeJobLabel={activeJobLabel}
        onSetJob={handleSetJob}
        version={releases?.baseline ?? null}
        onShowVersions={() => setShowVersions(true)}
        theme={theme}
        onSetTheme={handleSetTheme}
        demo={launch.demo}
      />

      {serverSession && (
        <ServerBar
          session={serverSession}
          status={serverState}
          presence={presenceLabels}
          projects={serverProjects}
          onSelectProject={handleSwitchProject}
          onCommit={() => setShowCommit(true)}
        />
      )}

      {upstream && (
        <div className="alert alert-info" role="status">
          <strong>{upstream.branch}</strong> has moved since you opened this — someone else
          published a change. Your own edits are safe and will be merged when you commit.
          <button
            type="button"
            className="btn btn-default btn-xs"
            style={{ marginLeft: 10 }}
            onClick={async () => {
              setUpstream(null);
              if (dirty && !window.confirm('You have unsaved changes that will be lost. Reload anyway?')) return;
              await applyOpened(await openServerProject(), projectName);
              await refreshServerStatus();
            }}
          >
            Reload
          </button>
          <button
            type="button"
            className="close"
            onClick={() => setUpstream(null)}
            aria-label="Dismiss"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
      )}

      {projectChoice && (
        <div className="alert alert-info" role="status">
          <strong>Choose a project.</strong> This SpecPad server hosts several; open the one you want:
          <ul className="mb-0 mt-2 project-choice">
            {projectChoice.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="btn btn-link"
                  style={{ padding: 0 }}
                  onClick={() => handleSwitchProject(p.id)}
                >
                  {p.title}
                </button>{' '}
                <span className="text-muted">
                  ({p.branch} — you are a {p.role})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!supportsFileSystemAccess && !launch.demo && !serverSession && !projectChoice && (
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

      {isDirectoryOpen && (
        <ViewTabs
          current={currentView}
          enabled={{ overview: true, prd: !!prdDoc, srs: !!srsDoc, vtp: !!vtpDoc, testing: !!vtpDoc, jobs: !launch.demo || !!jobsDoc, arch: !!(sad || dsl), sdd: !!sddDoc, risk: !!riskDoc, soup: !!soupDoc, threat: !!threatDoc, sec: sec !== null, releases: !!releases, audit: !!srsDoc, trace: !!srsDoc }}
          onSelect={setCurrentView}
        />
      )}

      {loading && <div className="alert alert-info">Loading...</div>}

      <div className="content">
        {/* key={selectedDocName} remounts the table when the open document changes,
            so each table re-seeds its working copy instead of editing the prior doc. */}
        {currentView === 'overview' && isDirectoryOpen && (
          <OverviewView
            projectName={selectedDocName || projectName}
            prd={prdDoc} srs={srsDoc} vtp={vtpDoc} run={runRecord}
            releases={releases} jobs={jobsDoc?.jobs ?? []}
            onNavigate={setCurrentView}
          />
        )}
        {currentView === 'prd' && prdDoc && <PrdTable key={selectedDocName} doc={prdDoc} srs={srsDoc} onChange={handlePrdChange} baseline={prdBaseline} attribution={prdSnapshots.length ? prdAttribution : undefined} readOnly={sessionReadOnly} />}
        {currentView === 'srs' && srsDoc && <SRSTable key={selectedDocName} doc={srsDoc} vtpDoc={vtpDoc} prdDoc={prdDoc} sddDoc={sddDoc} onChange={handleChange} baseline={srsBaseline} attribution={srsSnapshots.length ? srsAttribution : undefined} onEditingItem={serverSession ? announceEditing : undefined} presence={presenceByItem} readOnly={sessionReadOnly} />}
        {currentView === 'vtp' && vtpDoc && <VTPTable key={selectedDocName} doc={vtpDoc} srsDoc={srsDoc} onChange={handleChange} redline={vtpRedline} attribution={vtpSnapshots.length ? vtpAttribution : undefined} onEditingItem={serverSession ? announceEditing : undefined} presence={presenceByItem} readOnly={sessionReadOnly} />}
        {currentView === 'testing' && vtpDoc && <TestingView key={selectedDocName} doc={vtpDoc} run={runRecord} onChange={handleChange} readOnly={sessionReadOnly} />}
        {currentView === 'releases' && isDirectoryOpen && (
          <ReleasesView releases={releases} jobs={jobsDoc?.jobs ?? []} />
        )}
        {currentView === 'audit' && srsDoc && (
          <AuditView
            prd={prdDoc} srs={srsDoc} vtp={vtpDoc}
            jobs={jobsDoc?.jobs ?? []} releases={releases}
            sdd={sddDoc}
            risk={riskDoc}
            hasArchitecture={!!(sad || dsl)}
            onNavigate={setCurrentView}
          />
        )}
        {currentView === 'trace' && srsDoc && (
          <TraceabilityView prd={prdDoc} srs={srsDoc} vtp={vtpDoc} run={runRecord} />
        )}
        {currentView === 'arch' && isDirectoryOpen && (
          <ArchitectureView
            sad={sad} dsl={dsl} guide={sadGuide} diagrams={diagrams}
            onChangeSad={(v) => { setSad(v); setDirtySad(true); }}
            onChangeDsl={(v) => { setDsl(v); setDirtyDsl(true); }}
            readOnly={sessionReadOnly}
          />
        )}
        {currentView === 'sdd' && isDirectoryOpen && (
          <DetailedDesignView
            doc={sddDoc}
            srsDoc={srsDoc}
            diagrams={diagrams}
            onChange={handleSddChange}
            onChangeSrs={handleChange}
            readOnly={sessionReadOnly}
          />
        )}
        {currentView === 'risk' && riskDoc && (
          <RiskTable
            key={selectedDocName}
            doc={riskDoc}
            sddDoc={sddDoc}
            srsDoc={srsDoc}
            vtpDoc={vtpDoc}
            run={runRecord}
            onChange={handleRiskChange}
            readOnly={sessionReadOnly}
          />
        )}
        {currentView === 'soup' && soupDoc && (
          <SoupTable
            key={selectedDocName}
            doc={soupDoc}
            sddDoc={sddDoc}
            vtpDoc={vtpDoc}
            riskDoc={riskDoc}
            onChange={handleSoupChange}
            readOnly={sessionReadOnly}
          />
        )}
        {currentView === 'threat' && threatDoc && (
          <ThreatTable
            key={selectedDocName}
            doc={threatDoc}
            sddDoc={sddDoc}
            soupDoc={soupDoc}
            srsDoc={srsDoc}
            vtpDoc={vtpDoc}
            riskDoc={riskDoc}
            run={runRecord}
            onChange={handleThreatChange}
            readOnly={sessionReadOnly}
          />
        )}
        {currentView === 'sec' && isDirectoryOpen && (
          <SecurityView
            sec={sec}
            diagrams={diagrams}
            onChange={(v) => { setSec(v); setDirtySec(true); }}
            readOnly={sessionReadOnly}
          />
        )}
        {currentView === 'jobs' && isDirectoryOpen && (
          <JobsView
            doc={jobsDoc}
            projectName={selectedDocName || projectName}
            activeIds={activeIds}
            jobDiffs={jobDiffs}
            jobCommits={jobCommits}
            jobArch={jobArch}
            jobRuns={jobRuns}
            run={runRecord}
            activeDiffs={activeDiffs}
            activeArch={activeArch}
            onChange={handleJobsChange}
            onSetActive={handleSetJob}
            readOnly={sessionReadOnly}
          />
        )}

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
          prdDoc={prdDoc} sddDoc={sddDoc} riskDoc={riskDoc} soupDoc={soupDoc} threatDoc={threatDoc} jobsDoc={jobsDoc} job={job}
          demo={launch.demo}
        />
      )}

      {showVersions && <VersionHistoryDialog releases={releases} onClose={() => setShowVersions(false)} />}

      {showCommit && serverSession && (
        <CommitDialog
          status={serverState ?? { changed: [], dirty: false, diff: [] }}
          branch={serverSession.repo.branch}
          activeJobLabel={activeJobLabel}
          onCommit={serverCommit}
          onDiscard={async () => {
            await serverDiscard();
            // The working copy was reverted, so what is on screen is stale.
            await applyOpened(await openServerProject(), projectName);
            await refreshServerStatus();
          }}
          onClose={() => setShowCommit(false)}
          onCommitted={() => void refreshServerStatus()}
        />
      )}
    </div>
  );
};

export default LocalApp;
