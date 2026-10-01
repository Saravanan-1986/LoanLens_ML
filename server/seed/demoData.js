'use strict';

/**
 * Demo / seed data.
 *
 * -----------------------------------------------------------------------
 * IMPORTANT: this data is ILLUSTRATIVE SAMPLE CONTENT - it was written by
 * hand to demonstrate the interface. It is NOT the output of a real ML
 * analysis and every record it creates is flagged `isDemo: true` plus
 * `analysisSource: 'demo-seed'` so the UI can label it honestly.
 * -----------------------------------------------------------------------
 */

const { evaluateDocument } = require('../services/riskService');
const { RULES_BY_ID } = require('../rules/riskRules');

/** Reusable clause blueprints. `ruleId` values match server/rules/riskRules.js. */
const CLAUSE_BLUEPRINTS = [
  {
    key: 'definitions',
    title: 'Definitions and Interpretation',
    classification: 'Normal',
    riskCategory: 'General Terms',
    confidence: 0.88,
    originalText:
      '"Agreement" means this loan agreement together with the schedule annexed hereto. In this Agreement, unless the context otherwise requires, the singular includes the plural and a reference to a person includes a body corporate.',
    summary:
      'This clause explains how the words used in the agreement should be read and what "Agreement" refers to.'
  },
  {
    key: 'loan_amount',
    title: 'Loan Amount and Disbursement',
    classification: 'Normal',
    riskCategory: 'Loan Terms',
    confidence: 0.9,
    originalText:
      'The Lender agrees to lend to the Borrower a sum of Rs. 5,00,000 (Rupees Five Lakh only) and the Borrower agrees to repay the same with interest. The Loan shall be disbursed to the Borrower\'s bank account within 2 working days of execution of this Agreement.',
    summary:
      'The lender will lend you Rs. 5,00,000 and pay it into your bank account within 2 working days of signing.'
  },
  {
    key: 'interest_rate',
    title: 'Interest Rate',
    classification: 'Normal',
    riskCategory: 'Interest & APR',
    confidence: 0.89,
    originalText:
      'Interest shall be charged on the outstanding principal at the rate of 10.5% per annum, calculated on a reducing balance basis, and shall accrue from the date of disbursement until repayment in full.',
    summary:
      'Interest is charged at 10.5% per year on the amount you still owe, starting from the day the loan is paid out.'
  },
  {
    key: 'unclear_apr',
    title: 'Effective Annual Rate',
    classification: 'Risky',
    riskCategory: 'Interest & APR',
    confidence: 0.86,
    ruleId: 'UNCLEAR_APR',
    ruleSeverity: 'HIGH',
    regulatoryReference:
      'RBI circular on Key Fact Statement (KFS) for retail loans.',
    originalText:
      'The Effective Annual Rate applicable to the Loan shall be as may be determined by the Lender from time to time, after taking into account the interest and all charges payable by the Borrower.',
    summary:
      'The true yearly cost of this loan is not given as a fixed number - the lender decides it later, so you cannot compare the real cost with other loans.'
  },
  {
    key: 'processing_fee',
    title: 'Processing Fee',
    classification: 'Risky',
    riskCategory: 'Fees & Charges',
    confidence: 0.84,
    ruleId: 'HIDDEN_PROCESSING_FEE',
    ruleSeverity: 'MEDIUM',
    regulatoryReference: 'RBI Fair Practices Code for Lenders - upfront charges must be disclosed.',
    originalText:
      'A non-refundable processing fee of 2.5% of the Loan Amount, together with applicable taxes, shall be deducted from the disbursement amount at the time of disbursement.',
    summary:
      'A non-refundable fee of 2.5% of the loan (plus taxes) is taken out of the money before it reaches you.'
  },
  {
    key: 'prepayment',
    title: 'Prepayment Charges',
    classification: 'Risky',
    riskCategory: 'Prepayment / Foreclosure',
    confidence: 0.91,
    ruleId: 'PREPAYMENT_PENALTY',
    ruleSeverity: 'HIGH',
    regulatoryReference:
      'RBI Fair Practices Code for Lenders - charges should be disclosed transparently.',
    originalText:
      'The Borrower shall pay a prepayment charge of 5% of the outstanding principal amount in the event that the Borrower prepays or forecloses the Loan, whether in part or in full, prior to the completion of the Loan Term.',
    summary:
      'You may have to pay a 5% charge on the remaining loan amount if you repay the loan early.'
  },
  {
    key: 'penal_interest',
    title: 'Penal Interest',
    classification: 'Risky',
    riskCategory: 'Penalties',
    confidence: 0.89,
    ruleId: 'PENAL_INTEREST_COMPOUNDING',
    ruleSeverity: 'HIGH',
    regulatoryReference: 'RBI circular on charging of penal interest and its disclosure.',
    originalText:
      'In the event of default in payment of any instalment, penal interest at the rate of 2% per month shall be charged on the overdue amount and shall be compounded on a monthly basis until the default is cured.',
    summary:
      'If you miss an instalment, 2% penal interest is charged every month on the overdue amount, and it is added back monthly so it keeps growing.'
  },
  {
    key: 'auto_debit',
    title: 'Auto-debit Mandate',
    classification: 'Risky',
    riskCategory: 'Payment Terms',
    confidence: 0.83,
    ruleId: 'AUTO_DEBIT_MANDATE',
    ruleSeverity: 'MEDIUM',
    regulatoryReference:
      'RBI guidelines on e-mandates / NACH requiring explicit customer authorisation.',
    originalText:
      'The Borrower hereby irrevocably authorises the Lender to debit the Borrower\'s bank account through NACH or any other mode for all amounts due under this Agreement without further notice to the Borrower.',
    summary:
      'You give the lender a permanent permission to take money out of your bank account for anything due under this loan, without telling you first.'
  },
  {
    key: 'recovery_contacts',
    title: 'Recovery and Contact Persons',
    classification: 'Risky',
    riskCategory: 'Recovery Practices',
    confidence: 0.92,
    ruleId: 'CONTACT_REFERENCES_RECOVERY',
    ruleSeverity: 'HIGH',
    regulatoryReference:
      'RBI Fair Practices Code - recovery agents must not contact third parties about a borrower\'s dues.',
    originalText:
      'In the event of default, the Borrower agrees that the Lender, its employees or its recovery agents may contact the reference persons mentioned in the schedule, the Borrower\'s family members and the Borrower\'s employer to recover the outstanding dues.',
    summary:
      'If you default, the lender or its recovery agents may contact your reference persons, family and employer to recover the money.'
  },
  {
    key: 'interest_revision',
    title: 'Revision of Interest Rate',
    classification: 'Risky',
    riskCategory: 'Interest & APR',
    confidence: 0.88,
    ruleId: 'UNILATERAL_INTEREST_REVISION',
    ruleSeverity: 'HIGH',
    regulatoryReference: 'RBI Fair Practices Code - rate changes must be communicated to borrowers.',
    originalText:
      'The Lender may at its sole discretion revise the rate of interest and other charges under this Agreement at any time without any prior notice to the Borrower.',
    summary:
      'The lender can change the interest rate and other charges whenever it wants, without telling you in advance.'
  },
  {
    key: 'late_payment',
    title: 'Late Payment Charges',
    classification: 'Risky',
    riskCategory: 'Penalties',
    confidence: 0.8,
    ruleId: 'LATE_PAYMENT_PENALTY',
    ruleSeverity: 'MEDIUM',
    originalText:
      'A late payment charge of Rs. 500 per instance shall be levied in the event of delayed payment or dishonour of any repayment instrument presented by the Lender.',
    summary:
      'A charge of Rs. 500 applies each time a payment is late or a repayment instrument is dishonoured.'
  },
  {
    key: 'security_cheque',
    title: 'Security Cheque',
    classification: 'Needs Review',
    riskCategory: 'Security & Collateral',
    confidence: 0.72,
    ruleId: 'BLANK_SECURITY_CHEQUE',
    ruleSeverity: 'MEDIUM',
    originalText:
      'The Borrower shall, at the time of execution of this Agreement, hand over a signed blank cheque drawn on the Borrower\'s bank account as security, which the Lender may present in the event of default.',
    summary:
      'You must hand over a signed blank cheque as security, which the lender can use if you default.'
  },
  {
    key: 'cross_default',
    title: 'Cross Default',
    classification: 'Needs Review',
    riskCategory: 'Default & Enforcement',
    confidence: 0.74,
    ruleId: 'CROSS_DEFAULT',
    ruleSeverity: 'MEDIUM',
    originalText:
      'Any default by the Borrower in the repayment of any other loan, facility or agreement with the Lender shall be deemed to be an event of default under this Agreement.',
    summary:
      'If you default on any other loan with the same lender, this loan is also treated as being in default.'
  },
  {
    key: 'acceleration',
    title: 'Acceleration on Default',
    classification: 'Needs Review',
    riskCategory: 'Default & Enforcement',
    confidence: 0.7,
    ruleId: 'ACCELERATION_CLAUSE',
    ruleSeverity: 'MEDIUM',
    originalText:
      'Upon the occurrence of an event of default, the entire outstanding principal together with accrued interest and other charges shall become immediately due and payable by the Borrower.',
    summary:
      'If you default, the whole remaining loan plus interest and charges becomes payable immediately.'
  },
  {
    key: 'data_sharing',
    title: 'Sharing of Information',
    classification: 'Needs Review',
    riskCategory: 'Data & Privacy',
    confidence: 0.71,
    ruleId: 'THIRD_PARTY_DATA_SHARING',
    ruleSeverity: 'MEDIUM',
    regulatoryReference: 'RBI / DPDP Act expectations around borrower consent for data sharing.',
    originalText:
      'The Borrower authorises the Lender to disclose the Borrower\'s personal information and credit details to third parties, affiliates and credit information companies as the Lender may deem necessary.',
    summary:
      'You allow the lender to share your personal and credit details with third parties, affiliates and credit bureaus.'
  },
  {
    key: 'jurisdiction',
    title: 'Governing Law and Jurisdiction',
    classification: 'Needs Review',
    riskCategory: 'Legal Rights',
    confidence: 0.68,
    ruleId: 'UNFAVOURABLE_JURISDICTION',
    ruleSeverity: 'LOW',
    originalText:
      'This Agreement shall be governed by the laws of India and the courts at Mumbai shall have exclusive jurisdiction in respect of all disputes arising out of or in connection with this Agreement.',
    summary:
      'Disputes can only be heard by the courts at Mumbai, which may be far from where you live.'
  },
  {
    key: 'waiver',
    title: 'Waiver',
    classification: 'Needs Review',
    riskCategory: 'Legal Rights',
    confidence: 0.69,
    ruleId: 'WAIVER_OF_RIGHTS',
    ruleSeverity: 'MEDIUM',
    originalText:
      'The Borrower waives all rights of objection and shall not dispute the statements of account furnished by the Lender, which shall be treated as conclusive evidence of the amounts due.',
    summary:
      'You give up the right to object to or dispute the account statements the lender provides.'
  },
  {
    key: 'repayment',
    title: 'Repayment Schedule',
    classification: 'Normal',
    riskCategory: 'Loan Terms',
    confidence: 0.87,
    originalText:
      'The Borrower shall repay the Loan in 24 equated monthly instalments of Rs. 23,190 each, commencing on the 5th day of the month following the month of disbursement.',
    summary:
      'You repay the loan in 24 monthly instalments of Rs. 23,190 each, starting on the 5th of the month after the money is paid out.'
  },
  {
    key: 'statement',
    title: 'Statements and Notices',
    classification: 'Normal',
    riskCategory: 'General Terms',
    confidence: 0.85,
    originalText:
      'The Lender shall provide the Borrower with a statement of account on a monthly basis. Any notice under this Agreement shall be sent to the address or email address recorded with the Lender.',
    summary:
      'The lender will send you a monthly account statement, and notices will go to the address or email you have registered.'
  },
  {
    key: 'grievance',
    title: 'Grievance Redressal',
    classification: 'Normal',
    riskCategory: 'General Terms',
    confidence: 0.86,
    originalText:
      'The Borrower may raise any complaint in relation to the Loan by writing to the Grievance Redressal Officer of the Lender, whose details are provided in the schedule. The Lender shall endeavour to resolve the complaint within 30 days.',
    summary:
      'You can complain by writing to the lender\'s Grievance Redressal Officer, and the lender aims to resolve it within 30 days.'
  },
  {
    key: 'insurance',
    title: 'Insurance',
    classification: 'Normal',
    riskCategory: 'General Terms',
    confidence: 0.82,
    originalText:
      'The Borrower may, at the Borrower\'s option, obtain insurance in respect of the Loan. Any premium payable for such insurance shall be borne by the Borrower.',
    summary: 'You can choose to insure the loan, and any premium would be paid by you.'
  },
  {
    key: 'taxes',
    title: 'Taxes and Statutory Levies',
    classification: 'Normal',
    riskCategory: 'General Terms',
    confidence: 0.83,
    originalText:
      'All taxes, duties, cess and statutory levies payable in respect of the Loan shall be borne by the Borrower and may be collected by the Lender along with the instalments.',
    summary:
      'Any taxes or statutory charges on the loan are payable by you and may be collected along with your instalments.'
  },
  {
    key: 'assignment',
    title: 'Assignment and Transfer',
    classification: 'Normal',
    riskCategory: 'General Terms',
    confidence: 0.81,
    originalText:
      'The Lender may assign or transfer all or any of its rights under this Agreement to any person, and the Borrower shall be notified of such assignment in writing.',
    summary:
      'The lender may transfer its rights under this agreement to another party, and you will be informed in writing.'
  },
  {
    key: 'nomination',
    title: 'Nomination',
    classification: 'Normal',
    riskCategory: 'General Terms',
    confidence: 0.8,
    originalText:
      'The Borrower may nominate a person in the schedule to receive any benefit payable under the Loan in the event of the death of the Borrower.',
    summary:
      'You may nominate a person who would receive any benefit payable under the loan if you pass away.'
  }
];

