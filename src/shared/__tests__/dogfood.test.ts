import { describe, it, expect } from 'vitest';
import { validate } from '../validate';
import { checkGovernance } from '../governance';
import proj from '../../../docs/specpad/specpad.proj.json';
import srs from '../../../docs/specpad/specpad.srs.json';
import vtp from '../../../docs/specpad/specpad.vtp.json';
import type { SrsDoc, VtpDoc } from '../schema';

// SpecPad documents its own requirements and tests with SpecPad (dogfooding).
// These must stay structurally valid and governance-clean, exactly like any
// project the skill or editor governs.
describe('SpecPad self-documentation (dogfood)', () => {
  it('passes structural validation for every document', () => {
    expect(validate(proj)).toEqual([]);
    expect(validate(srs)).toEqual([]);
    expect(validate(vtp)).toEqual([]);
  });

  it('passes governance with no violations', () => {
    expect(checkGovernance({ srs: srs as SrsDoc, vtp: vtp as VtpDoc })).toEqual([]);
  });
});
