'use strict';

/**
 * Server-side fallback analysis engine.
 *
 * This is NOT a trained machine-learning model, and it never pretends to be
 * one: every clause it produces is tagged `engine: 'server-fallback'` and
 * `model: 'heuristic-rules'` so the report can be explicit about the source.
 *
 * It exists so the full pipeline (extraction -> segmentation -> rules ->
 * classification -> summary -> report) still works when the Python ML service
 * is not running. The rule engine itself is the real shared rulebook from
 * `server/rules/riskRules.js`.
 */

const { matchRules } = require('../rules/riskRules');

const SENTENCE_SPLIT = /(?<=[.;])\s+(?=[A-Z(])/;

/* ------------------------------------------------------------------ */
/* Text cleaning                                                       */
/* ------------------------------------------------------------------ */

/** A repeated short line or an all-caps banner is almost always a page header. */
function isLikelyHeader(line) {
  if (!line || line.length < 20) return false;
  const letters = line.replace(/[^A-Za-z]/g, '');
  const shouty = letters.length >= 12 && letters === letters.toUpperCase();
  return shouty || /^page\b/i.test(line) || /confidential/i.test(line);
}

/** Remove repeated headers/footers and normalise whitespace. */
function cleanText(raw) {
  const text = String(raw || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/([a-z])-\n([a-z])/g, '$1$2'); // re-join hyphenated line breaks

  const lines = text.split('\n');

  // Count short lines - anything repeated 3+ times is almost certainly a page
  // header/footer rather than contract content. Repeated all-caps banners are
  // dropped from the second occurrence onwards.
  const counts = new Map();
  for (const line of lines) {
    const key = line.trim();
    if (key.length && key.length < 60) counts.set(key, (counts.get(key) || 0) + 1);
    else if (key.length) counts.set(key, (counts.get(key) || 0) + 1);
  }

  const filtered = lines.filter((line) => {
    const key = line.trim();
    if (!key) return false;
    const seen = counts.get(key) || 0;
    if (seen >= 3) return false;
    if (seen >= 2 && isLikelyHeader(key)) return false;
    if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(key)) return false;
    return true;
  });

  return filtered.join('\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}

/** Split a block of text into sentences (keeps amounts/dates intact). */
function splitSentences(text) {
  return String(text || '')
    .split(SENTENCE_SPLIT)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Clause segmentation                                                 */
/* ------------------------------------------------------------------ */

const NUMBERED_LINE = /^\s*(\d{1,2}(?:\.\d{1,2})*)\s*[).:\-\u2013]?\s+(\S.*)$/;
const LETTERED_LINE = /^\s*\(([a-h])\)\s*[).:]?\s+(\S.*)$/i;
const ROMAN_LINE = /^\s*\((i{1,3}|iv|v|vi{1,3}|ix|x)\)\s*[).:]?\s+(\S.*)$/i;
const HEADING_HINT = /^(clause|article|section|term|condition|schedule|annexure|part)\b/i;

function looksLikeHeading(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;
  if (HEADING_HINT.test(trimmed)) return true;
  const letters = trimmed.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 4 && letters === letters.toUpperCase()) return true;
  return (
    /^[A-Z][A-Za-z ]{3,60}$/.test(trimmed) &&
    !/[.;]$/.test(trimmed) &&
    trimmed.split(' ').length <= 8
  );
}

/** Derive a short title for a clause from its first line / first sentence. */
function deriveTitle(text, fallbackNumber) {
  const firstLine = String(text || '').split('\n')[0].trim();
  const stripped = firstLine.replace(NUMBERED_LINE, '$2').replace(/^[^A-Za-z0-9]+/, '').trim();
  const source = stripped.length >= 3 ? stripped : String(text || '');
  const title = source.split(/\s+/).slice(0, 9).join(' ').replace(/[.,;:]$/, '');
  if (!title) return `Clause ${fallbackNumber}`;
  return title.length > 70 ? `${title.slice(0, 67)}...` : title;
}

/**
 * Segment cleaned document text into clauses.
 * Strategy: numbered sections -> lettered sections -> headings -> paragraphs.
 */
