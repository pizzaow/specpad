/**
 * ViewTabs — the document-view tab strip (Requirements / Verification Tests /
 * Results). Registry-driven so new views (e.g. Architecture) are one entry.
 * Presentational; the shell owns the active view and which tabs are enabled.
 */
import React from 'react';

export type ViewKey = 'srs' | 'vtp' | 'testing' | 'jobs' | 'arch';

const TABS: { key: ViewKey; label: string }[] = [
  { key: 'jobs', label: 'Jobs' },
  { key: 'srs', label: 'Requirements' },
  { key: 'vtp', label: 'Verification Tests' },
  { key: 'arch', label: 'Architecture' },
  { key: 'testing', label: 'Results' },
];

interface ViewTabsProps {
  current: ViewKey;
  enabled: Record<ViewKey, boolean>;
  onSelect: (key: ViewKey) => void;
}

const ViewTabs: React.FC<ViewTabsProps> = ({ current, enabled, onSelect }) => (
  <ul className="nav nav-tabs view-tabs">
    {TABS.map((t) => {
      const isEnabled = enabled[t.key];
      const classes = [t.key === current ? 'active' : '', isEnabled ? '' : 'disabled'].filter(Boolean).join(' ');
      return (
        <li key={t.key} className={classes} role="presentation">
          <a href="#" onClick={(e) => { e.preventDefault(); if (isEnabled) onSelect(t.key); }}>{t.label}</a>
        </li>
      );
    })}
  </ul>
);

export default ViewTabs;
