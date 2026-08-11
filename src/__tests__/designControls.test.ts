import { describe, it, expect } from 'vitest';
import { buildDesignControls } from '../designControls';
import type { SrsDoc, VtpDoc, SddDoc, ReleasesDoc, JobRecord } from '../shared';

const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'SRS',
  items: [
    { id: 'r_1', code: 'R-1', text: 'Verified.' },
    { id: 'r_2', code: 'R-2', text: 'Unverified.' },
  ],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'VTP',
  items: [{ id: 't_1', text: 'Test', verifies: ['r_1'], expected: 'ok', result: 'passed' }],
};
const releases: ReleasesDoc = {
  schemaVersion: '1.0', type: 'releases', name: 'Acme', tagPattern: 'v*', baseline: 'v1',
  releases: [{ version: 'v1', ref: 'a', date: '2026-01-01', author: { name: 'G', email: 'g@x' }, snapshot: null }],
};
const jobs: JobRecord[] = [{ id: 'j1', code: 'JOB-1', title: 'Work', status: 'open' }];

const byKey = (els: ReturnType<typeof buildDesignControls>, k: string) => els.find((e) => e.key === k)!;

describe('buildDesignControls', () => {
  it('lists the formal elements, each with a citation and statement', () => {
    const els = buildDesignControls({ srs, vtp, jobs, releases, hasArchitecture: true });
    expect(els.map((e) => e.key)).toEqual([
      'inputs', 'outputs', 'verification', 'validation', 'traceability',
      'changes', 'dhf', 'reviews', 'risk', 'config',
    ]);
    for (const el of els) {
      expect(el.cite, `${el.key} cite`).toBeTruthy();
      expect(el.statement, `${el.key} statement`).toBeTruthy();
    }
    expect(byKey(els, 'inputs').cite).toMatch(/62304|820\.30/);
  });

  it('derives status from the project', () => {
    const els = buildDesignControls({ srs, vtp, jobs, releases, hasArchitecture: true });
    expect(byKey(els, 'inputs').status).toBe('present'); // requirements exist
    expect(byKey(els, 'verification').status).toBe('partial'); // 1 of 2 verified
    expect(byKey(els, 'changes').status).toBe('present'); // a job exists
    expect(byKey(els, 'dhf').status).toBe('present'); // a release exists
    expect(byKey(els, 'validation').status).toBe('gap'); // not built
    expect(byKey(els, 'risk').status).toBe('gap'); // not built
  });

  it('marks gaps when the project is empty', () => {
    const els = buildDesignControls({ srs: null, vtp: null, jobs: [], releases: null, hasArchitecture: false });
    expect(byKey(els, 'inputs').status).toBe('gap');
    expect(byKey(els, 'outputs').status).toBe('gap');
    expect(byKey(els, 'changes').status).toBe('gap');
  });

  it('links elements to the tab holding their evidence', () => {
    const els = buildDesignControls({ srs, vtp, jobs, releases, hasArchitecture: true });
    expect(byKey(els, 'inputs').link).toBe('srs');
    expect(byKey(els, 'verification').link).toBe('vtp');
    expect(byKey(els, 'traceability').link).toBe('trace');
    expect(byKey(els, 'changes').link).toBe('jobs');
    expect(byKey(els, 'dhf').link).toBe('releases');
    expect(byKey(els, 'validation').link).toBeUndefined();
  });
});

// Design Outputs is 62304 5.3 *and* 5.4: the architecture and the detailed design are
// one design-control element, so neither alone completes it (DC-2).
const sdd: SddDoc = {
  schemaVersion: '1.0', type: 'sdd', name: 'Acme', title: 'SDD',
  items: [
    { id: 'h_1', title: 'Units', heading: true },
    { id: 'd_1', code: 'SDD-1', title: 'auth', body: 'Design.' },
  ],
};
const designed: SrsDoc = {
  ...srs,
  items: srs.items.map((i) => ({ ...i, design: ['d_1'] })),
};

describe('buildDesignControls — Design Outputs covers architecture and detailed design', () => {
  it('is a gap with neither', () => {
    const el = byKey(buildDesignControls({ srs, vtp, hasArchitecture: false }), 'outputs');
    expect(el.status).toBe('gap');
    expect(el.detail).toMatch(/No architecture or detailed design/i);
  });

  it('is partial with the architecture alone', () => {
    const el = byKey(buildDesignControls({ srs, vtp, hasArchitecture: true }), 'outputs');
    expect(el.status).toBe('partial');
    expect(el.detail).toMatch(/no detailed design/i);
    expect(el.link).toBe('arch');
  });

  it('is partial with the detailed design alone, and links to it', () => {
    const el = byKey(buildDesignControls({ srs: designed, vtp, sdd, hasArchitecture: false }), 'outputs');
    expect(el.status).toBe('partial');
    expect(el.detail).toMatch(/no architecture document/i);
    expect(el.link).toBe('sdd');
  });

  it('is present with both, and counts the design sections', () => {
    const el = byKey(buildDesignControls({ srs: designed, vtp, sdd, hasArchitecture: true }), 'outputs');
    expect(el.status).toBe('present');
    expect(el.detail).toContain('1 design sections');
    expect(el.detail).toMatch(/every requirement traced to a design section/i);
  });

  it('reports requirements that reach no design section', () => {
    const el = byKey(buildDesignControls({ srs, vtp, sdd, hasArchitecture: true }), 'outputs');
    expect(el.status).toBe('present'); // both documents exist...
    expect(el.detail).toMatch(/2 requirement\(s\) not yet traced/); // ...but the trace is incomplete
  });

  it('does not count an empty detailed design as a design output', () => {
    const empty: SddDoc = { ...sdd, items: [{ id: 'h_1', title: 'Units', heading: true }] };
    const el = byKey(buildDesignControls({ srs, vtp, sdd: empty, hasArchitecture: true }), 'outputs');
    expect(el.status).toBe('partial');
  });
});
