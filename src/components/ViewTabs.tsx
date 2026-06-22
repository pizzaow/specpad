/**
 * ViewTabs — the document-view tab strip, laid out as a CSS grid so a thin band
 * below the tabs can label each **design-control phase** and span exactly the
 * tabs it covers (e.g. "Design Inputs" across Product Requirements + Requirements;
 * "Design Verification" across Verification Tests + Results). Presentational; the
 * shell owns the active view and which tabs are enabled.
 */
import React from 'react';

export type ViewKey = 'overview' | 'prd' | 'srs' | 'vtp' | 'testing' | 'arch' | 'audit' | 'trace' | 'releases' | 'jobs';

// `phase` is the design-control element this tab contributes evidence to; tabs with
// the same adjacent phase share one band. Overview has none (it's the home view).
const TABS: { key: ViewKey; label: string; phase?: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'prd', label: 'Product Requirements', phase: 'Design Inputs' },
  { key: 'srs', label: 'Requirements', phase: 'Design Inputs' },
  { key: 'vtp', label: 'Verification Tests', phase: 'Design Verification' },
  { key: 'testing', label: 'Results', phase: 'Design Verification' },
  { key: 'arch', label: 'Architecture', phase: 'Design Outputs' },
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
