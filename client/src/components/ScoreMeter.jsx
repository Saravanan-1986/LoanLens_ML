import { bandClass } from '../utils/risk';

/**
 * Overall risk score display: big number, Low/Medium/High badge and a
 * segmented bar. `formula` is the transparent backend scoring formula.
 */
export default function ScoreMeter({ score = 0, band = 'Low', formula = '', compact = false }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));

  return (
    <div className="score-panel">
      <div
        className="score-ring"
        role="img"
        aria-label={`Overall risk ${band}, score ${value} out of 100`}
      >
        <svg viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--line)" strokeWidth="11" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="currentColor"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 52}
            strokeDashoffset={2 * Math.PI * 52 * (1 - value / 100)}
            transform="rotate(-90 60 60)"
            className={bandClass(band)}
            style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)' }}
          />
        </svg>
        <div className={`score-ring-value ${bandClass(band)}`}>
          {value}
          <span className="score-ring-max">/ 100</span>
        </div>
      </div>

      <div className="score-meta">
        <div className="score-label">Overall Risk Score</div>
        <div className="row row-gap-2 wrap" style={{ margin: '6px 0 8px' }}>
          <span className={`pill ${bandClass(band)}`}>{band} risk</span>
          {!compact && value >= 0 ? (
            <span className="text-xs muted">
              {value < 25 ? 'Mostly standard wording' : value < 55 ? 'Several clauses deserve a closer look' : 'High-risk patterns detected'}
            </span>
          ) : null}
        </div>
        {formula ? <p className="text-xs muted mono" style={{ maxWidth: 420 }}>{formula}</p> : null}
      </div>
    </div>
  );
}
