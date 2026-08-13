/**
 * ViewTabs — the document-view tab strip, laid out as a CSS grid so a thin band
 * below the tabs can label each **design-control phase** and span exactly the
 * tabs it covers (e.g. "Design Inputs" across Product Requirements + Requirements;
 * "Design Verification" across Verification Tests + Results). Presentational; the
 * shell owns the active view and which tabs are enabled.
 */
import React from 'react';

export type ViewKey = 'overview' | 'prd' | 'srs' | 'vtp' | 'testing' | 'arch' | 'sdd' | 'risk' | 'soup' | 'threat' | 'sec' | 'reference' | 'audit' | 'trace' | 'releases' | 'jobs';

// `phase` is the design-control element this tab contributes evidence to; tabs with
// the same adjacent phase share one band. Overview has none (it's the home view).
// Ordered chronologically through the design-control phases: Inputs → Outputs →
// Verification → Controls → Traceability → History → Changes.
// Documents are labelled by the acronym a regulated team already uses; the full name
// rides along as a tooltip so nothing is lost on a reader who does not know them yet.
// Views that are not a document (Overview, Auditor, …) keep their word.
const TABS: { key: ViewKey; label: string; title?: string; phase?: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'prd', label: 'PRD', title: 'Product Requirements', phase: 'Design Inputs' },
  { key: 'srs', label: 'SRS', title: 'Software Requirements', phase: 'Design Inputs' },
  { key: 'reference', label: 'Refs', title: 'Controlled documents this project relies on but does not hold (IEC 62304 5.1, clause 6, clause 9)', phase: 'Design Inputs' },
  { key: 'arch', label: 'SAD', title: 'Software Architecture Document', phase: 'Design Outputs' },
  { key: 'sdd', label: 'SDD', title: 'Software Detailed Design', phase: 'Design Outputs' },
  { key: 'soup', label: 'SOUP', title: 'Third-party software (IEC 62304 SOUP; FDA off-the-shelf)', phase: 'Design Outputs' },
  { key: 'sec', label: 'Security', title: 'Security architecture — the four views a submission is expected to contain', phase: 'Design Outputs' },
  { key: 'risk', label: 'Risk', title: 'Software risk analysis (IEC 62304 clause 7)', phase: 'Risk Management' },
  { key: 'threat', label: 'Threats', title: 'Threat model and security risk (FDA cybersecurity; IEC 81001-5-1)', phase: 'Risk Management' },
  { key: 'vtp', label: 'VTP', title: 'Verification Test Plan', phase: 'Design Verification' },
  { key: 'testing', label: 'Results', title: 'Verification results', phase: 'Design Verification' },
  { key: 'audit', label: 'Auditor', phase: 'Design Controls' },
  { key: 'trace', label: 'Traceability', phase: 'Traceability' },
  { key: 'releases', label: 'Releases', phase: 'Design History' },
  { key: 'jobs', label: 'Jobs', phase: 'Design Changes' },
];

// Contiguous runs of tabs sharing a phase → one band spanning that run's columns.
const phaseRuns: { phase: string; start: number; count: number }[] = [];
TABS.forEach((t, i) => {
  if (!t.phase) return;
  const last = phaseRuns[phaseRuns.length - 1];
  if (last && last.phase === t.phase && last.start + last.count === i) last.count += 1;
  else phaseRuns.push({ phase: t.phase, start: i, count: 1 });
});

interface ViewTabsProps {
  current: ViewKey;
  enabled: Record<ViewKey, boolean>;
  onSelect: (key: ViewKey) => void;
}

const ViewTabs: React.FC<ViewTabsProps> = ({ current, enabled, onSelect }) => (
  <div className="view-tabs" role="tablist" style={{ gridTemplateColumns: `repeat(${TABS.length}, auto)` }}>
    {TABS.map((t, i) => {
      const isEnabled = enabled[t.key];
      const cls = ['view-tab', t.key === current ? 'active' : '', isEnabled ? '' : 'disabled'].filter(Boolean).join(' ');
      return (
        <a
          key={t.key}
          href="#"
          role="tab"
          className={cls}
          title={t.title}
          style={{ gridColumn: i + 1, gridRow: 1 }}
          onClick={(e) => { e.preventDefault(); if (isEnabled) onSelect(t.key); }}
        >
          {t.label}
        </a>
      );
    })}
    {phaseRuns.map((r) => (
      <div
        key={`${r.phase}-${r.start}`}
        className="phase-band"
        style={{ gridColumn: `${r.start + 1} / span ${r.count}`, gridRow: 2 }}
      >
        {r.phase}
      </div>
    ))}
  </div>
);

export default ViewTabs;
