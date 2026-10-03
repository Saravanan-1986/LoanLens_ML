'use strict';

/**
 * Document (agreement) level plain-English summary.
 *
 * Alongside the clause-by-clause report, every analysed agreement gets a short
 * executive summary that a person can read in a few seconds: what the document
 * is, how risky it is overall and which areas to look at first.
 *
 * The summary is derived purely from the clause decisions that were already
 * made by the rule engine + ML classifier, so it never invents facts, amounts
 * or obligations that are not present in the analysed clauses.
 */

const riskService = require('./riskService');

const MODEL_NAME = 'loanlens-document-summary (derived from clause analysis)';
const MAX_HIGHLIGHTS = 5;
const MAX_HIGHLIGHT_CHARS = 160;

/** Count risk categories for flagged (non-normal) clauses, highest first. */
function categoryCounts(clauses) {
  const counts = new Map();
  for (const clause of clauses) {
    const classification = riskService.normaliseClass(clause.classification);
    if (classification === 'Normal') continue;
    const key = clause.riskCategory || 'Uncategorised';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Pick the riskiest clauses (Risky first, then by confidence). */
function topRiskyClauses(clauses) {
  const rank = { Risky: 2, 'Needs Review': 1, Normal: 0 };
  return clauses
    .filter((clause) => (riskService.normaliseClass(clause.classification) || 'Needs Review') !== 'Normal')
    .sort((a, b) => {
      const diff = (rank[b.classification] || 0) - (rank[a.classification] || 0);
      if (diff !== 0) return diff;
      return (b.confidence || 0) - (a.confidence || 0);
    });
}

/** Join a list of names into readable prose: "A, B and C". */
function joinList(items) {
  const values = items.filter(Boolean);
  if (values.length <= 1) return values[0] || '';
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

function truncate(text, max = MAX_HIGHLIGHT_CHARS) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3).replace(/\s\S*$/, '')}...`;
}

/**
 * Build the executive summary for a document.
 * @param {Array} clauses final clause records (with classification + riskCategory)
 * @param {{evaluation?: object}} options optional pre-computed evaluation
 * @returns {{summary: string, highlights: string[], model: string}}
 */
function buildDocumentSummary(clauses = [], options = {}) {
  const list = Array.isArray(clauses) ? clauses : [];
  const total = list.length;

  if (!total) {
    return {
      summary: 'No clauses were available to summarise for this agreement.',
      highlights: [],
      model: MODEL_NAME
    };
  }

  const evaluation = options.evaluation || riskService.evaluateDocument(list);
  const { riskSummary, overallRiskScore, overallRisk } = evaluation;
  const risky = riskSummary.risky || 0;
  const needsReview = riskSummary.needsReview || 0;
  const normal = riskSummary.normal || 0;

  const sentences = [];

  // 1. Overall picture.
  sentences.push(
    `This agreement has ${total} clause${total === 1 ? '' : 's'}. LoanLens flagged ${risky} as ` +
      `risky and ${needsReview} as needing a closer read, for an overall risk score of ` +
      `${overallRiskScore} out of 100 (${overallRisk} risk).`
  );

  // 2. What stands out.
  if (risky === 0 && needsReview === 0) {
    sentences.push(
      'No clause triggered a high-risk rule or a confident risky classification, so nothing stood out for urgent review.'
    );
  } else {
    const categories = categoryCounts(list).slice(0, 3).map(([name]) => name);
    if (categories.length) {
      sentences.push(`The main areas to check are ${joinList(categories)}.`);
    }
  }

  // 3. Name the single most important clause so the summary is actionable.
  const top = topRiskyClauses(list)[0];
  if (top) {
    const label = `Clause ${top.clauseNumber || top.index + 1}${top.title ? ` (${top.title})` : ''}`;
    sentences.push(
      `${label} is the item to review first${
        top.riskCategory && top.riskCategory !== 'Uncategorised' ? ` - it relates to ${top.riskCategory}` : ''
      }.`
    );
  }

  // Highlights: short, scannable bullets.
  const highlights = [];
  highlights.push(
    `${risky} risky clause${risky === 1 ? '' : 's'} and ${needsReview} needing review out of ${total}.`
  );
  if (risky > 0 && normal + needsReview > 0) {
    sentences.push('Most of the document reads like standard lending language.');
    highlights.push(`${normal} clause${normal === 1 ? '' : 's'} read as standard/low risk.`);
  }
  for (const clause of topRiskyClauses(list).slice(0, MAX_HIGHLIGHTS - highlights.length)) {
    const label = `Clause ${clause.clauseNumber || clause.index + 1}${clause.title ? ` (${clause.title})` : ''}`;
    highlights.push(truncate(`${label}: ${clause.reason || clause.summary || 'Flagged for review.'}`));
  }

  return {
    summary: sentences.join(' '),
    highlights: highlights.slice(0, MAX_HIGHLIGHTS),
    model: MODEL_NAME,
    riskBand: overallRisk,
    riskScore: overallRiskScore
  };
}

module.exports = { buildDocumentSummary, MODEL_NAME };