const BLUEPRINT_BY_KEY = CLAUSE_BLUEPRINTS.reduce((acc, blueprint) => {
  acc[blueprint.key] = blueprint;
  return acc;
}, {});

/** Demo agreements: filename, size, age and the clause blueprints they use. */
const AGREEMENT_BLUEPRINTS = [
  {
    filename: 'Personal_Loan_Agreement.pdf',
    sizeBytes: 2411520,
    hoursAgo: 3,
    extractionMethod: 'pymupdf',
    clausesKey: [
      'definitions', 'loan_amount', 'interest_rate', 'unclear_apr', 'processing_fee',
      'prepayment', 'penal_interest', 'auto_debit', 'security_cheque', 'cross_default',
      'repayment', 'statement', 'grievance', 'insurance', 'jurisdiction', 'data_sharing'
    ]
  },
  {
    filename: 'Vehicle_Loan_Agreement.pdf',
    sizeBytes: 1884416,
    hoursAgo: 27,
    extractionMethod: 'pdfplumber',
    clausesKey: [
      'definitions', 'loan_amount', 'interest_rate', 'repayment', 'prepayment',
      'security_cheque', 'jurisdiction', 'waiver', 'statement', 'grievance',
      'insurance', 'taxes', 'assignment', 'nomination'
    ]
  },
  {
    filename: 'Digital_Lending_Agreement.pdf',
    sizeBytes: 1048576,
    hoursAgo: 52,
    extractionMethod: 'pymupdf',
    clausesKey: [
      'definitions', 'loan_amount', 'interest_rate', 'unclear_apr', 'processing_fee',
      'penal_interest', 'auto_debit', 'interest_revision', 'recovery_contacts',
      'late_payment', 'data_sharing', 'cross_default', 'repayment', 'statement', 'grievance'
    ]
  },
  {
    filename: 'Gold_Loan_Agreement.pdf',
    sizeBytes: 720896,
    hoursAgo: 78,
    extractionMethod: 'tesseract-ocr',
    clausesKey: [
      'definitions', 'loan_amount', 'interest_rate', 'late_payment', 'security_cheque',
      'repayment', 'statement', 'grievance', 'insurance', 'taxes', 'nomination'
    ]
  },
  {
    filename: 'Business_Loan_Agreement.pdf',
    sizeBytes: 3145728,
    hoursAgo: 131,
    extractionMethod: 'pdfplumber',
    clausesKey: [
      'definitions', 'loan_amount', 'interest_rate', 'prepayment', 'penal_interest',
      'interest_revision', 'recovery_contacts', 'cross_default', 'acceleration', 'waiver',
      'jurisdiction', 'repayment', 'statement', 'grievance', 'insurance', 'taxes', 'assignment'
    ]
  }
];

