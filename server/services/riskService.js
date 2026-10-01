'use strict';

/**
 * Risk scoring + rule/ML combination logic.
 *
 * Everything that decides "how risky" a clause or document is lives here so the
 * formula can be tuned in one place. The Python ML service mirrors this logic
 * for standalone use, but the Node service is the single source of truth for
 * persisted scores.
 */

const { matchRules } = require('../rules/riskRules');

const CLASSES = ['Normal', 'Needs Review', 'Risky'];

/** Clause severity weights used by the document score. */
const CLAUSE_WEIGHTS = { Normal: 0, 'Needs Review': 3, Risky: 10 };

/** Highest possible weight for a single clause (all-risky document = 100). */
const MAX_CLAUSE_WEIGHT = 10;

/**
 * Amplifier applied before rounding.
 *
 * Loan agreements are dense documents where a small number of dangerous
 * clauses can matter far more than their share of the page count, so the raw
 * weighted ratio is scaled up. Section 28 of the specification asks us to
 * prioritise avoiding missed risky clauses, which is why the final value is
 * rounded up (Math.ceil) instead of down.
 *
 * Tuned so that a mostly-standard agreement stays "Low", a normal retail loan
 * with a handful of flagged clauses lands in "Medium", and an agreement where
 * risky clauses are a large share of the document reaches "High".
 */
const RISK_AMPLIFIER = 1.3;

/** Score bands used for the qualitative label. */
const RISK_BANDS = [
  { max: 24, label: 'Low' },
  { max: 59, label: 'Medium' },
  { max: 100, label: 'High' }
];

/** Classification contributed by a rule match alone. */
const RULE_LEVEL = { HIGH: 'Risky', MEDIUM: 'Needs Review', LOW: 'Needs Review' };

/** Confidence floor assigned to rule-only matches. */
const RULE_CONFIDENCE = { HIGH: 0.92, MEDIUM: 0.78, LOW: 0.64 };

const RANK = { Normal: 0, 'Needs Review': 1, Risky: 2 };

/** Default classifier output when the ML service produced nothing. */
const NEUTRAL_ML = {
  classification: 'Needs Review',
  confidence: 0.5,
  reason: '',
  category: 'Uncategorised'
};

/** Accept the many spellings a classifier/rule may return. */
function normaliseClass(value) {
  if (!value) return null;
  const cleaned = String(value).trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (cleaned === 'risky' || cleaned === 'high' || cleaned === 'high risk') return 'Risky';
  if (cleaned === 'normal' || cleaned === 'low' || cleaned === 'low risk') return 'Normal';
  if (
    cleaned.includes('review') ||
    cleaned === 'medium' ||
    cleaned === 'moderate' ||
    cleaned === 'medium risk'
  ) {
    return 'Needs Review';
  }
  return null;
}

/**
 * Combine a rule-engine match with the classifier output into the final
 * classification for a single clause.
 *
 * Rules and ML stay reported separately on the clause so the report can show
 * exactly which engine produced which signal.
 */
function combineClause(ruleMatch, ml) {
  const mlResult = { ...NEUTRAL_ML, ...(ml || {}) };
  mlResult.classification = normaliseClass(mlResult.classification) || NEUTRAL_ML.classification;

  const ruleLevel = ruleMatch ? RULE_LEVEL[ruleMatch.severity] || 'Needs Review' : 'Normal';

  // Conservative merge: the more severe signal wins, so a rule match is never
  // diluted by a confident-looking classifier.
  let finalClass =
    RANK[ruleLevel] >= RANK[mlResult.classification] ? ruleLevel : mlResult.classification;

  // A medium severity rule escalates when the classifier also sees risk.
  if (ruleMatch && ruleMatch.severity === 'MEDIUM' && mlResult.classification === 'Risky') {
    finalClass = 'Risky';
  }

  // An unconfident "Normal" prediction becomes Needs Review instead of being
  // silently passed through.
  if (!ruleMatch && mlResult.classification === 'Normal' && mlResult.confidence < 0.6) {
    finalClass = 'Needs Review';
  }

  const ruleConfidence = ruleMatch ? RULE_CONFIDENCE[ruleMatch.severity] || 0.6 : 0;
  const mlConfidence = Number.isFinite(mlResult.confidence) ? mlResult.confidence : 0;

  return {
    classification: finalClass,
    confidence: Number(Math.max(ruleConfidence, mlConfidence).toFixed(2)),
    reason: ruleMatch
      ? ruleMatch.explanation
      : mlResult.reason ||
        'The classifier could not confidently categorise this clause, so it is listed for review.',
    riskCategory: ruleMatch ? ruleMatch.category : mlResult.category || 'Uncategorised',
    ruleId: ruleMatch ? ruleMatch.ruleId : '',
    ruleSeverity: ruleMatch ? ruleMatch.severity : '',
    ruleMatched: Boolean(ruleMatch),
    ruleName: ruleMatch ? ruleMatch.name : '',
    ruleResult: ruleLevel,
    regulatoryReference: ruleMatch ? ruleMatch.regulatoryReference || '' : '',
    regulatoryVerified: ruleMatch ? Boolean(ruleMatch.regulatoryVerified) : false,
    mlResult: mlResult.classification,
    mlConfidence: Number(mlConfidence.toFixed(2))
  };
}

/** Count clauses per class. */
function summarise(clauses = []) {
  const summary = { normal: 0, needsReview: 0, risky: 0 };
  for (const clause of clauses) {
    const cls = normaliseClass(clause.classification) || 'Needs Review';
    if (cls === 'Risky') summary.risky += 1;
    else if (cls === 'Normal') summary.normal += 1;
    else summary.needsReview += 1;
  }
  return summary;
}

/**
 * Transparent document level risk score (0-100).
 *
 *   weighted   = Σ clause weight           (Normal 0, Needs Review 3, Risky 10)
 *   ratio      = weighted / (clauses × 10)
 *   riskScore  = ceil(ratio × 100 × RISK_AMPLIFIER)  clamped to 0..100
 */
function calculateRiskScore(clauses = []) {
  const total = clauses.length;
  if (!total) return 0;

  const weighted = clauses.reduce((sum, clause) => {
    const cls = normaliseClass(clause.classification) || 'Needs Review';
    return sum + (CLAUSE_WEIGHTS[cls] || 0);
  }, 0);

  const ratio = weighted / (total * MAX_CLAUSE_WEIGHT);
  return Math.max(0, Math.min(100, Math.ceil(ratio * 100 * RISK_AMPLIFIER)));
}

/** Map a numeric score to its Low / Medium / High band. */
function riskBand(score) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const band = RISK_BANDS.find((entry) => value <= entry.max);
  return band ? band.label : 'High';
}

/** Convenience helper: score + band + summary in one call. */
function evaluateDocument(clauses = []) {
  const riskSummary = summarise(clauses);
  const overallRiskScore = calculateRiskScore(clauses);
  return {
    riskSummary,
    overallRiskScore,
    overallRisk: riskBand(overallRiskScore),
    formula: {
      clauseWeights: CLAUSE_WEIGHTS,
      amplifier: RISK_AMPLIFIER,
      rounding: 'ceil',
      note:
        'Score = ceil( Σ clause weight / (clauses x 10) x 100 x 1.3 ). It is an awareness signal, not a legal determination.'
    }
  };
}

module.exports = {
  CLASSES,
  CLAUSE_WEIGHTS,
  RISK_AMPLIFIER,
  RISK_BANDS,
  normaliseClass,
  combineClause,
  summarise,
  calculateRiskScore,
  riskBand,
  evaluateDocument,
  matchRules
};

