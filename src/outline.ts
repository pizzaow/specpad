/**
 * outline — derive dotted heading codes from the flat items + their `level`.
 * A heading's displayed code is the dot-joined chain of ancestor heading segments
 * plus its own. A segment is the heading's `code`, or the first word of its text.
 * Pure; requirements (non-headings) are not assigned codes here.
 */
import type { SrsItem } from './shared';

function slugSegment(text: string): string {
  const first = text.trim().split(/\s+/)[0];
  return first || 'section';
}

export function deriveHeadingCodes(items: SrsItem[]): Map<string, string> {
  const codes = new Map<string, string>();
  const stack: { level: number; segment: string }[] = [];
  for (const item of items) {
    if (!item.heading) continue;
    const level = item.level ?? 0;
    while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
    const segment = item.code?.trim() || slugSegment(item.text);
    const dotted = [...stack.map((s) => s.segment), segment].join('.');
    codes.set(item.id, dotted);
    stack.push({ level, segment });
  }
  return codes;
}
