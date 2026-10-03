import { ArrowRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

import RiskBadge from './RiskBadge';
import { fileStem, pluralize, timeAgo } from '../utils/format';

const TONES = { High: 'risky', Medium: 'review', Low: 'normal' };

/** "Recent Agreements" list - mirrors the reference UI's activity column. */
export default function RecentAgreementsList({ agreements = [] }) {
  if (!agreements.length) {
    return (
      <p className="muted text-sm" style={{ padding: '8px 4px' }}>
        No agreements yet. Analyse your first document to see it here.
      </p>
    );
  }

  return (
    <div>
      {agreements.map((agreement) => {
        const tone = TONES[agreement.overallRisk] || 'normal';
        return (
          <div className="list-row" key={agreement.id}>
            <div className={`file-chip ${tone}`} style={{ width: 40, height: 40, borderRadius: 12 }}>
              <FileText size={18} strokeWidth={2} />
            </div>

            <div className="row-main">
              <div className="row-title truncate">{fileStem(agreement.filename)}</div>
              <div className="row-meta">
                {pluralize(agreement.totalClauses || 0, 'clause')} &bull;{' '}
                {timeAgo(agreement.analyzedAt || agreement.uploadedAt)}
              </div>
            </div>

            <div className="row-side">
              <span className="hide-sm">
                <RiskBadge classification={tone} showIcon={false} size="sm" />
              </span>
              <Link className="view-link" to={`/report/${agreement.id}`}>
                View
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        );
      })}

      <div style={{ paddingTop: 10 }}>
        <Link className="view-link" to="/agreements">
          See all agreements
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
