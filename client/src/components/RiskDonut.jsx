import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { RISK_COLORS } from '../utils/constants';
import { distributionSeries } from '../utils/risk';

function DonutTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const entry = payload[0];

  return (
    <div
      style={{
        background: '#0f172a',
        color: '#fff',
        borderRadius: 10,
        padding: '7px 11px',
        fontSize: 12,
        fontWeight: 600,
        boxShadow: '0 10px 26px rgba(15,23,42,.28)'
      }}
    >
      {entry.name}: {entry.value}
    </div>
  );
}

/**
 * Donut chart of the clause risk distribution.
 * Data always comes from the API - nothing is hard-coded.
 */
export default function RiskDonut({
  summary,
  height = 236,
  innerRadius = 64,
  outerRadius = 92,
  centerTop = 'Clauses',
  centerValue
}) {
  const series = distributionSeries(summary);
  const data = series.filter((entry) => entry.value > 0);

  if (!data.length) {
    return (
      <div
        className="center"
        style={{ height, color: 'var(--ink-400)', fontSize: 13, textAlign: 'center' }}
      >
        No clauses analysed yet.
      </div>
    );
  }

  return (
    <div className="donut-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={3}
            stroke="none"
            startAngle={90}
            endAngle={-270}
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={RISK_COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="donut-center">
        <div>
          <div className="donut-value">{centerValue}</div>
          <div className="donut-label">{centerTop}</div>
        </div>
      </div>
    </div>
  );
}