const STAGE_KEYS = [
  'uploaded', 'extracting', 'detecting_structure', 'segmenting',
  'analyzing_risk', 'generating_summaries', 'preparing_report'
];

const STAGE_LABELS = [
  'Document uploaded',
  'Extracting text',
  'Detecting document structure',
  'Segmenting clauses',
  'Analyzing risk',
  'Generating summaries',
  'Preparing report'
];

const DEMO_STAGES = STAGE_KEYS.map((key, index) => ({
  key,
  label: STAGE_LABELS[index],
  status: 'completed',
  detail: 'Demo data generated when the application was seeded',
  startedAt: null,
  finishedAt: null
}));

/** Build the persisted clause list for one demo agreement. */
function buildClauses(keys) {
  return keys.map((key, index) => {
    const blueprint = BLUEPRINT_BY_KEY[key];
    if (!blueprint) throw new Error(`Unknown demo clause blueprint: ${key}`);

    const rule = blueprint.ruleId ? RULES_BY_ID[blueprint.ruleId] : null;
    const ruleMatched = Boolean(rule);

    const reason = ruleMatched
      ? rule.explanation
      : blueprint.classification === 'Normal'
        ? 'This clause reads like a standard term and did not trigger any rule in the rulebook.'
        : 'This clause contains wording that the sample analysis could not classify confidently, so it is listed for review.';

    return {
      clauseNumber: String(index + 1),
      index,
      title: blueprint.title,
      originalText: blueprint.originalText,
      summary: blueprint.summary,
      classification: blueprint.classification,
      riskCategory: blueprint.riskCategory,
      confidence: blueprint.confidence,
      reason,
      regulatoryReference: blueprint.regulatoryReference || (rule ? rule.regulatoryReference : ''),
      ruleId: blueprint.ruleId || '',
      ruleSeverity: blueprint.ruleSeverity || '',
      ruleMatched,
      ruleResult: blueprint.classification,
      mlResult: blueprint.classification,
      mlConfidence: blueprint.confidence,
      engine: 'demo-seed',
      model: 'demo-seed (illustrative sample, not a real analysis)'
    };
  });
}

