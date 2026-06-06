// @vitest-environment node
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { isSupported, listRecent, rememberProject, forgetProject } from '../handleStore';

// Fake directory handle. isSameEntry lives on the prototype (not an own property),
// so structuredClone — which IndexedDB uses to store values — drops it and the
// object stores cleanly, while incoming handles still compare by identity.
class FakeHandle {
  constructor(public name: string, public hid: string) {}
  async isSameEntry(other: { hid?: string } | null): Promise<boolean> {
    return !!other && other.hid === this.hid;
  }
}
const h = (name: string, hid: string) => new FakeHandle(name, hid) as unknown as FileSystemDirectoryHandle;

beforeEach(() => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('handleStore', () => {
  it('reports support when indexedDB is present', () => {
    expect(isSupported()).toBe(true);
  });

  it('remembers a project and lists it', async () => {
    await rememberProject(h('repo', 'a'), { dir: '/x', projectNames: ['acme'], now: 1 });
    const list = await listRecent();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ dirName: 'repo', dir: '/x', projectNames: ['acme'] });
  });

  it('dedupes by folder identity, not by name', async () => {
    await rememberProject(h('repo', 'same'), { dir: '/x', projectNames: ['acme'], now: 1 });
    await rememberProject(h('repo-renamed', 'same'), { dir: '/x', projectNames: ['acme', 'other'], now: 2 });
    const list = await listRecent();
    expect(list).toHaveLength(1);
    expect(list[0].projectNames).toEqual(['acme', 'other']);
    expect(list[0].lastOpenedAt).toBe(2);
  });

  it('keeps distinct folders that share a project name', async () => {
    await rememberProject(h('repoA', 'a'), { dir: '/a', projectNames: ['acme'], now: 1 });
    await rememberProject(h('repoB', 'b'), { dir: '/b', projectNames: ['acme'], now: 2 });
    expect(await listRecent()).toHaveLength(2);
  });

  it('orders most-recent first', async () => {
    await rememberProject(h('one', '1'), { dir: '/1', projectNames: ['one'], now: 10 });
    await rememberProject(h('two', '2'), { dir: '/2', projectNames: ['two'], now: 20 });
    expect((await listRecent()).map((r) => r.dirName)).toEqual(['two', 'one']);
  });

  it('forgets a project', async () => {
    await rememberProject(h('one', '1'), { dir: '/1', projectNames: ['one'], now: 1 });
    const [r] = await listRecent();
    await forgetProject(r.id);
    expect(await listRecent()).toHaveLength(0);
  });
});
