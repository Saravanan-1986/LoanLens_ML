import { FlaskConical } from 'lucide-react';

/** Marks records created by the demo seeder so they are never mistaken for real analysis. */
export default function DemoBadge({ compact = false, className = '' }) {
  return (
    <span className={`badge badge-demo ${className}`.trim()} title="Illustrative sample data, not a real analysis">
      <FlaskConical size={12} strokeWidth={2.4} />
      {compact ? 'Demo' : 'Demo data'}
    </span>
  );
}
