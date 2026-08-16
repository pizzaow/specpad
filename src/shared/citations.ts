/**
 * Citations — what a requirement rests on, in a form something can open.
 *
 * `cites` is free text by design: a project cites clauses of standards, tickets and papers
 * that SpecPad has no business enumerating. But a citation nobody can look up is decoration,
 * and the whole reason to record one is so a later reader can check the requirement instead
 * of believing it. So citations that *name a file in this repository* are given a shape, and
 * that subset is machine-checkable:
 *
 *     src/shared/governance.ts                  the file
 *     src/shared/governance.ts:checkAdvice      a construct within it        ← prefer this
 *     src/shared/governance.ts:240              a line                       ← discouraged
 *     IEC 62304 §5.2.2 c)                       external; free text, unchecked
 *
 * Anchoring on a **construct name** rather than a line is the point. A line number is
 * falsified by an edit three functions above it, so it decays into noise and stops being
 * read; a symbol survives everything except the rename that genuinely invalidates the
 * citation — which is exactly the event worth being told about.
 *
 * Resolution lives here rather than in `checkGovernance` because it needs a filesystem. The
 * editor runs in a browser and has none, so it validates structure and leaves resolution to
 * the skill, the server and the audit — the places that can actually open the file.
 */

export type Citation =
  /** Names a path in this repository, so it can be resolved. */
  | { kind: 'source'; raw: string; path: string; anchor?: string; anchorKind?: 'symbol' | 'line' }
  /** A clause, a ticket, a paper. Recorded for a human; not resolvable here. */
  | { kind: 'external'; raw: string };

/** Extensions we treat as repository source. A citation to something else is external. */
const SOURCE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|json|less|css|html|md|sh|yml|yaml|sql|py)$/i;

/**
 * Classify one citation. Deliberately conservative: anything that does not clearly name a
 * repository path is left alone as external, because wrongly classifying a standards clause
 * as a broken file reference would make the check the first thing a project turns off.
 */
export function parseCitation(raw: string): Citation {
  const text = raw.trim();
  // `path:anchor` — split on the LAST colon so a Windows-ish or URL-ish prefix cannot fool it.
  const m = /^([^\s:]+):([A-Za-z_$][\w$.]*|\d+)$/.exec(text);
  const path = m ? m[1] : text;
  if (!SOURCE_FILE.test(path) || /^[a-z]+:\/\//i.test(text) || path.startsWith('/')) {
    return { kind: 'external', raw: text };
  }
  if (!m) return { kind: 'source', raw: text, path };
  return /^\d+$/.test(m[2])
    ? { kind: 'source', raw: text, path, anchor: m[2], anchorKind: 'line' }
    : { kind: 'source', raw: text, path, anchor: m[2], anchorKind: 'symbol' };
}

export type CitationProblem = 'missing-file' | 'missing-anchor' | 'line-anchor';

export interface CitationFinding {
  itemId: string;
  /** The item's human code, for a message a reader can act on. */
  code?: string;
  citation: string;
  problem: CitationProblem;
  message: string;
}

/** Reads a repository file, or returns null when it does not exist. */
export type ReadFile = (path: string) => string | null;

export interface CitedItem { id: string; code?: string; heading?: boolean; cites?: string[] }

/**
 * Check every source citation against the tree.
 *
 * `missing-file` and `missing-anchor` are hard failures: the requirement claims evidence that
 * is not there. `line-anchor` is a warning — the citation may well be right today, but it is
 * recorded in a form that will silently stop being right.
 */
export function checkCitations(items: CitedItem[], readFile: ReadFile): CitationFinding[] {
  const out: CitationFinding[] = [];
  const cache = new Map<string, string | null>();
  const read = (p: string) => {
    if (!cache.has(p)) cache.set(p, readFile(p));
    return cache.get(p)!;
  };

  for (const item of items) {
    if (item.heading) continue;
    for (const raw of item.cites ?? []) {
      const c = parseCitation(raw);
      if (c.kind !== 'source') continue;
      const add = (problem: CitationProblem, message: string) =>
        out.push({ itemId: item.id, code: item.code, citation: c.raw, problem, message });

      const body = read(c.path);
      if (body === null) {
        add('missing-file', `${item.code ?? item.id} cites ${c.raw}, but ${c.path} does not exist.`);
        continue;
      }
      if (c.anchorKind === 'line') {
        const lines = body.split('\n').length;
        if (Number(c.anchor) > lines) {
          add('missing-anchor', `${item.code ?? item.id} cites ${c.raw}, but ${c.path} has only ${lines} lines.`);
          continue;
        }
        add('line-anchor', `${item.code ?? item.id} cites a line number (${c.raw}); cite the construct by name instead, so an edit above it does not silently invalidate the citation.`);
        continue;
      }
      // Substring, not a parser: the point is "does this name still appear here", which
      // survives a language SpecPad has never heard of and costs nothing to run.
      if (c.anchor && !body.includes(c.anchor)) {
        add('missing-anchor', `${item.code ?? item.id} cites ${c.raw}, but ${c.path} no longer contains "${c.anchor}" — it was renamed or removed.`);
      }
    }
  }
  return out;
}

/** True when a citation names something in this repository, i.e. the audit can open it. */
export const isSourceCitation = (raw: string): boolean => parseCitation(raw).kind === 'source';
