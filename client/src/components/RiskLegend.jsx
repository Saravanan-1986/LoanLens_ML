import { distributionSeries } from '../utils/risk';
import { RISK_COLORS } from '../utils/constants';

/** Colour key for the three clause classes. */
export default function RiskLegend({ summary, showZero = true }) {
  const series = distributionSeries(summary).filter((entry) => showZero || entry.value > 0);
  const total = series.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="legend-list">
      {series.map((entry) => (
        <div className="legend-row" key={entry.key}>
          <span className="legend-dot" style={{ background: RISK_COLORS[entry.name] }} />
          <span className="legend-name">{entry.name}</span>
          <span className="legend-value">{entry.value}</span>
        </div>
      ))}
      {total > 0 ? (
        <div className="legend-row">
          <span className="legend-dot" style={{ background: 'var(--ink-300)' }} />
          <span className="legend-name">Total clauses</span>
          <span className="legend-value">{total}</span>
        </div>
      ) : null}
    </div>
  );
}
