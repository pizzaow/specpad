import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { checkGovernance } from '../governance';
import proj from '../fixtures/AcmeApp.proj.json';
import srs from '../fixtures/AcmeApp.srs.json';
import vtp from '../fixtures/AcmeApp.vtp.json';
import badSrs from '../fixtures/invalid.srs.missing-text.json';
import type { SrsDoc, VtpDoc } from '../schema';

describe('golden fixtures', () => {
  it('valid fixtures pass structural validation', () => {
    expect(validate(proj)).toEqual([]);
    expect(validate(srs)).toEqual([]);
    expect(validate(vtp)).toEqual([]);
  });

  it('the valid bundle passes governance', () => {
    expect(checkGovernance({ srs: srs as SrsDoc, vtp: vtp as VtpDoc })).toEqual([]);
  });

  it('the invalid srs fixture fails structural validation', () => {
    expect(validate(badSrs).length).toBeGreaterThan(0);
  });
});
