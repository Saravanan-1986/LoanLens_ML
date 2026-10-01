import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { RISK } from '../utils/constants';
import { normaliseClass } from '../utils/risk';

const ICONS = {
  [RISK.NORMAL]: CheckCircle2,
  [RISK.REVIEW]: AlertTriangle,
  [RISK.RISKY]: ShieldAlert
};

const CLASSES = {
  [RISK.NORMAL]: 'badge badge-normal',
  [RISK.REVIEW]: 'badge badge-review',
  [RISK.RISKY]: 'badge badge-risky'
};

const SIZES = { sm: 12, md: 13, lg: 15 };

/** Consistent green / amber / red badge for a clause or document. */
export default function RiskBadge({ classification, showIcon = true, size = 'md', className = '' }) {
  const value = normaliseClass(classification);
  const Icon = ICONS[value] || ICONS[RISK.REVIEW];
  const iconSize = SIZES[size] || SIZES.md;

  return (
    <span className={`${CLASSES[value]} ${className}`.trim()}>
      {showIcon ? <Icon size={iconSize} strokeWidth={2.4} /> : null}
      {value}
    </span>
  );
}
