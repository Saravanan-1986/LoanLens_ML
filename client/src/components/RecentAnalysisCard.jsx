import { ArrowRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

import RiskBadge from './RiskBadge';
import { bandClass } from '../utils/risk';
import { fileStem, timeAgo, pluralize } from '../utils/format';

/**
 * Large "Recent Agreement Analysis" card for the dashboard.
 * All values come from the API.
 */
export default function RecentAnalysisCard({ analysis }) {
  if (!analysis) return null;

  const summary = analysis.riskSummary || { normal: 0, needsReview: 0, risky: 0 };

  return (
    <div className="card">
      <div className="card-head">
        <h3>Recent Agreement Analysis</h3>
        <RiskBadge classification={
          analysis.overallRisk === 'High' ? 'Risky' : analysis.overallRisk === 'Medium' ? 'Needs Review' : 'Normal'
        } />
      </div>

      <div className="card-body stack-4">
        <div className="analysis-hero">
          <div className="analysis-file">
            <div className="file-chip">
              <FileText size={22} strokeWidth={2} />
            </div>
            <div className="grow">
              <div className="row row-gap-2 wrap" style={{ marginBottom: 4 }}>
                <span className="strong" style={{ fontSize: 15 }}>
                  {fileStem(analysis.filename)}
                </span>
              </div>
              <div className="meta-row">
                <span>{analysis.uploadedLabel || timeAgo(analysis.analyzedAt)}</span>
                <span className="sep" />
                <span>{pluralize(analysis.totalClauses || 0, 'clause')}</span>
                <span className="sep" />
                <span>Overall risk {analysis.overallRisk || 'Low'}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="score-label">Risk score</div>
            <div className={`text-xl ${bandClass(analysis.overallRisk)}`}>
              {analysis.overallRiskScore ?? 0}
              <span className="muted-2" style={{ fontSize: 15, fontWeight: 600 }}>
                {' '}
                / 100
              </span>
            </div>
          </div>
        </div>

        <div className="risk-counts">
          <div className="risk-count risky">
            <span className="n">{summary.risky || 0}</span>
            <span className="l">Risky</span>
          </div>
          <div className="risk-count review">
            <span className="n">{summary.needsReview || 0}</span>
            <span className="l">Needs review</span>
          </div>
          <div className="risk-count normal">
            <span className="n">{summary.normal || 0}</span>
            <span className="l">Normal</span>
          </div>
        </div>

        <div className="row-between wrap row-gap-3">
          <span className="text-xs muted">
            {`Engine: ${analysis.analysisSource || 'analysis pipeline'}`}
          </span>
          <Link className="btn btn-primary btn-sm" to={`/report/${analysis.id}`}>
            View report
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
