import { describe, it, expect } from 'vitest';
import { checkCommit, buildCommitMessage, commitAuthor } from '../commitGate';
import type { CommitGateInput } from '../commitGate';
import type { SrsDoc, VtpDoc } from '../../src/shared';

// CMT-4/CMT-5: the client is not trusted. Everything here runs server-side.

const srs: SrsDoc = {
  schemaVersion: '1.0',
  type: 'srs',
  name: 'acme',
  title: 'Requirements',
  items: [{ id: 'r_1', text: 'The system shall work.' }],
};

const vtp: VtpDoc = {
  schemaVersion: '1.0',
  type: 'vtp',
  name: 'acme',
  title: 'Tests',
  items: [{ id: 't_1', text: 'Confirm it works.', verifies: ['r_1'], expected: 'It works.' }],
};

function input(overrides: Partial<CommitGateInput> = {}): CommitGateInput {
  return {
    changed: [{ path: 'docs/specpad/acme.srs.json', doc: srs }],
    bundle: { srs, vtp },
    stagedPaths: ['docs/specpad/acme.srs.json'],
    allowlist: ['docs/specpad'],
    activeJobs: ['j_123'],
    policy: { requireActiveJob: true, requireGovernanceClean: 'block', pushRetries: 3 },
    ...overrides,
  };
}

describe('checkCommit — a clean commit', () => {
  it('permits a valid, governance-clean, attributed commit', () => {
    const result = checkCommit(input());

    expect(result).toEqual({ ok: true, blocked: [], warnings: [], governance: [] });
  });
});

describe('checkCommit — structural validity', () => {
  it('never commits a structurally invalid document, whatever the policy', () => {
    const broken = { schemaVersion: '1.0', type: 'srs', name: 'acme' }; // no title, no items

    const result = checkCommit(
      input({
        changed: [{ path: 'docs/specpad/acme.srs.json', doc: broken }],
        policy: { requireActiveJob: false, requireGovernanceClean: 'off', pushRetries: 3 },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.blocked.join('\n')).toMatch(/acme\.srs\.json is not a valid SpecPad document/);
  });
});

describe('checkCommit — governance policy (CMT-4)', () => {
  // An unverified requirement: the classic traceability violation.
  const unverified = { ...srs, items: [...srs.items, { id: 'r_2', text: 'Also shall work.' }] };

  it('blocks a governance violation under the blocking policy', () => {
    const result = checkCommit(input({ bundle: { srs: unverified, vtp } }));

    expect(result.ok).toBe(false);
    expect(result.blocked.join('\n')).toMatch(/traceability: Requirement r_2 has no verifying test/);
    expect(result.warnings).toEqual([]);
  });

  it('permits the same commit under the warning policy, but reports it', () => {
    const result = checkCommit(
      input({
        bundle: { srs: unverified, vtp },
        policy: { requireActiveJob: true, requireGovernanceClean: 'warn', pushRetries: 3 },
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.warnings.join('\n')).toMatch(/traceability: Requirement r_2/);
    expect(result.governance).toHaveLength(1);
  });

  it('skips governance entirely when the policy is off', () => {
    const result = checkCommit(
      input({
        bundle: { srs: unverified, vtp },
        policy: { requireActiveJob: true, requireGovernanceClean: 'off', pushRetries: 3 },
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.governance).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('reports a test with no expected result', () => {
    const noExpected = { ...vtp, items: [{ id: 't_1', text: 'Confirm.', verifies: ['r_1'] }] };

    const result = checkCommit(input({ bundle: { srs, vtp: noExpected } }));

    expect(result.blocked.join('\n')).toMatch(/missing-expected/);
  });
});

describe('checkCommit — attribution (CMT-5)', () => {
  it('refuses a commit with no active job when policy requires one', () => {
    const result = checkCommit(input({ activeJobs: [] }));

    expect(result.ok).toBe(false);
    expect(result.blocked).toContain(
      'No active job is set. Choose the job this change belongs to before committing.',
    );
  });

  it('permits a commit with no active job when policy does not require one', () => {
    const result = checkCommit(
      input({
        activeJobs: [],
        policy: { requireActiveJob: false, requireGovernanceClean: 'block', pushRetries: 3 },
      }),
    );

    expect(result.ok).toBe(true);
  });
});

describe('checkCommit — path confinement (SRV-2)', () => {
  it('refuses a commit staging anything outside the allowlist, whatever the policy', () => {
    const result = checkCommit(
      input({
        stagedPaths: ['docs/specpad/acme.srs.json', 'src/index.tsx'],
        policy: { requireActiveJob: false, requireGovernanceClean: 'off', pushRetries: 3 },
      }),
    );

    expect(result.ok).toBe(false);
    expect(result.blocked).toContain(
      '"src/index.tsx" is outside the allowlisted paths and may not be committed.',
    );
  });
});

describe('buildCommitMessage (CMT-5)', () => {
  it('appends one Job trailer per active job, in a single trailing block', () => {
    const message = buildCommitMessage('Clarify the retention requirement', ['j_123', 'j_456']);

    expect(message).toBe('Clarify the retention requirement\n\nJob: j_123\nJob: j_456\n');
  });

  it('emits no trailer block when there is no active job', () => {
    expect(buildCommitMessage('Fix a typo', [])).toBe('Fix a typo\n');
  });

  it('keeps the trailers in one unbroken block git can parse', () => {
    // Git wants a blank line *before* the trailer block, and none *inside* it.
    const message = buildCommitMessage('Subject', ['j_1', 'j_2', 'j_3']);
    const lines = message.trimEnd().split('\n');
    const firstTrailer = lines.findIndex((l) => l.startsWith('Job: '));

    expect(lines[firstTrailer - 1]).toBe('');
    expect(lines.slice(firstTrailer)).toEqual(['Job: j_1', 'Job: j_2', 'Job: j_3']);
  });

  it('does not double the separator when the subject already ends in a newline', () => {
    expect(buildCommitMessage('Subject\n', ['j_1'])).toBe('Subject\n\nJob: j_1\n');
  });
});

describe('commitAuthor (AUTH-6)', () => {
  it('formats the authenticated human as the git author', () => {
    expect(commitAuthor({ displayName: 'Jane Smith', email: 'jane@corp.example' })).toBe(
      'Jane Smith <jane@corp.example>',
    );
  });
});
