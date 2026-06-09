/**
 * VersionHistoryDialog — on-demand modal showing the release timeline
 * (from VersionTimeline), opened from the menu bar's version chip.
 */
import React from 'react';
import type { ReleasesDoc } from '../shared';
import VersionTimeline from './VersionTimeline';

interface VersionHistoryDialogProps {
  releases: ReleasesDoc | null;
  onClose: () => void;
}

const VersionHistoryDialog: React.FC<VersionHistoryDialogProps> = ({ releases, onClose }) => (
  <div role="dialog" aria-label="Version history">
    <div data-testid="version-dialog-backdrop" className="modal-backdrop in" style={{ opacity: 0.5 }} onClick={onClose} />
    <div className="modal in" style={{ display: 'block' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <button type="button" className="close" aria-label="Close" onClick={onClose}>
              <span aria-hidden="true">&times;</span>
            </button>
            <h4 className="modal-title">Version history</h4>
          </div>
          <div className="modal-body">
            {releases && releases.releases.length > 0 ? (
              <VersionTimeline releases={releases} />
            ) : (
              <p className="text-muted">No version history yet — run <code>specpad refresh</code> to capture release snapshots.</p>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-default" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default VersionHistoryDialog;
