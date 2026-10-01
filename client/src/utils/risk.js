/** Risk vocabulary helpers shared by every risk-aware component. */

import { RISK, RISK_COLORS, BAND_COLORS } from './constants';

/** Normalise any API value into one of the three canonical classes. */
export function normaliseClass(value) {
  if (!value) return RISK.REVIEW;
  const cleaned = String(value).trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (cleaned === 'risky' || cleaned === 'high' || cleaned === 'high risk') return RISK.RISKY;
  if (cleaned === 'normal' || cleaned === 'low' || cleaned === 'low risk') return RISK.NORMAL;
  return RISK.REVIEW;
}

/** CSS tone used by badges and cards: normal | review | risky. */
export function riskTone(classification) {
  const value = normaliseClass(classification);
  if (value === RISK.RISKY) return 'risky';
  if (value === RISK.NORMAL) return 'normal';
  return 'review';
}

export function riskColor(classification) {
  return RISK_COLORS[normaliseClass(classification)] || RISK_COLORS['Needs Review'];
}

/** Badge classes for a risk classification. */
export function riskBadgeClass(classification) {
  const tone = riskTone(classification);
  if (tone === 'risky') return 'badge badge-risky';
  if (tone === 'normal') return 'badge badge-normal';
  return 'badge badge-review';
}

/** CSS class for a Low / Medium / High band. */
export function bandClass(band) {
  const value = String(band || '').toLowerCase();
  if (value === 'high') return 'band-high';
  if (value === 'medium') return 'band-medium';
  return 'band-low';
}

export function bandColor(band) {
  return BAND_COLORS[band] || BAND_COLORS.Low;
}

export function bandBadgeClass(band) {
  const value = String(band || '').toLowerCase();
  if (value === 'high') return 'badge badge-risky';
  if (value === 'medium') return 'badge badge-review';
  return 'badge badge-normal';
}

/** How many of the document's clauses are risky, as a 0-100 integer. */
export function riskyShare(summary = {}, total = 0) {
  const risky = Number(summary.risky || 0);
  if (!total) return 0;
  return Math.round((risky / total) * 100);
}

/** Build the array used by the donut / bar charts. */
export function distributionSeries(summary = {}) {
  return [
    { name: RISK.NORMAL, value: Number(summary.normal || 0), key: 'normal' },
    { name: RISK.REVIEW, value: Number(summary.needsReview || 0), key: 'review' },
    { name: RISK.RISKY, value: Number(summary.risky || 0), key: 'risky' }
  ];
}

/** Short "why" label for a clause, used in list rows. */
export function riskReasonLabel(clause) {
  if (!clause) return '';
  if (clause.ruleName) return clause.ruleName;
  if (clause.riskCategory && clause.riskCategory !== 'Uncategorised') return clause.riskCategory;
  return normaliseClass(clause.classification);
}