/** Build a full Agreement document shape from a demo blueprint. */
function buildAgreement(blueprint) {
  const clauses = buildClauses(blueprint.clausesKey);
  const evaluation = evaluateDocument(clauses);
  const uploadedAt = new Date(Date.now() - blueprint.hoursAgo * 60 * 60 * 1000);
  const analyzedAt = new Date(uploadedAt.getTime() + 60 * 1000);

  return {
    filename: blueprint.filename,
    originalFilename: blueprint.filename,
    storedFilename: '',
    sizeBytes: blueprint.sizeBytes,
    uploadedAt,
    analyzedAt,
    status: 'completed',
    error: '',
    extractionMethod: blueprint.extractionMethod,
    analysisSource: 'demo-seed',
    summarizerModel: 'demo-seed (illustrative sample)',
    totalClauses: clauses.length,
    riskSummary: evaluation.riskSummary,
    overallRiskScore: evaluation.overallRiskScore,
    overallRisk: evaluation.overallRisk,
    clauses,
    stages: DEMO_STAGES.map((stage) => ({ ...stage })),
    progress: 100,
    isDemo: true
  };
}

/** All demo agreements as stored documents. */
function buildDemoAgreements() {
  return AGREEMENT_BLUEPRINTS.map(buildAgreement);
}

/**
 * Seed demo agreements when the store is empty.
 * @param {object} repository agreement repository
 * @param {boolean} force insert even when agreements already exist
 */
async function seedDemoData(repository, force = false) {
  const existing = await repository.count();
  if (existing > 0 && !force) return { seeded: 0, skipped: true };

  const agreements = buildDemoAgreements();
  for (const agreement of agreements) {
    await repository.create(agreement);
  }
  return { seeded: agreements.length, skipped: false };
}

module.exports = {
  CLAUSE_BLUEPRINTS,
  AGREEMENT_BLUEPRINTS,
  buildDemoAgreements,
  seedDemoData
};
