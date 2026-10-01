import { RISK_COLORS } from '../utils/constants';
import { distributionSeries } from '../utils/risk';

/** Stacked horizontal bar showing Normal / Needs Review / Risky shares. */
export default function DistributionBar({ summary, total, height = 12 }) {
  const series = distributionSeries(summary);
  const safeTotal = Math.max(1, Number(total) || series.reduce((sum, e) => sum + e.value, 0) || 1);

  return (
    <div>
      <div className="dist-bar" style={{ height }} role="img" aria-label="Clause risk distribution">
        {series.map((entry) =>
          entry.value > 0 ? (
            <span
              key={entry.key}
              style={{ width: `${(entry.value / safeTotal) * 100}%`, background: RISK_COLORS[entry.name] }}
              title={`${entry.name}: ${entry.value}`}
            />
          ) : null
        )}
      </div>
      <div className="legend-list" style={{ marginTop: 12 }}>
        {series.map((entry) => (
          <div className="legend-row" key={entry.key}>
            <span className="legend-dot" style={{ background: RISK_COLORS[entry.name] }} />
            <span className="legend-name">{entry.name}</span>
            <span className="legend-value">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
