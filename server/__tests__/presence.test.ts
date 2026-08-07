import { describe, it, expect } from 'vitest';
import { PresenceRegistry, DEFAULT_PRESENCE_TTL_MS } from '../presence';
import { EventBus, formatEvent, HEARTBEAT_MS } from '../events';
import type { EventSink } from '../events';
import { BranchWatcher } from '../branchWatcher';
import type { GitRunner } from '../git';

// CE-3/CE-4. Presence prevents surprise, never corruption — so the tests care most
// about what happens when it goes wrong: claims expiring, sinks dying, remotes failing.

const jane = { id: 'jane', displayName: 'Jane Smith' };
const kim = { id: 'kim', displayName: 'Kim Patel' };
const T0 = 1_000_000;

describe('PresenceRegistry', () => {
  it('lists who is editing what', () => {
    const registry = new PresenceRegistry();
    registry.claim(jane, { doc: 'acme.srs.json', itemId: 'r_14' }, T0);

    expect(registry.list(T0)).toEqual([
      { userId: 'jane', displayName: 'Jane Smith', doc: 'acme.srs.json', itemId: 'r_14' },
    ]);
  });

  it('treats a claim with no item as merely present in a document', () => {
    const registry = new PresenceRegistry();
    registry.claim(jane, { doc: 'acme.srs.json' }, T0);

    expect(registry.list(T0)[0]).toMatchObject({ doc: 'acme.srs.json', itemId: null });
  });

  it('expires a claim on its own, with nobody having to release it (CE-4)', () => {
    const registry = new PresenceRegistry(1000);
    registry.claim(jane, { doc: 'acme.srs.json', itemId: 'r_14' }, T0);

    expect(registry.list(T0 + 999)).toHaveLength(1);
    expect(registry.list(T0 + 1000)).toEqual([]);
  });

  it('sweeps expired claims and says whether anything went', () => {
    const registry = new PresenceRegistry(1000);
    registry.claim(jane, { doc: 'a.srs.json', itemId: 'r_1' }, T0);

    expect(registry.sweep(T0 + 500)).toBe(false);
    expect(registry.sweep(T0 + 1000)).toBe(true);
    expect(registry.sweep(T0 + 1000)).toBe(false);
  });

  it('refreshes an existing claim without reporting a change', () => {
    const registry = new PresenceRegistry();
    registry.claim(jane, { doc: 'a.srs.json', itemId: 'r_1' }, T0);

    // A heartbeat saying the same thing must not wake every subscriber.
    expect(registry.claim(jane, { doc: 'a.srs.json', itemId: 'r_1' }, T0 + 1000)).toBe(false);
    expect(registry.list(T0 + DEFAULT_PRESENCE_TTL_MS)).toHaveLength(1);
  });

  it('reports a change when the user moves to another item', () => {
    const registry = new PresenceRegistry();
    registry.claim(jane, { doc: 'a.srs.json', itemId: 'r_1' }, T0);

    expect(registry.claim(jane, { doc: 'a.srs.json', itemId: 'r_2' }, T0 + 10)).toBe(true);
    expect(registry.list(T0 + 10)[0].itemId).toBe('r_2');
  });

  it('reports a change when someone new arrives, or returns after expiring', () => {
    const registry = new PresenceRegistry(1000);

    expect(registry.claim(jane, { itemId: 'r_1' }, T0)).toBe(true);
    expect(registry.claim(kim, { itemId: 'r_2' }, T0)).toBe(true);
    expect(registry.claim(jane, { itemId: 'r_1' }, T0 + 5000)).toBe(true);
  });

  it('releases a claim on request', () => {
    const registry = new PresenceRegistry();
    registry.claim(jane, { itemId: 'r_1' }, T0);

    expect(registry.release('jane')).toBe(true);
    expect(registry.release('jane')).toBe(false);
    expect(registry.list(T0)).toEqual([]);
  });

  it('can leave the asking user out, since nobody needs telling where they are', () => {
    const registry = new PresenceRegistry();
    registry.claim(jane, { itemId: 'r_1' }, T0);
    registry.claim(kim, { itemId: 'r_2' }, T0);

    expect(registry.list(T0, 'jane').map((p) => p.userId)).toEqual(['kim']);
  });

  it('orders the list stably, so subscribers see no spurious changes', () => {
    const registry = new PresenceRegistry();
    registry.claim(kim, { itemId: 'r_2' }, T0);
    registry.claim(jane, { itemId: 'r_1' }, T0);

    expect(registry.list(T0).map((p) => p.displayName)).toEqual(['Jane Smith', 'Kim Patel']);
  });
});

/** A recording sink standing in for ServerResponse; can be made to fail mid-stream. */
class FakeSink implements EventSink {
  written: string[] = [];
  headers: Record<string, string> | null = null;
  status = 0;
  private closeListener: (() => void) | null = null;
  private broken = false;

  writeHead(status: number, headers: Record<string, string>): void {
    this.status = status;
    this.headers = headers;
  }