function segmentClauses(rawText) {
  const text = cleanText(rawText);
  if (!text) return [];

  const lines = text.split('\n');
  const clauses = [];
  let current = null;
  let seenNumbered = false;

  const push = () => {
    if (!current) return;
    const body = current.lines.join('\n').trim();
    if (body.replace(/\s/g, '').length < 20) {
      current = null;
      return;
    }
    clauses.push({
      clauseNumber: current.number,
      title: current.title || deriveTitle(body, current.number),
      text: body,
      preamble: Boolean(current.preamble)
    });
    current = null;
  };

  for (const line of lines) {
    const numbered = line.match(NUMBERED_LINE);
    const lettered = numbered ? null : line.match(LETTERED_LINE);
    const roman = numbered || lettered ? null : line.match(ROMAN_LINE);
    const match = numbered || lettered || roman;
    const isHeading = !match && looksLikeHeading(line);

    if (match && numbered) seenNumbered = true;

    if (match) {
      push();
      const headingText = match[2] || '';
      current = {
        number: match[1],
        title: looksLikeHeading(headingText) ? headingText.trim() : '',
        lines: [headingText],
        preamble: false
      };
      continue;
    }

    if (isHeading) {
      push();
      current = {
        number: String(clauses.length + 1),
        title: line.trim(),
        lines: [line.trim()],
        preamble: !seenNumbered
      };
      continue;
    }

    if (!current) current = { number: '1', title: '', lines: [], preamble: !seenNumbered };
    current.lines.push(line);
  }
  push();

  // Drop a short document title/preamble that precedes the first numbered
  // clause so it is not reported as a risk clause of its own.
  if (clauses.length > 3 && clauses[0].preamble) {
    if (clauses[0].text.replace(/\s/g, '').length < 220) clauses.shift();
    else clauses[0].title = 'Preamble';
  }

  // Fallback: no numbering/headings found -> group sentences into windows.
  if (clauses.length < 3) {
    const sentences = splitSentences(text.replace(/\n+/g, ' '));
    const grouped = [];
    for (let i = 0; i < sentences.length; i += 3) {
      const chunk = sentences.slice(i, i + 3).join(' ');
      if (chunk.replace(/\s/g, '').length < 40) continue;
      grouped.push({
        clauseNumber: String(grouped.length + 1),
        title: deriveTitle(chunk, grouped.length + 1),
        text: chunk
      });
    }
    if (grouped.length) return grouped.slice(0, 120);
  }

  return clauses
    .filter((clause) => clause.text && clause.text.replace(/\s/g, '').length >= 20)
    .map(({ preamble, ...clause }) => clause)
    .slice(0, 150);
}

/* ------------------------------------------------------------------ */
/* Heuristic classifier (explicitly a fallback, not a trained model)   */
/* ------------------------------------------------------------------ */

const SIGNALS = [
  { pattern: /\b(?:penalt\w+|late\s+fee|default\s+interest)\b/i, weight: 4, category: 'Penalties' },
  { pattern: /\b(?:foreclos\w+|pre[\s-]?payment)\b/i, weight: 4, category: 'Prepayment / Foreclosure' },
  { pattern: /\b(?:compoun\w+|capitalis\w+|capitaliz\w+)\b/i, weight: 3, category: 'Penalties' },
  { pattern: /\b(?:sole\s+discretion|without\s+notice|unilater\w+)\b/i, weight: 4, category: 'Interest & APR' },
  { pattern: /\b(?:irrevocabl\w+|auto[\s-]?debit|NACH|ECS)\b/i, weight: 3, category: 'Payment Terms' },
  { pattern: /\b(?:recover\w+|recovery\s+agent)\b/i, weight: 3, category: 'Recovery Practices' },
  { pattern: /\bthird\s+part\w+\b/i, weight: 2, category: 'Data & Privacy' },
  { pattern: /\b(?:waive|waiver|shall\s+not\s+dispute)\b/i, weight: 3, category: 'Legal Rights' },
  { pattern: /\b(?:cheque|guarantee|collateral|hypothecat\w+)\b/i, weight: 2, category: 'Security & Collateral' },
  { pattern: /\b(?:at\s+any\s+time|may\s+modify|amendment)\b/i, weight: 2, category: 'Interest & APR' },
  { pattern: /\b(?:non[\s-]?refundable|processing\s+fee|documentation\s+charge)\b/i, weight: 2, category: 'Fees & Charges' },
  { pattern: /\b(?:notwithstanding|whatsoever|hereunder)\b/i, weight: 1, category: 'Legal Rights' }
];

const AMBIGUITY_SIGNALS = [
  /\bas\s+(?:may\s+be\s+)?(?:determined|decided|notified)\b/i,
  /\bfrom\s+time\s+to\s+time\b/i,
  /\bsubject\s+to\s+(?:change|revision)\b/i,
  /\bat\s+(?:the\s+)?(?:sole\s+)?discretion\b/i
];

/**
 * Keyword-weighted classification used only when no ML service is reachable.
 * @returns {{classification: string, confidence: number, reason: string, category: string}}
 */
