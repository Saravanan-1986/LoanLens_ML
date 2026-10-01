/** Compact SVG progress ring. `value` is a 0-100 percentage. */
export default function ProgressRing({
  value = 0,
  size = 74,
  stroke = 7,
  color = '#ffffff',
  trackColor = 'rgba(255,255,255,0.28)',
  label = null,
  className = ''
}) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safeValue / 100);

  return (
    <div className={`ring-wrap ${className}`.trim()} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${safeValue}%`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="ring-value" style={{ color }}>
        {label !== null ? label : `${safeValue}%`}
      </div>
    </div>
  );
}