  write(chunk: string): void {
    if (this.broken) throw new Error('socket closed');
    this.written.push(chunk);
  }

  end(): void {
    this.written.push('<end>');
  }

  on(_event: 'close', listener: () => void): void {
    this.closeListener = listener;
  }

  /** Simulate the far end going away mid-stream. */
  breakPipe(): void {
    this.broken = true;
  }

  fireClose(): void {
    this.closeListener?.();
  }

  get text(): string {
    return this.written.join('');
  }
}

const makeSink = () => new FakeSink();

describe('EventBus', () => {
  it('opens a stream with SSE headers that survive a buffering proxy', () => {
    const bus = new EventBus();
    const s = makeSink();

    bus.subscribe(s);

    expect(s.status).toBe(200);
    expect(s.headers!['content-type']).toMatch(/text\/event-stream/);
    expect(s.headers!['cache-control']).toMatch(/no-cache/);
    expect(s.headers!['x-accel-buffering']).toBe('no');
  });

  it('broadcasts to every subscriber', () => {
    const bus = new EventBus();
    const a = makeSink();
    bus.subscribe(a);
    const b = makeSink();
    bus.subscribe(b);

    bus.broadcast('presence', [{ userId: 'jane' }]);

    expect(a.text).toContain('event: presence');
    expect(b.text).toContain('"userId":"jane"');
  });

  it('drops a subscriber whose socket has died rather than throwing', () => {
    const bus = new EventBus();
    const dead = makeSink();
    bus.subscribe(dead);
    const live = makeSink();
    bus.subscribe(live);
    dead.breakPipe();

    expect(() => bus.broadcast('upstream', { sha: 'abc' })).not.toThrow();
    expect(bus.subscriberCount).toBe(1);
    expect(live.text).toContain('event: upstream');
  });

  it('forgets a subscriber when its connection closes', () => {
    const bus = new EventBus();
    const s = makeSink();
    bus.subscribe(s);

    s.fireClose();

    expect(bus.subscriberCount).toBe(0);
  });

  it('unsubscribes on request', () => {
    const bus = new EventBus();
    const s = makeSink();
    const off = bus.subscribe(s);

    off();

    expect(bus.subscriberCount).toBe(0);
  });

  it('sends a heartbeat comment that carries no event', () => {
    const bus = new EventBus();
    const s = makeSink();
    bus.subscribe(s);

    bus.heartbeat();

    expect(s.text).toContain(': ping');
    expect(HEARTBEAT_MS).toBeGreaterThan(0);
  });
});

describe('formatEvent', () => {
  it('frames an event the way EventSource expects', () => {
    expect(formatEvent('upstream', { sha: 'abc123' })).toBe(
      'event: upstream\ndata: {"sha":"abc123"}\n\n',
    );
  });

  it('splits a multi-line payload into one data line each, so framing survives', () => {
    expect(formatEvent('hello', 'one\ntwo')).toBe('event: hello\ndata: one\ndata: two\n\n');
  });
});

/** A git runner that answers ls-remote from a scripted list of SHAs. */
function runnerReturning(...results: (string | null)[]): GitRunner {
  let call = 0;
  return async () => {
    const value = results[Math.min(call++, results.length - 1)];
    if (value === null) return { stdout: '', stderr: 'fatal: unreachable', code: 1 };
    return { stdout: `${value}\trefs/heads/main\n`, stderr: '', code: 0 };
  };
}

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

describe('BranchWatcher', () => {
  it('does not report a change on its first observation', async () => {
    const watcher = new BranchWatcher(runnerReturning(SHA_A), '/repo.git', 'main');

    expect(await watcher.check()).toBeNull();
    expect(watcher.currentSha).toBe(SHA_A);
  });

  it('reports the new SHA when the branch moves', async () => {
    const watcher = new BranchWatcher(runnerReturning(SHA_A, SHA_B), '/repo.git', 'main');
    await watcher.check();

    expect(await watcher.check()).toBe(SHA_B);
  });

  it('reports nothing while the branch stays put', async () => {
    const watcher = new BranchWatcher(runnerReturning(SHA_A, SHA_A, SHA_A), '/repo.git', 'main');
    await watcher.check();

    expect(await watcher.check()).toBeNull();
    expect(await watcher.check()).toBeNull();
  });

  it('treats an unreachable remote as no news, not as a change', async () => {
    const watcher = new BranchWatcher(runnerReturning(SHA_A, null, SHA_A), '/repo.git', 'main');
    await watcher.check();

    expect(await watcher.check()).toBeNull();
    expect(await watcher.check()).toBeNull();
    expect(watcher.currentSha).toBe(SHA_A);
  });

  it('ignores a response that is not a SHA', async () => {
    const watcher = new BranchWatcher(runnerReturning('not-a-sha'), '/repo.git', 'main');

    expect(await watcher.check()).toBeNull();
    expect(watcher.currentSha).toBeNull();
  });
});
