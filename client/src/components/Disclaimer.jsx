import { Info } from 'lucide-react';
import { DISCLAIMER, SHORT_DISCLAIMER } from '../utils/constants';

/**
 * The awareness/screening disclaimer. Shown on the dashboard, the report and in
 * settings so the positioning is always visible.
 */
export default function Disclaimer({ text = SHORT_DISCLAIMER, full = false, className = '' }) {
  return (
    <div className={`disclaimer-bar ${className}`.trim()}>
      <Info size={15} strokeWidth={2.2} />
      <span>{full ? DISCLAIMER : text}</span>
    </div>
  );
}
