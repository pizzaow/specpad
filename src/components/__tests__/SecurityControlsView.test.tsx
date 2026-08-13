import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SecurityControlsView from '../SecurityControlsView';
import type { SrsDoc, ThreatDoc, VtpDoc } from '../../shared';

/**
 * The Controls tab (JOB-56).
 *
 * The grouping is the argument: "we have security requirements" is not a coverage claim,
 * and the sweep across FDA's eight categories is what turns it into one. So the view must
 * show an empty category rather than hide it, and must not silently drop a requirement the
 * threat model leans on but which says nothing about which control it is.
 */

const srs: SrsDoc = {
  schemaVersion: '1.0', type: 'srs', name: 'Acme', title: 'SRS',
  items: [
    { id: 'r_1', code: 'AUTH-1', text: 'Identity shall be asserted by a trusted peer.', securityControl: ['authentication'] },
    { id: 'r_2', code: 'AUTH-5', text: 'A role shall be resolved per project.', securityControl: ['authorization', 'confidentiality'] },
    { id: 'r_3', code: 'ORD-1', text: 'An unrelated requirement.' },
    { id: 'r_4', code: 'SEC-9', text: 'Named as a control but uncategorised.' },
  ],
};
const threat: ThreatDoc = {
  schemaVersion: '1.0', type: 'threat', name: 'Acme', title: 'Threats',
  items: [
    { id: 'x_1', code: 'THR-1', text: 'Spoofed header.', controls: ['r_1', 'r_4'] },
    { id: 'x_2', code: 'THR-3', text: 'Cross-project read.', controls: ['r_2'] },
  ],
};
const vtp: VtpDoc = {
  schemaVersion: '1.0', type: 'vtp', name: 'Acme', title: 'VTP',
  items: [{ id: 't_1', text: 'Assert a header.', verifies: ['r_1'], expected: 'Refused.' }],
};

describe('SecurityControlsView', () => {
  it('groups controls under every FDA category, including the empty ones', () => {
    render(<SecurityControlsView srs={srs} threat={threat} vtp={vtp} />);
    for (const label of ['Authentication', 'Authorization', 'Cryptography', 'Code, data and execution integrity',
      'Confidentiality', 'Event detection and logging', 'Resiliency and recovery', 'Updatability and patchability']) {
      expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
    }
    // An empty category is a question the view asks rather than a row it omits.
    expect(screen.getAllByText(/That is a question to answer once/).length).toBeGreaterThan(0);
    expect(screen.getByText(/3 of 8 categories have a control/)).toBeInTheDocument();
  });

  it('lists a requirement under each category it serves', () => {
    render(<SecurityControlsView srs={srs} threat={threat} vtp={vtp} />);
    // AUTH-5 is both authorization and confidentiality, so it appears under both.
    expect(screen.getAllByText('AUTH-5')).toHaveLength(2);
    expect(screen.getAllByText('AUTH-1')).toHaveLength(1);
  });

  it('shows which threats each control answers, and whether it is verified', () => {
    render(<SecurityControlsView srs={srs} threat={threat} vtp={vtp} />);
    expect(screen.getByText('Answers THR-1')).toBeInTheDocument();
    expect(screen.getByText('verified')).toBeInTheDocument();   // AUTH-1 has a test
    expect(screen.getAllByText('no test').length).toBeGreaterThan(0); // AUTH-5 has none
  });

  it('surfaces a control the threat model relies on that names no category', () => {
    render(<SecurityControlsView srs={srs} threat={threat} vtp={vtp} />);
    // SEC-9 would otherwise vanish from the coverage argument entirely.
    expect(screen.getByText(/do not say which control category/)).toBeInTheDocument();
    expect(screen.getByText(/SEC-9/)).toBeInTheDocument();
  });

  it('does not list a requirement that is not a security control at all', () => {
    render(<SecurityControlsView srs={srs} threat={threat} vtp={vtp} />);
    expect(screen.queryByText('ORD-1')).toBeNull();
  });
});
