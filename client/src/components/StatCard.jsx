import { Link } from 'react-router-dom';

/**
 * Dashboard summary card.
 * `variant` controls the visual treatment: default (blue icon), accent
 * (gradient), warm (amber surface).
 */
export default function StatCard({
  label,
  value,
  icon: Icon,
  footer,
  variant = 'default',
  iconTone = 'blue',
  extra = null,
  to = null
}) {
  const className =
    variant === 'accent'
      ? 'stat-card accent'
      : variant === 'warm'
        ? 'stat-card warm'
        : 'stat-card';

  const body = (
    <>
      <div className="stat-top">
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
        </div>
        {extra || (Icon ? (
          <div className={`stat-icon ${iconTone}`.trim()}>
            <Icon size={20} strokeWidth={2.1} />
          </div>
        ) : null)}
      </div>
      {footer ? <div className="stat-foot">{footer}</div> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className} style={{ textDecoration: 'none', color: 'inherit' }}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
