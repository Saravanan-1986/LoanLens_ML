'use strict';

/** Aggregate statistics shared by the agreements list and the dashboard.
 * All numbers are derived from stored records - nothing is hard-coded, and the
 * UI shows an empty state when there is nothing to summarise.
 */

const riskService = require('./riskService');

const HOUR = 60 * 60 * 1000;

/** Relative "time ago" label used in list rows and cards. */
function timeAgo(value) {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const diff = Date.now() - timestamp;
  if (diff < 60 * 1000) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 24 * HOUR) {
    const hours = Math.floor(diff / HOUR);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }
  const days = Math.floor(diff / (24 * HOUR));
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function labelForUpload(value) {
  if (!value) return 'Not available';
  const timestamp = new Date(value).getTime();
  const diff = Date.now() - timestamp;
  if (diff < 24 * HOUR) return 'Analyzed today';
  if (diff < 48 * HOUR) return 'Analyzed yesterday';
  return `Analyzed ${timeAgo(value)}`;
}

/**
 * @param {Array} agreements raw repository records
 * @returns aggregate dashboard/list statistics
 */
function buildAggregateStats(agreements = []) {
  const completed = agreements.filter((item) => item.status === 'completed');

  const totals = completed.reduce(
    (acc, item) => {
      const summary = item.riskSummary || { normal: 0, needsReview: 0, risky: 0 };
      acc.normal += summary.normal || 0;
      acc.needsReview += summary.needsReview || 0;
      acc.risky += summary.risky || 0;
      return acc;
    },
    { normal: 0, needsReview: 0, risky: 0 }
  );

  const totalClauses = totals.normal + totals.needsReview + totals.risky;

  const scored = completed.filter((item) => Number.isFinite(item.overallRiskScore));
  const averageRiskScore = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + item.overallRiskScore, 0) / scored.length)
    : 0;

  const bandCounts = completed.reduce((acc, item) => {
    const band = item.overallRisk || 'Low';
    acc[band] = (acc[band] || 0) + 1;
    return acc;
  }, {});

  return {
    documentsAnalyzed: completed.length,
    documentsUploaded: agreements.length,
    totalClauses,
    normalClauses: totals.normal,
    needsReviewClauses: totals.needsReview,
    riskyClauses: totals.risky,
    riskDistribution: { ...totals },
    averageRiskScore,
    averageRisk: riskService.riskBand(averageRiskScore),
    riskBands: {
      Low: bandCounts.Low || 0,
      Medium: bandCounts.Medium || 0,
      High: bandCounts.High || 0
    },
    hasData: completed.length > 0
  };
}

/** Shape a record for the "Recent Agreements" list / recent analysis card. */
function toRecentItem(agreement) {
  return {
    id: String(agreement.id),
    filename: agreement.filename,
    uploadedAt: agreement.uploadedAt,
    analyzedAt: agreement.analyzedAt,
    uploadedLabel: labelForUpload(agreement.uploadedAt),
    timeAgo: timeAgo(agreement.analyzedAt || agreement.uploadedAt),
    status: agreement.status,
    totalClauses: agreement.totalClauses || 0,
    overallRisk: agreement.overallRisk || 'Low',
    overallRiskScore: agreement.overallRiskScore || 0,
    riskSummary: agreement.riskSummary || { normal: 0, needsReview: 0, risky: 0 },
    isDemo: Boolean(agreement.isDemo),
    error: agreement.error || ''
  };
}

module.exports = { buildAggregateStats, toRecentItem, timeAgo, labelForUpload };
