/**
 * RowMenu — the per-row hamburger (⋮) actions dropdown for the SRS table.
 * Purely presentational: every action is a callback the table provides. Opens on
 * click, closes on selection or backdrop click.
 *
 * The open menu is rendered in a portal to document.body with fixed positioning
 * anchored to the trigger (EDA-8): a table row's fade-in animation animates
 * `transform`, which establishes a stacking context that would otherwise trap the
 * absolutely-positioned menu inside its row and let later rows paint over it. A
 * body portal at a popover-level z-index can never be obscured by a row/column.
 */
import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  noun?: string; // what's being added (default 'requirement'); e.g. 'product requirement', 'test'
}

const RowMenu: React.FC<RowMenuProps> = (props) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  // Fixed-position coordinates for the portaled menu, anchored to the trigger's
  // bottom-right so it right-aligns under the button, matching the old drop.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const pick = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(false);
    fn();
  };
  const outdentDisabled = props.canOutdent === false;

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 2, right: Math.max(0, window.innerWidth - r.right) });
  }, [open]);

  // A fixed menu would detach from its trigger on scroll/resize, so dismiss instead.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div className={`dropdown row-menu${open ? ' open' : ''}`} style={{ display: 'inline-block' }}>
      <button
        ref={btnRef}
        type="button"
        className="btn btn-default btn-xs"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Row actions"
        onClick={() => setOpen((o) => !o)}
      >
        ⋮
      </button>
      {open && pos &&
        createPortal(
          <>
            <div
              data-testid="row-menu-backdrop"
              onClick={() => setOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 1040 }}
            />
            <ul
              className="dropdown-menu row-menu-dropdown"
              style={{ display: 'block', position: 'fixed', top: pos.top, right: pos.right, left: 'auto', zIndex: 1050 }}
            >
              <li className="dropdown-header">Add {props.noun ?? 'requirement'}</li>
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
          </>,
          document.body,
        )}
    </div>
  );
};

export default RowMenu;
