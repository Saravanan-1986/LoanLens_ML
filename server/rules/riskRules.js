'use strict';

/**
 * LoanLens risk rulebook (JavaScript implementation).
 *
 * The same rulebook is implemented in the Python ML service
 * (`ml-service/rules/risk_rules.py`) so the Node server can fall back to a
 * local rule pass when the ML service is unavailable.
 *
 * NOTE ON REGULATORY REFERENCES
 * -----------------------------
 * Rules never assert a legal conclusion. Where a rule is inspired by a
 * published regulatory principle the reference is stored verbatim so it can be
 * surfaced in the UI, together with `regulatoryVerified`, which stays `false`
 * until a human confirms the exact citation for a rule.
 */

const SEVERITY = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };

/**
 * Each rule:
 *   ruleId              stable identifier stored on every clause
 *   name                human readable name
 *   category            risk bucket shown in the report
 *   severity            HIGH | MEDIUM | LOW
 *   patterns            array of RegExp matched against the clause text
 *   negativePatterns    if any of these match, the rule is skipped
 *   explanation         neutral, plain-English explanation of the flag
 *   regulatoryReference reference text (may be empty)
 *   regulatoryVerified  whether a human validated the citation
 */
const RISK_RULES = [
  {
    ruleId: 'PREPAYMENT_PENALTY',
    name: 'Prepayment / Foreclosure Penalty',
    category: 'Prepayment / Foreclosure',
    severity: SEVERITY.HIGH,
    patterns: [
      /\bpre[\s-]?pay(?:ment|ing)?\b[^.]{0,160}\b(?:charge|charges|fee|fees|penalt|percent|per cent|%)\b/i,
      /\b(?:charge|charges|fee|fees|penalt\w+)\b[^.]{0,120}\b(?:pre[\s-]?pay(?:ment)?|early\s+repayment|foreclos\w+)\b/i,
      /\bforeclos\w+\b[^.]{0,160}\b(?:charge|charges|fee|fees|penalt\w+|levy|levied)\b/i
    ],
    negativePatterns: [/\bno\s+pre[\s-]?payment\s+(?:charge|penalt\w+)\b/i],
    explanation:
      'This clause may impose a charge or penalty when the loan is repaid or closed before the agreed term.',
    regulatoryReference:
      'RBI Fair Practices Code for Lenders - charges should be disclosed transparently.',
    regulatoryVerified: false
  },
  {
    ruleId: 'EXCESSIVE_PREPAYMENT_CHARGE',
    name: 'Excessive Prepayment Charge',
    category: 'Prepayment / Foreclosure',
    severity: SEVERITY.HIGH,
    patterns: [
      /\bpre[\s-]?pay\w*\b[^.]{0,120}\b([3-9]|[1-9]\d)\s?(?:%|per\s?cent)\b/i,
      /\b(?:foreclos\w+|early\s+repayment)\b[^.]{0,120}\b([3-9]|[1-9]\d)\s?(?:%|per\s?cent)\b/i
    ],
    negativePatterns: [],
    explanation:
      'A high percentage charge for repaying the loan early is flagged because it can significantly raise the effective cost of borrowing.',
    regulatoryReference:
      'RBI guidance on transparency of prepayment charges for floating rate loans.',
    regulatoryVerified: false
  },
  {
    ruleId: 'UNCLEAR_APR',
    name: 'Unclear Effective Annual Rate',
    category: 'Interest & APR',
    severity: SEVERITY.HIGH,
    patterns: [
      /\b(?:effective\s+annual|annual(?:ised|ized)?\s+percentage|APR|effective\s+rate)\b[^.]{0,140}\b(?:as\s+(?:may\s+be\s+)?(?:determined|decided|notified)|at\s+(?:the\s+)?(?:sole\s+)?discretion|from\s+time\s+to\s+time|varies?)\b/i,
      /\binterest\s+rate\b[^.]{0,80}\b(?:sole\s+discretion|may\s+be\s+(?:revised|changed|altered)|without\s+(?:prior\s+)?notice)\b/i
    ],
    negativePatterns: [],
    explanation:
      'The effective annual interest rate is not stated as a fixed number, which makes the true cost of borrowing hard to compare.',
    regulatoryReference: 'RBI circular on Key Fact Statement (KFS) for retail loans.',
    regulatoryVerified: false
  },
  {
    ruleId: 'HIDDEN_PROCESSING_FEE',
    name: 'Hidden / Non-refundable Processing Fees',
    category: 'Fees & Charges',
    severity: SEVERITY.MEDIUM,
    patterns: [
      /\b(?:processing|documentation|administrative|origination|service|handling)\s+(?:fee|fees|charge|charges)\b[^.]{0,160}\b(?:non[\s-]?refundable|not\s+refundable|deducted|adjusted|at\s+the\s+time\s+of\s+disbursement)\b/i,
      /\bnon[\s-]?refundable\b[^.]{0,120}\b(?:fee|fees|charge|charges|amount)\b/i
    ],
    negativePatterns: [],
    explanation:
      'Upfront fees that are deducted at disbursement or are non-refundable reduce the amount actually received and should be checked against the quoted cost.',
    regulatoryReference:
      'RBI Fair Practices Code for Lenders - upfront charges must be disclosed.',
    regulatoryVerified: false
  },
  {
    ruleId: 'EXCESSIVE_PROCESSING_CHARGE',
    name: 'Excessive Processing Charge',
    category: 'Fees & Charges',
    severity: SEVERITY.MEDIUM,
    patterns: [
      /\b(?:processing|documentation|administrative|origination)\s+(?:fee|fees|charge|charges)\b[^.]{0,120}\b([3-9]|[1-9]\d)\s?(?:%|per\s?cent)\b/i
    ],
    negativePatterns: [],
    explanation:
      'A processing or documentation charge above 3% of the loan amount is unusually high and materially increases the cost of borrowing.',
    regulatoryReference: '',
    regulatoryVerified: false
  },
  {
    ruleId: 'AUTO_DEBIT_MANDATE',
    name: 'Auto-debit / Mandate without Consent',
    category: 'Payment Terms',
    severity: SEVERITY.MEDIUM,
    patterns: [
      /\b(?:NACH|ECS|auto[\s-]?debit|standing\s+instruction|direct\s+debit)\b[^.]{0,160}\b(?:without\s+(?:any\s+)?(?:prior\s+)?(?:notice|consent|authorisation|authorization)|irrevocabl\w+|unconditionally)\b/i,
      /\b(?:authoris\w+|authoriz\w+)\b[^.]{0,80}\b(?:debit|deduct)\w*\b[^.]{0,120}\b(?:without\s+(?:further\s+)?notice|at\s+any\s+time)\b/i,
      /\birrevocabl\w+\b[^.]{0,120}\b(?:mandate|instruction|authoris\w+|authoriz\w+)\b/i
    ],
    negativePatterns: [],
    explanation:
      'An automatic debit instruction described as irrevocable or effective without further notice limits the borrower\u2019s control over their bank account.',
    regulatoryReference:
      'RBI guidelines on e-mandates / NACH requiring explicit customer authorisation.',
    regulatoryVerified: false
  },
  {
    ruleId: 'CONTACT_REFERENCES_RECOVERY',
    name: 'Recovery through Contact / Reference Persons',
    category: 'Recovery Practices',
    severity: SEVERITY.HIGH,
    patterns: [
      /\brecover\w*\b[^.]{0,160}\b(?:contacts?|reference\s+(?:person|persons|parties)|family|relatives|employer|friends)\b/i,
      /\bcontacts?\b[^.]{0,160}\b(?:recover\w+|due\s+amounts|outstanding|default)\b/i,
      /\bshall\s+(?:be\s+entitled\s+to\s+)?(?:contact|approach|inform)\b[^.]{0,120}\b(?:any\s+person|third\s+part|\d{10})\b/i
    ],
    negativePatterns: [],
    explanation:
      'A recovery clause that allows contacting the borrower\u2019s family, employer or reference persons is a recognised concern in debt-collection practice.',
    regulatoryReference:
      'RBI Fair Practices Code - recovery agents must not contact third parties about a borrower\u2019s dues.',
    regulatoryVerified: false
  },
  {
    ruleId: 'UNILATERAL_INTEREST_REVISION',
    name: 'Unilateral Interest Rate Revision',
    category: 'Interest & APR',
    severity: SEVERITY.HIGH,
    patterns: [
      /\b(?:interest\s+rate|rate\s+of\s+interest|charges?)\b[^.]{0,140}\b(?:revised|altered|changed|modified|increased)\b[^.]{0,80}\b(?:sole\s+discretion|without\s+(?:any\s+)?(?:prior\s+)?notice|at\s+any\s+time)\b/i,
      /\bsole\s+and\s+absolute\s+discretion\b[^.]{0,160}\b(?:interest|rate|charges?|terms?)\b/i
    ],
    negativePatterns: [/\bwith\s+(?:\d+\s+days?|prior)\s+(?:written\s+)?notice\b/i],
    explanation:
      'The lender reserves the right to change the interest rate or charges without real notice, so the cost of the loan may increase after signing.',
    regulatoryReference:
      'RBI Fair Practices Code - rate changes must be communicated to borrowers.',
    regulatoryVerified: false
  },
  {
    ruleId: 'PENAL_INTEREST_COMPOUNDING',
    name: 'Penal Interest / Compounding',
    category: 'Penalties',
    severity: SEVERITY.HIGH,
    patterns: [
      /\bpenal\w*\s+interest\b[^.]{0,160}\b(?:compoun\w+|per\s+annum|per\s+month|monthly|daily|capitalis\w+|capitaliz\w+)\b/i,
      /\b(?:compoun\w+|capitalis\w+|capitaliz\w+)\b[^.]{0,120}\bpenal\w*\b/i,
      /\bpenal\w*\s+(?:charges?|interest)\b[^.]{0,140}\bper\s+month\b/i
    ],
    negativePatterns: [],
    explanation:
      'Penal interest that is compounded (charged on unpaid interest) grows quickly and can substantially increase the total payable amount.',
    regulatoryReference:
      'RBI circular on charging of penal interest and its disclosure.',
    regulatoryVerified: false
  },
  {
    ruleId: 'BLANK_SECURITY_CHEQUE',
    name: 'Blank / Security Cheque Requirement',
    category: 'Security & Collateral',
    severity: SEVERITY.MEDIUM,
    patterns: [
      /\bblank\s+(?:signed\s+)?cheque\b/i,
      /\bsecurity\s+cheque\b/i,
      /\b(?:undated|blank)\b[^.]{0,80}\bcheque\b/i
    ],
    negativePatterns: [],
    explanation:
      'A blank or undated security cheque gives the lender a broad instrument that can be completed later, which borrowers should examine carefully.',
    regulatoryReference: '',
    regulatoryVerified: false
  },
  {
    ruleId: 'CROSS_DEFAULT',
    name: 'Cross-default Clause',
    category: 'Default & Enforcement',
    severity: SEVERITY.MEDIUM,
    patterns: [
      /\bcross[\s-]?default\b/i,
      /\bdefault\b[^.]{0,140}\b(?:any\s+other|other)\s+(?:agreement|loan|facilit\w+)\b/i
    ],
    negativePatterns: [],
    explanation:
      'A default in any other agreement with the lender can automatically make this loan repayable immediately.',
    regulatoryReference: '',
    regulatoryVerified: false
  },
  {
    ruleId: 'ACCELERATION_CLAUSE',
    name: 'Acceleration / Entire Balance Due',
    category: 'Default & Enforcement',
    severity: SEVERITY.MEDIUM,
    patterns: [
      /\b(?:entire|whole|full)\s+(?:outstanding|principal|balance|amount)\b[^.]{0,160}\b(?:immediately\s+due|forthwith\s+due|become\s+due|callable|payable\s+immediately)\b/i,
      /\baccelerat\w+\b[^.]{0,140}\b(?:loan|facility|amount|dues)\b/i
    ],
    negativePatterns: [],
    explanation:
      'On a default the lender can demand the entire remaining loan amount at once rather than only the missed instalments.',
    regulatoryReference: '',
    regulatoryVerified: false
  },
  {
    ruleId: 'THIRD_PARTY_DATA_SHARING',
    name: 'Third-party Data Sharing',
    category: 'Data & Privacy',
    severity: SEVERITY.MEDIUM,
    patterns: [
      /\b(?:share|disclose|transfer|furnish)\b[^.]{0,140}\b(?:personal\s+(?:data|information)|information|data|details)\b[^.]{0,160}\b(?:third\s+part\w+|affiliates?|group\s+companies|service\s+providers?|credit\s+bureau|agencies)\b/i,
      /\bcredit\s+(?:bureau|information\s+compan\w+)\b[^.]{0,160}\b(?:report|submit|share|furnish)\b/i
    ],
    negativePatterns: [],
    explanation:
      'Your personal or financial information may be shared with third parties, so it is worth checking which parties and for what purpose.',
    regulatoryReference:
      'RBI / DPDP Act expectations around borrower consent for data sharing.',
    regulatoryVerified: false
  },
  {
    ruleId: 'WAIVER_OF_RIGHTS',
    name: 'Waiver of Rights / No Contest',
    category: 'Legal Rights',
    severity: SEVERITY.MEDIUM,
    patterns: [
      /\b(?:waive|waives|waiver)\b[^.]{0,160}\b(?:rights?|claims?|defen[cs]e|objection|dispute)\b/i,
      /\bshall\s+not\s+(?:dispute|contest|challenge)\b/i
    ],
    negativePatterns: [],
    explanation:
      'The clause asks the borrower to give up legal rights or the ability to raise a dispute, which is a significant commitment.',
    regulatoryReference: '',
    regulatoryVerified: false
  },
  {
    ruleId: 'UNFAVOURABLE_JURISDICTION',
    name: 'Distant / Unfavourable Jurisdiction',
    category: 'Legal Rights',
    severity: SEVERITY.LOW,
    patterns: [
      /\bexclusive\s+jurisdiction\b/i,
      /\b(?:jurisdiction|courts?)\b[^.]{0,140}\b(?:only|alone)\b/i
    ],
    negativePatterns: [],
    explanation:
      'Disputes must be heard only in a court chosen by the lender, which may be far from where the borrower lives.',
    regulatoryReference: '',
    regulatoryVerified: false
  },
  {
    ruleId: 'LATE_PAYMENT_PENALTY',
    name: 'Late Payment Penalty',
    category: 'Penalties',
    severity: SEVERITY.MEDIUM,
    patterns: [
      /\b(?:late\s+payment|delayed\s+payment|bounce|dishonou?r|overdue)\b[^.]{0,160}\b(?:penalt\w+|charge|charges|fee|fees|\d{1,2}\s?(?:%|per\s?cent))\b/i,
      /\b(?:bounce|dishonou?r)\s+charges?\b[^.]{0,140}\b(?:per\s+instance|per\s+occurrence|\d{3,5})\b/i
    ],
    negativePatterns: [],
    explanation:
      'This clause sets a penalty for late or failed payments. The amount and how it is calculated are worth verifying against the quoted terms.',
    regulatoryReference: '',
    regulatoryVerified: false
  }
];

