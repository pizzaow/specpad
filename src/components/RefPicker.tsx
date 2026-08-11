/**
 * RefPicker — choose the items a cross-document reference points at.
 *
 * Every trace edge in SpecPad stores ids (`verifies`, `satisfies`, `design`) while a
 * human thinks in codes and text. This picker is the translation: it shows each
 * candidate's code and text, stores its id, and never asks anyone to type or read one.
 *
 * A reference that does not resolve is still displayed, marked as unresolved, and can be
 * removed — dropping it silently would hide the very breakage governance reports.
 */
import React, { useMemo, useRef, useState, useEffect } from 'react';

export interface RefOption {
  id: string;
  code?: string;
  text: string;
}

interface RefPickerProps {
  value: string[];
  options: RefOption[];
  onChange: (ids: string[]) => void;
  /** Accessible name, e.g. "Design sections implementing REQ-14". */
  label: string;
  /** Shown when nothing is selected. */
  empty?: string;
  readOnly?: boolean;
}

const codeOf = (o: RefOption) => o.code || o.id;

const RefPicker: React.FC<RefPickerProps> = ({ value, options, onChange, label, empty, readOnly }) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const pool = options.filter((o) => !value.includes(o.id));
    if (!q) return pool.slice(0, 20);
    return pool
      .filter((o) => `${codeOf(o)} ${o.text}`.toLowerCase().includes(q))
      .slice(0, 20);
  }, [filter, options, value]);

  const add = (id: string) => {
    onChange([...value, id]);
    setFilter('');
    setOpen(false);
  };

  return (
    <span className="ref-picker" role="group" aria-label={label}>
      {value.length === 0 && !open && (
        <span className="text-muted">{empty ?? 'None'}</span>
      )}

      {value.map((id) => {
        const option = byId.get(id);
        return (
          <span
            key={id}
            className={`label ${option ? 'label-default' : 'label-danger'}`}
            title={option ? option.text : 'This reference does not resolve to an existing item.'}
            style={{ marginRight: 4, display: 'inline-block' }}
          >
            {option ? codeOf(option) : `${id} (unresolved)`}
            {!readOnly && (
              <button
                type="button"
                aria-label={`Remove ${option ? codeOf(option) : id}`}
                onClick={() => onChange(value.filter((v) => v !== id))}
                style={{
                  background: 'none',
                  border: 0,
                  color: 'inherit',
                  cursor: 'pointer',
                  marginLeft: 4,
                  padding: 0,
                }}
              >
                ×
              </button>
            )}
          </span>
        );
      })}

      {!readOnly && !open && (
        <button
          type="button"
          className="btn btn-link btn-xs"
          style={{ padding: '0 4px' }}
          onClick={() => setOpen(true)}
        >
          + add…
        </button>
      )}

      {!readOnly && open && (
        <span className="ref-picker-open" style={{ display: 'inline-block', position: 'relative' }}>
          <input
            ref={inputRef}
            className="form-control input-sm"
            aria-label={`Search ${label}`}
            placeholder="Type to filter…"
            value={filter}
            style={{ width: 260, display: 'inline-block' }}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setOpen(false); setFilter(''); }
              if (e.key === 'Enter' && matches[0]) { e.preventDefault(); add(matches[0].id); }
            }}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          />
          <ul
            className="ref-picker-list"
            role="listbox"
            aria-label={`Candidates for ${label}`}
            style={{
              position: 'absolute',
              zIndex: 1050,
              top: '100%',
              left: 0,
              minWidth: 320,
              maxHeight: 240,
              overflowY: 'auto',
              background: 'var(--surface, #fff)',
              border: '1px solid var(--border, #ccc)',
              listStyle: 'none',
              margin: 0,
              padding: 4,
            }}
          >
            {matches.length === 0 ? (
              <li className="text-muted" style={{ padding: '4px 6px' }}>
                {options.length === 0 ? 'Nothing to link to yet.' : 'No match.'}
              </li>
            ) : (
              matches.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="btn btn-link btn-xs"
                    style={{ display: 'block', textAlign: 'left', width: '100%', whiteSpace: 'normal' }}
                    // mousedown, because the input's blur would close the list first.
                    onMouseDown={(e) => { e.preventDefault(); add(o.id); }}
                  >
                    <strong>{codeOf(o)}</strong> <span className="text-muted">{o.text}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </span>
      )}
    </span>
  );
};

export default RefPicker;
