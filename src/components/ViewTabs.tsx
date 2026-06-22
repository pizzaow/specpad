/**
 * ViewTabs — the document-view tab strip. Registry-driven so new views are one
 * entry. Tabs are grouped: Overview (home) ▏ authoring (Requirements …) ▏
 * oversight (Auditor, Releases, Jobs); a thin separator divides the groups.
 * Presentational; the shell owns the active view and which tabs are enabled.
 */
import React from 'react';

export type ViewKey = 'overview' | 'prd' | 'srs' | 'vtp' | 'testing' | 'arch' | 'audit' | 'trace' | 'releases' | 'jobs';
type Group = 'home' | 'authoring' | 'oversight';

const TABS: { key: ViewKey; label: string; group: Group }[] = [
  { key: 'overview', label: 'Overview', group: 'home' },
  { key: 'prd', label: 'Product Requirements', group: 'authoring' },
  { key: 'srs', label: 'Requirements', group: 'authoring' },
  { key: 'vtp', label: 'Verification Tests', group: 'authoring' },
  { key: 'testing', label: 'Results', group: 'authoring' },
  { key: 'arch', label: 'Architecture', group: 'authoring' },
  { key: 'audit', label: 'Auditor', group: 'oversight' },
  { key: 'trace', label: 'Traceability', group: 'oversight' },
  { key: 'releases', label: 'Releases', group: 'oversight' },
  { key: 'jobs', label: 'Jobs', group: 'oversight' },
];

interface ViewTabsProps {
  current: ViewKey;
  enabled: Record<ViewKey, boolean>;
  onSelect: (key: ViewKey) => void;
}

const ViewTabs: React.FC<ViewTabsProps> = ({ current, enabled, onSelect }) => (
  <ul className="nav nav-tabs view-tabs">
    {TABS.map((t, i) => {
      const isEnabled = enabled[t.key];
      const classes = [t.key === current ? 'active' : '', isEnabled ? '' : 'disabled'].filter(Boolean).join(' ');
      const newGroup = i > 0 && TABS[i - 1].group !== t.group;
      return (
        <React.Fragment key={t.key}>
          {newGroup && <li className="tab-sep" role="presentation" aria-hidden="true" />}
          <li className={classes} role="presentation">
            <a href="#" onClick={(e) => { e.preventDefault(); if (isEnabled) onSelect(t.key); }}>{t.label}</a>
          </li>
        </React.Fragment>
      );
    })}
  </ul>
);

export default ViewTabs;
