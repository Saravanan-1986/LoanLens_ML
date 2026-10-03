import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Trash2 } from 'lucide-react';

import { bandBadgeClass } from '../utils/risk';
import { fileStem, formatDate, pluralize, timeAgo } from '../utils/format';

/** Row card used on the agreements / reports / history pages. */
export default function AgreementCard({ agreement, onDelete, deleting = false, linkTo = null }) {
  const detailTo = linkTo || `/agreements/${agreement.id}`;
  const summary = agreement.riskSummary || { normal: 0, needsReview: 0, risky: 0 };

  return (
    <article className="card agreement-card">
      <div className="card-body">
        <div className="list-row" style={{ padding: 0, border: 0 }}>
          <div className="file-chip">
            <FileText size={19} />
          </div>
          <div className="row-main">
            <div className="row row-gap-2 wrap">
              <Link to={detailTo} className="row-title" style={{ textDecoration: 'none', color: 'inherit' }}>
                {fileStem(agreement.filename)}
              </Link>
            </div>
            <div className="row-meta">
              {pluralize(agreement.totalClauses || 0, 'clause')} • {timeAgo(agreement.analyzedAt || agreement.uploadedAt)}
              {' '}• {agreement.fileSizeLabel || ''} • Uploaded {formatDate(agreement.uploadedAt)}
            </div>
            <div className="row row-gap-2 wrap" style={{ marginTop: 8 }}>
              <span className={bandBadgeClass(agreement.overallRisk)}>{agreement.overallRisk || 'Low'} risk</span>
              <span className="text-xs muted">
                {summary.risky || 0} risky • {summary.needsReview || 0} needs review • {summary.normal || 0} normal
              </span>
            </div>
          </div>
          <div className="row-side" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div className={`text-xl ${String(agreement.overallRisk || 'Low').toLowerCase() === 'high' ? 'band-high' : String(agreement.overallRisk).toLowerCase() === 'medium' ? 'band-medium' : 'band-low'}`}>
              {agreement.overallRiskScore ?? 0}
              <span className="muted-2" style={{ fontSize: 13, fontWeight: 600 }}>/100</span>
            </div>
            <div className="row row-gap-2">
              {onDelete ? (
                <button
                  type="button"
                  className="icon-btn danger"
                  title="Delete agreement"
                  aria-label={`Delete ${agreement.filename}`}
                  disabled={deleting}
                  onClick={() => onDelete(agreement)}
                >
                  <Trash2 size={16} />
                </button>
              ) : null}
              <Link className="view-link" to={`/report/${agreement.id}`}>
                View
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
