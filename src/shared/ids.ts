// Stable-key generation: typed prefix + 6 random hex digits, e.g. r_7f3a9c.
// Ids are immutable once assigned; all references target them, never labels.

export type Rng = () => number;

const defaultRng: Rng = () => Math.random();

/** Prefixes by row kind: requirement, test, heading. */
export const ID_PREFIX = { requirement: 'r', test: 't', heading: 'h' } as const;

export function generateId(
  prefix: string,
  existing: Iterable<string> = [],
  rng: Rng = defaultRng
): string {
  const taken = existing instanceof Set ? existing : new Set(existing);
  for (let attempt = 0; attempt < 1000; attempt++) {
    const suffix = Math.floor(rng() * 0x1000000)
      .toString(16)
      .padStart(6, '0');
    const id = `${prefix}_${suffix}`;
    if (!taken.has(id)) return id;
  }
  throw new Error(`Unable to generate a unique id with prefix "${prefix}"`);
}
