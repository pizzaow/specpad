/**
 * ItemInfo — read-only metadata modal for an SRS/VTP item (the hamburger's
 * "View information"). Presentational; the table supplies the derived code,
 * test count, and attribution. Hazards live here now the column is gone.
 */
import React from 'react';
import type { SrsItem } from '../shared';
import type { AttributionView } from '../changeTracking';

export interface ItemInfoProps {
  item: SrsItem;
  code: string;
  testCount: number;
  attribution?: AttributionView;
  onClose: () => void;
}

const none = <span className="text-muted">(none)</span>;

const ItemInfo: React.FC<ItemInfoProps> = ({ item, code, testCount, attribution, onClose }) => (
  <div role="dialog" aria-label="Item information">
    <div
      data-testid="item-info-backdrop"
      className="modal-backdrop in"
      style={{ opacity: 0.5 }}
      onClick={onClose}
    />
    <div className="modal in" style={{ display: 'block' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <button type="button" className="close" aria-label="Close" onClick={onClose}>
              <span aria-hidden="true">&times;</span>
            </button>
            <h4 className="modal-title">{item.heading ? 'Heading' : 'Requirement'} information</h4>
          </div>
          <div className="modal-body">
            <dl className="dl-horizontal">
              <dt>ID</dt><dd>{item.id}</dd>
              <dt>Code</dt><dd>{code || none}</dd>
              <dt>Level</dt><dd>{item.level ?? 0}</dd>
              {!item.heading && (<><dt>Tests</dt><dd>{testCount}</dd></>)}
              <dt>Tags</dt><dd>{item.tags?.length ? item.tags.join(', ') : none}</dd>
              <dt>Hazards</dt><dd>{item.hazards?.length ? item.hazards.join(', ') : none}</dd>
              <dt>Added</dt>
              <dd>{attribution ? `${attribution.addedBoundary ? '≤' : ''}${attribution.addedIn}` : <span className="text-muted">(uncommitted)</span>}</dd>
              <dt>Last changed</dt>
              <dd>{attribution ? `${attribution.lastChangedIn} · ${attribution.author.name}` : <span className="text-muted">—</span>}</dd>
            </dl>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-default" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default ItemInfo;
