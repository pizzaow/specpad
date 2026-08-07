/**
 * The event stream (CE-3) — server-sent events.
 *
 * Two things go down this channel: who is editing what, and "the branch moved". The
 * second is the one that saves real work — it stops someone refining a requirement that
 * was rewritten upstream twenty minutes ago.
 *
 * SSE rather than WebSockets: this traffic is one-directional, it survives ordinary
 * HTTP proxies (which a corporate deployment sits behind), and the browser reconnects
 * on its own. Nothing here is required for correctness, so a dropped stream degrades to
 * an editor that simply says less.
 */

/** The bit of ServerResponse we need — kept narrow so tests can pass a plain sink. */
export interface EventSink {
  writeHead(status: number, headers: Record<string, string>): unknown;
  write(chunk: string): unknown;
  end(): unknown;
  on?(event: 'close', listener: () => void): unknown;
}

export type EventName = 'presence' | 'upstream' | 'hello';

/** Proxies commonly close an idle stream; a comment line keeps it warm. */
export const HEARTBEAT_MS = 25_000;

interface Subscriber {
  id: number;
  sink: EventSink;
}

export class EventBus {
  private readonly subscribers = new Map<number, Subscriber>();
  private nextId = 1;

  /** Open an SSE stream. Returns an unsubscribe function. */
  subscribe(sink: EventSink): () => void {
    sink.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Nginx buffers by default, which holds events until the buffer fills.
      'x-accel-buffering': 'no',
    });

    const id = this.nextId++;
    this.subscribers.set(id, { id, sink });
    sink.on?.('close', () => this.subscribers.delete(id));
    return () => {
      this.subscribers.delete(id);
    };
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }

  /** Send one event to one sink. */
  send(sink: EventSink, event: EventName, data: unknown): void {
    sink.write(formatEvent(event, data));
  }

  /** Send an event to everyone. A sink that throws is dropped, not retried. */
  broadcast(event: EventName, data: unknown): void {
    const payload = formatEvent(event, data);
    for (const [id, subscriber] of this.subscribers) {
      try {
        subscriber.sink.write(payload);
      } catch {
        this.subscribers.delete(id);
      }
    }
  }

  /** Keep idle streams open. */
  heartbeat(): void {
    for (const [id, subscriber] of this.subscribers) {
      try {
        subscriber.sink.write(': ping\n\n');
      } catch {
        this.subscribers.delete(id);
      }
    }
  }

  closeAll(): void {
    for (const subscriber of this.subscribers.values()) {
      try {
        subscriber.sink.end();
      } catch {
        /* already gone */
      }
    }
    this.subscribers.clear();
  }
}

/**
 * Serialize one SSE message. Every newline in the payload has to become its own
 * `data:` line or the stream frames wrongly — JSON.stringify escapes them, but this
 * stays correct if a caller ever sends raw text.
 */
export function formatEvent(event: EventName, data: unknown): string {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  const lines = body.split('\n').map((line) => `data: ${line}`).join('\n');
  return `event: ${event}\n${lines}\n\n`;
}