function classifyHeuristic(text) {
  const haystack = String(text || '');
  let score = 0;
  let category = 'Uncategorised';
  let topWeight = 0;

  for (const signal of SIGNALS) {
    if (signal.pattern.test(haystack)) {
      score += signal.weight;
      if (signal.weight > topWeight) {
        topWeight = signal.weight;
        category = signal.category;
      }
    }
  }

  const ambiguous = AMBIGUITY_SIGNALS.some((pattern) => pattern.test(haystack));
  if (ambiguous) {
    score += 1;
    if (category === 'Uncategorised') category = 'Ambiguous Wording';
  }

  const words = haystack.split(/\s+/).filter(Boolean).length;

  let classification = 'Normal';
  if (score >= 5) classification = 'Risky';
  else if (score >= 2) classification = 'Needs Review';

  // Very short fragments cannot be judged confidently.
  if (words < 8 && classification === 'Normal') classification = 'Needs Review';

  // Confidence baseline: a clause with no risk signals and enough words is
  // confidently "Normal"; anything touching a signal is progressively less sure.
  let confidence;
  if (score === 0) confidence = words >= 8 ? 0.72 : 0.5;
  else if (score === 1) confidence = 0.62;
  else confidence = Math.min(0.93, 0.6 + score * 0.05);
  if (ambiguous) confidence = Math.max(0.45, confidence - 0.06);

  const reasonMap = {
    Risky: `The heuristic classifier detected ${category.toLowerCase()} language that commonly appears in clauses borrowers should check closely.`,
    'Needs Review':
      'The wording is ambiguous or contains terms that cannot be judged confidently without a closer reading.',
    Normal: 'No notable risk keywords were detected in this clause.'
  };

  return {
    classification,
    confidence: Number(confidence.toFixed(2)),
    reason: reasonMap[classification],
    category
  };
}

/* ------------------------------------------------------------------ */
/* Rule based plain-language summariser (fallback, not a trained model)*/
/* ------------------------------------------------------------------ */

const SIMPLIFICATIONS = [
  [/\bthe\s+borrower\b/gi, 'you'],
  [/\bborrower\b/gi, 'you'],
  [/\bshall\s+be\s+liable\s+to\s+pay\b/gi, 'you may have to pay'],
  [/\bshall\s+not\b/gi, 'must not'],
  [/\bshall\b/gi, 'will'],
  [/\bin\s+the\s+event\s+(?:that|of)\b/gi, 'if'],
  [/\bprior\s+to\b/gi, 'before'],
  [/\bsubsequent\s+to\b/gi, 'after'],
  [/\bnotwithstanding\b/gi, 'despite'],
  [/\bpursuant\s+to\b/gi, 'under'],
  [/\bherein(?:after|before|under)?\b/gi, ''],
  [/\bat\s+the\s+sole\s+discretion\s+of\s+the\s+lender\b/gi, 'whenever the lender decides'],
  [/\bmay\s+be\s+revised\b/gi, 'can be changed'],
  [/\bis\s+entitled\s+to\b/gi, 'can'],
  [/\bundertakes\s+to\b/gi, 'agrees to'],
  [/\bat\s+any\s+time\s+whatsoever\b/gi, 'at any time at all']
];

const MONEY_OR_PERCENT = /(?:Rs\.?|INR|₹|\$)\s?[\d,]+(?:\.\d+)?|\b\d{1,3}(?:\.\d+)?\s?(?:%|per\s?cent)\b/i;
const DATE_LIKE = /\b\d{1,2}\s+(?:day|days|month|months|year|years)\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/i;

/**
 * Produce a 1-2 sentence plain English summary.
 * Amounts, dates and obligations in the source sentences are preserved verbatim.
 */
function summarizeHeuristic(text) {
  const sentences = splitSentences(String(text || '').replace(/\n+/g, ' '));
  if (!sentences.length) return '';

  const picked = [sentences[0]];
  const keyDetail = sentences
    .slice(1)
    .find((sentence) => MONEY_OR_PERCENT.test(sentence) || DATE_LIKE.test(sentence));
  if (keyDetail && keyDetail !== sentences[0]) picked.push(keyDetail);

  let summary = picked.join(' ');
  for (const [pattern, replacement] of SIMPLIFICATIONS) {
    summary = summary.replace(pattern, replacement);
  }

  summary = summary.replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').trim();

  if (summary.length > 320) {
    summary = `${summary.slice(0, 317).replace(/\s\S*$/, '')}...`;
  }
  return summary;
}

/* ------------------------------------------------------------------ */
/* Full local pipeline                                                 */
/* ------------------------------------------------------------------ */

/**
 * Analyse already-segmented clauses locally (no ML service required).
 * Rules and the heuristic classifier are returned separately, exactly like the
 * ML service does, so the report UI behaves identically on both paths.
 */
function analyseClauses(clauses = []) {
  return clauses.map((clause, index) => {
    const text = clause.text || clause.originalText || '';
    return {
      clause,
      index,
      ruleMatch: matchRules(text),
      ml: classifyHeuristic(text),
      summary: summarizeHeuristic(text)
    };
  });
}

module.exports = {
  cleanText,
  splitSentences,
  segmentClauses,
  classifyHeuristic,
  summarizeHeuristic,
  analyseClauses,
  deriveTitle
};
