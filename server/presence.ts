/**
 * Editing presence (CE-3, CE-4) — advisory only.
 *
 * This exists to prevent *surprise*, not corruption. Correctness comes from per-user
 * working copies and the structural merge; a claim here is a courtesy that tells you
 * someone else is already in REQ-14 before you spend twenty minutes rewriting it.
 *
 * So it is deliberately weak: claims expire on their own, nothing blocks on them, and
 * losing the whole registry (a server restart) costs nothing but a moment of silence.
 * A lock that vanishes when someone shuts a laptop lid must never be load-bearing.
 *
 * Pure and clock-injected: no timers, no I/O.
 */

export interface Presence {
  userId: string;
  displayName: string;
  /** The document being edited, e.g. "acme.srs.json"; null when merely present. */
  doc: string | null;
  /** The item (row) being edited; null when the user is in the document generally. */
  itemId: string | null;
}

interface Held extends Presence {
  expiresAt: number;
}

export const DEFAULT_PRESENCE_TTL_MS = 45_000;

export class PresenceRegistry {
  private readonly held = new Map<string, Held>();

  constructor(private readonly ttlMs: number = DEFAULT_PRESENCE_TTL_MS) {}

  /**
   * Record (or refresh) where a user is. Returns true when the *visible* state changed,
   * so a heartbeat that says nothing new does not wake every subscriber.
   */
  claim(
    user: { id: string; displayName: string },
    where: { doc?: string | null; itemId?: string | null },
    now: number,
  ): boolean {
    const doc = where.doc ?? null;
    const itemId = where.itemId ?? null;
    const previous = this.held.get(user.id);
    const changed =
      !previous ||
      previous.expiresAt <= now ||
      previous.doc !== doc ||
      previous.itemId !== itemId ||
      previous.displayName !== user.displayName;

    this.held.set(user.id, {
      userId: user.id,
      displayName: user.displayName,
      doc,
      itemId,
      expiresAt: now + this.ttlMs,
    });
    return changed;
  }

  /** Drop a user's claim (they navigated away, saved, or disconnected). */
  release(userId: string): boolean {
    return this.held.delete(userId);
  }

  /** Expire anything past its TTL. Returns true when something was dropped. */
  sweep(now: number): boolean {
    let dropped = false;
    for (const [userId, entry] of this.held) {
      if (entry.expiresAt <= now) {
        this.held.delete(userId);
        dropped = true;
      }
    }
    return dropped;
  }

  /**
   * Everyone currently present, expired entries excluded. Sorted by display name so
   * the broadcast payload is stable and subscribers do not see spurious changes.
   */
  list(now: number, excludeUserId?: string): Presence[] {
    const present: Presence[] = [];
    for (const entry of this.held.values()) {
      if (entry.expiresAt <= now) continue;
      if (excludeUserId !== undefined && entry.userId === excludeUserId) continue;
      present.push({
        userId: entry.userId,
        displayName: entry.displayName,
        doc: entry.doc,
        itemId: entry.itemId,
      });
    }
    return present.sort((a, b) => a.displayName.localeCompare(b.displayName) || a.userId.localeCompare(b.userId));
  }
}
