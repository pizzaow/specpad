/**
 * archDiff — turn a before/after pair of architecture markdown (the SAD and its
 * guide) into a *section-aware* change list, so a job's architecture impact reads
 * as "what changed, where" (e.g. "§9 Architecture Decisions: +2 −1 lines") rather
 * than a flat line dump. Diagrams (.svg) carry no text we can meaningfully diff, so
 * the caller reports them coarsely ("Diagram changed"); this module is markdown-only.
 *
 * Pure and dependency-free for unit testing. Sections are split on markdown ATX
 * headings (`#`..`######`); content before the first heading is the "(intro)".
 */

export interface MdSectionChange {
  heading: string; // human label without the leading #'s; '(intro)' for preamble
  status: 'added' | 'removed' | 'modified';
  added: string[]; // non-empty lines present only in `after`
  removed: string[]; // non-empty lines present only in `before`
}

export interface MdFileDiff {
  file: string;
  sections: MdSectionChange[];
}

interface Section {
  heading: string; // full heading line (the section key), '' for the preamble
  body: string[];
}

const isHeading = (line: string) => /^#{1,6}\s/.test(line);
const label = (heading: string) => (heading === '' ? '(intro)' : heading.replace(/^#{1,6}\s*/, '').trim());

function parseSections(text: string): Section[] {
  const sections: Section[] = [];
  let cur: Section = { heading: '', body: [] };
  for (const line of text.split('\n')) {
    if (isHeading(line)) {
      sections.push(cur);
      cur = { heading: line.trim(), body: [] };
    } else {
      cur.body.push(line);
    }
  }
  sections.push(cur);
  // Drop an empty leading preamble (a doc that starts with a heading).
  return sections.filter((s, i) => !(i === 0 && s.heading === '' && s.body.join('').trim() === ''));
}

// Added/removed non-empty lines between two bodies (set difference, like the old coarse diff).
function lineDelta(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const bSet = new Set(before), aSet = new Set(after);
  return {
    added: after.filter((l) => !bSet.has(l) && l.trim()),
    removed: before.filter((l) => !aSet.has(l) && l.trim()),
  };
}

/** Section-level diff of two markdown documents. Returns only sections that changed. */
export function mdSectionDiff(before: string, after: string): MdSectionChange[] {
  const b = parseSections(before);
  const a = parseSections(after);
  const bByKey = new Map(b.map((s) => [s.heading, s]));
  const aByKey = new Map(a.map((s) => [s.heading, s]));
  const out: MdSectionChange[] = [];

  // Added + modified sections, in the document's (after) order.
  for (const s of a) {
    const prev = bByKey.get(s.heading);
    if (!prev) {
      const added = s.body.filter((l) => l.trim());
      out.push({ heading: label(s.heading), status: 'added', added, removed: [] });
    } else {
      const { added, removed } = lineDelta(prev.body, s.body);
      if (added.length || removed.length) out.push({ heading: label(s.heading), status: 'modified', added, removed });
    }
  }
  // Removed sections (present before, gone after), in their original order.
  for (const s of b) {
    if (!aByKey.has(s.heading)) {
      out.push({ heading: label(s.heading), status: 'removed', added: [], removed: s.body.filter((l) => l.trim()) });
    }
  }
  return out;
}
