/**
 * RowMenu — the per-row hamburger (⋮) actions dropdown for the SRS table.
 * Purely presentational: every action is a callback the table provides. Opens on
 * click, closes on selection or backdrop click.
 */
import React, { useState } from 'react';

export interface RowMenuProps {
  onAddAbove: () => void;
  onAddBelow: () => void;
  onAddChild: () => void;
  onAddHeading: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onDelete: () => void;
  onViewInfo: () => void;
  canOutdent?: boolean; // default true; false disables Outdent (already at level 0)
}

const RowMenu: React.FC<RowMenuProps> = (props) => {
  const [open, setOpen] = useState(false);
  const pick = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    fn();
  };
  const outdentDisabled = props.canOutdent === false;

  return (
    <div className={`dropdown row-menu${open ? ' open' : ''}`} style={{ display: 'inline-block' }}>
      <button
        type="button"
        className="btn btn-default btn-xs"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Row actions"
        onClick={() => setOpen((o) => !o)}
      >
        ⋮
      </button>
      {open && (
        <>
          <div
            data-testid="row-menu-backdrop"
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1 }}
          />
          <ul className="dropdown-menu" style={{ display: 'block', left: 'auto', right: 0, zIndex: 2 }}>
            <li className="dropdown-header">Add requirement</li>
            <li><a href="#" onClick={pick(props.onAddAbove)}>Above</a></li>
            <li><a href="#" onClick={pick(props.onAddBelow)}>Below</a></li>
            <li><a href="#" onClick={pick(props.onAddChild)}>Child</a></li>
            <li role="separator" className="divider" />
            <li><a href="#" onClick={pick(props.onAddHeading)}>Add heading</a></li>
            <li><a href="#" onClick={pick(props.onIndent)}>Indent</a></li>
            <li className={outdentDisabled ? 'disabled' : ''}>
              <a href="#" onClick={(e) => { e.preventDefault(); if (!outdentDisabled) { setOpen(false); props.onOutdent(); } }}>
                Outdent
              </a>
            </li>
            <li role="separator" className="divider" />
            <li><a href="#" onClick={pick(props.onViewInfo)}>View information</a></li>
            <li><a href="#" className="text-danger" onClick={pick(props.onDelete)}>Delete</a></li>
          </ul>
        </>
      )}
    </div>
  );
};

export default RowMenu;