/** Rules indexed by id for fast lookups in the API / report layer. */
const RULES_BY_ID = RISK_RULES.reduce((acc, rule) => {
  acc[rule.ruleId] = rule;
  return acc;
}, {});

const SEVERITY_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

/**
 * Run the rulebook against a single clause and return the highest severity
 * match (HIGH > MEDIUM > LOW) or `null` when nothing triggers.
 */
function matchRules(text) {
  const haystack = String(text || '');
  if (!haystack.trim()) return null;

  let best = null;

  for (const rule of RISK_RULES) {
    if (rule.negativePatterns.some((pattern) => pattern.test(haystack))) continue;
    if (!rule.patterns.some((pattern) => pattern.test(haystack))) continue;

    const candidate = {
      ruleId: rule.ruleId,
      name: rule.name,
      category: rule.category,
      severity: rule.severity,
      explanation: rule.explanation,
      regulatoryReference: rule.regulatoryReference,
      regulatoryVerified: rule.regulatoryVerified
    };

    if (!best || SEVERITY_RANK[candidate.severity] > SEVERITY_RANK[best.severity]) {
      best = candidate;
    }
  }

  return best;
}

module.exports = { RISK_RULES, RULES_BY_ID, SEVERITY, SEVERITY_RANK, matchRules };

