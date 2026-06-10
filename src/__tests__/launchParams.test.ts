import { describe, it, expect } from 'vitest';
import { parseLaunchParams } from '../launchParams';

function loc(hash: string, search = ''): Location {
  return { hash, search } as Location;
}

describe('parseLaunchParams', () => {
  it('reads name/open/dir from the URL fragment', () => {
    const p = parseLaunchParams(loc('#name=acme&open=vtp&dir=%2Fhome%2Fme%2Frepo%2Fdocs%2Fspecpad'));
    expect(p).toEqual({ name: 'acme', open: 'vtp', dir: '/home/me/repo/docs/specpad', demo: false });
  });

  it('falls back to the query string for older launchers', () => {
    const p = parseLaunchParams(loc('', '?name=acme&open=srs'));
    expect(p).toEqual({ name: 'acme', open: 'srs', dir: undefined, demo: false });
  });

  it('prefers the fragment when both are present', () => {
    const p = parseLaunchParams(loc('#name=fromHash', '?name=fromQuery'));
    expect(p.name).toBe('fromHash');
  });

  it('ignores an invalid open value', () => {
    expect(parseLaunchParams(loc('#open=nope')).open).toBeUndefined();
  });

  it('returns empty params when there is nothing', () => {
    expect(parseLaunchParams(loc(''))).toEqual({ name: undefined, open: undefined, dir: undefined, demo: false });
  });

  it('parses ?demo from the query string', () => {
    const p = parseLaunchParams(loc('', '?demo'));
    expect(p.demo).toBe(true);
  });

  it('demo defaults to false', () => {
    const p = parseLaunchParams(loc('#name=specpad&open=srs'));
    expect(p.demo).toBe(false);
  });

  it('parses ?demo even when launcher params ride in the fragment', () => {
    const p = parseLaunchParams(loc('#name=specpad', '?demo'));
    expect(p.demo).toBe(true);
    expect(p.name).toBe('specpad');
  });

  it('parses demo from the fragment (legacy form)', () => {
    const p = parseLaunchParams(loc('#demo', ''));
    expect(p.demo).toBe(true);
  });
});
