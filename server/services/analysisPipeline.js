'use strict';

/**
 * Analysis orchestrator.
 *
 * Runs the full pipeline for an uploaded agreement and persists progress after
 * every stage so `/analyze/:id/processing` can poll real backend status instead
 * of watching a fake timer:
 *
 *   upload -> extract (PDF/OCR) -> detect structure -> segment clauses
 *          -> rule engine + ML classification -> summarise -> risk score
 *
 * Every step prefers the Python ML service and falls back to the local
 * implementation, recording which engine produced the result.
 */

const path = require('path');
const config = require('../config/env');
const repository = require('./agreementRepository');
const mlService = require('./mlService');
const riskService = require('./riskService');
const documentService = require('./documentService');
const fallback = require('./fallbackAnalyzer');
const { extractPdfText } = require('./pdfExtract');
const logger = require('../utils/logger');

const STAGE_DEFINITIONS = [
  { key: 'uploaded', label: 'Document uploaded' },
  { key: 'extracting', label: 'Extracting text' },
  { key: 'detecting_structure', label: 'Detecting document structure' },
  { key: 'segmenting', label: 'Segmenting clauses' },
  { key: 'analyzing_risk', label: 'Analyzing risk' },
  { key: 'generating_summaries', label: 'Generating summaries' },
  { key: 'preparing_report', label: 'Preparing report' }
];

const MIN_TEXT_CHARS = 120;

/** Fresh stage list: the upload already happened, so stage 0 starts complete. */
function initialStages() {
  return STAGE_DEFINITIONS.map((stage, index) => ({
    key: stage.key,
    label: stage.label,
    status: index === 0 ? 'completed' : 'pending',
    detail: index === 0 ? 'File stored on the server' : '',
    startedAt: index === 0 ? new Date() : null,
    finishedAt: index === 0 ? new Date() : null
  }));
}

/** Proxy that keeps the stage list in sync with the database. */
function createTracker(agreementId) {
  const stages = initialStages();

  const progressOf = () => {
    const done = stages.filter((stage) => stage.status === 'completed').length;
    return Math.round((done / stages.length) * 100);
  };

  const sync = async (extra = {}) => {
    await repository.update(agreementId, {
      stages: stages.map((stage) => ({ ...stage })),
      progress: progressOf(),
      ...extra
    });
  };

  const set = async (key, status, detail = '') => {
    const stage = stages.find((entry) => entry.key === key);
    if (!stage) return;
    stage.status = status;
    if (detail) stage.detail = detail;
    if (status === 'active') stage.startedAt = new Date();
    if (status === 'completed' || status === 'failed') stage.finishedAt = new Date();
    await sync();
  };

  return { stages, sync, set };
}

/* ------------------------------------------------------------------ */
/* Stage helpers                                                       */
/* ------------------------------------------------------------------ */

/** Quick structural statistics used by the "detect structure" stage. */
function detectStructure(text) {
  const numbered = (text.match(/(?:^|\n)\s*\d{1,2}(?:\.\d{1,2})*\s*[).:]?\s+\S/g) || []).length;
  const lettered = (text.match(/(?:^|\n)\s*\([a-h]\)\s+\S/gi) || []).length;
  const headings = (text.match(/(?:^|\n)\s*(?:CLAUSE|ARTICLE|SECTION|TERM|SCHEDULE)\b[^\n]{0,60}/gi) || []).length;
  const paragraphs = text.split(/\n\s*\n/).filter((block) => block.trim().length > 60).length;
  return { numberedSections: numbered, letteredSections: lettered, headings, paragraphs };
}

/** Extract raw text, preferring the ML service (PyMuPDF/pdfplumber/Tesseract). */
async function extractText(agreement, tracker) {
  const filePath = path.join(config.uploadDir, agreement.storedFilename);
  const warnings = [];

  const mlResult = await mlService.extract(filePath, { filename: agreement.originalFilename });
  let text = '';
  let method = '';
  let pages = 0;

  if (mlResult) {
    text = mlResult.text;
    method = mlResult.method;
    pages = mlResult.pages;
    warnings.push(...(mlResult.warnings || []));
    tracker.mlAvailable = true;
  } else {
    const local = await extractPdfText(filePath);
    text = local.text;
    pages = local.pages;
    method = `${local.method}-server`;
    if (local.error) warnings.push(`Local extraction note: ${local.error}`);
  }

  tracker.extractionMethod = method;
  tracker.pages = pages;

  const usable = fallback.cleanText(text);
  const extracted = usable.replace(/\s/g, '').length;

  if (extracted < MIN_TEXT_CHARS) {
    if (method.startsWith('pdf') || method === 'empty-server') {
      warnings.push(
        'Very little selectable text was found. The document looks scanned, so an OCR pass is required for clause level analysis.'
      );
    }
  }

  return { text, cleaned: usable, method, pages, warnings, characters: extracted };
}

/* ------------------------------------------------------------------ */
/* Classification + summarisation (ML first, local fallback second)    */
/* ------------------------------------------------------------------ */

async function classifyClauses(clauses, tracker) {
  if (tracker.mlAvailable) {
    const results = await mlService.classify(clauses);
    if (results && results.length === clauses.length) return results;
    tracker.warnings.push('ML classification unavailable - used the built-in rule/heuristic fallback.');
  }
  return fallback.analyseClauses(clauses).map((entry) => ({
    index: entry.index,
    rule: entry.ruleMatch,
    ml: { ...entry.ml, model: 'heuristic-rules (not a trained model)' }
  }));
}

async function summarizeClauses(clauses, tracker) {
  if (tracker.mlAvailable) {
    const results = await mlService.summarize(clauses);
    if (results && results.length === clauses.length) return results;
    tracker.warnings.push('ML summariser unavailable - used the built-in rule-based summariser.');
  }
  return clauses.map((clause, index) => ({
    index,
    summary: fallback.summarizeHeuristic(clause.text),
    model: 'rule-based-summarizer (server fallback)'
  }));
}

/* ------------------------------------------------------------------ */
/* Main pipeline                                                       */
/* ------------------------------------------------------------------ */

async function runAnalysis(agreement) {
  const tracker = createTracker(agreement.id);
  tracker.mlAvailable = false;
  tracker.warnings = [];

  try {
    await tracker.sync({ status: 'processing', error: '', stages: tracker.stages.map((s) => ({ ...s })) });

    /* --- 1. Text extraction ------------------------------------- */
    await tracker.set('extracting', 'active');
    const extraction = await extractText(agreement, tracker);
    tracker.warnings.push(...extraction.warnings);

    if (extraction.characters < MIN_TEXT_CHARS) {
      await tracker.set(
        'extracting',
        'failed',
        'No selectable text found - the document may be a scanned image that OCR could not read.'
      );
      throw new documentService.DocumentError(
        'We could not read any text from this PDF. It may be a scanned image, password protected or corrupted. Please upload a text based agreement or enable the OCR extras in the ML service.',
        422,
        'EXTRACTION_FAILED'
      );
    }
    await tracker.set(
      'extracting',
      'completed',
      `${extraction.characters.toLocaleString()} characters via ${extraction.method}`
    );

    /* --- 2. Structure detection -------------------------------- */
    await tracker.set('detecting_structure', 'active');
    const structure = detectStructure(extraction.cleaned);
    await tracker.set(
      'detecting_structure',
      'completed',
      `${structure.numberedSections} numbered sections, ${structure.headings} headings detected`
    );

    /* --- 3. Clause segmentation -------------------------------- */
    await tracker.set('segmenting', 'active');
    let clauses = [];
    if (tracker.mlAvailable) {
      const segmented = await mlService.segment(extraction.text);
      if (segmented && segmented.clauses.length) clauses = segmented.clauses;
    }
    if (!clauses.length) {
      clauses = fallback.segmentClauses(extraction.text).map((clause, index) => ({
        index,
        clauseNumber: clause.clauseNumber,
        title: clause.title,
        text: clause.text
      }));
    }

    if (!clauses.length) {
      await tracker.set('segmenting', 'failed', 'No clauses could be identified in this document.');
      throw new documentService.DocumentError(
        'We could not split this document into clauses. It may not be a loan agreement, or the text layout is unusual.',
        422,
        'SEGMENTATION_FAILED'
      );
    }
    await tracker.set('segmenting', 'completed', `${clauses.length} clauses identified`);

    /* --- 4. Risk analysis (rule engine + ML) ------------------- */
    await tracker.set('analyzing_risk', 'active');
    const classifications = await classifyClauses(clauses, tracker);
    const ruleMatches = classifications.filter((item) => item.rule).length;
    await tracker.set(
      'analyzing_risk',
      'completed',
      ruleMatches
        ? `${ruleMatches} clauses matched the risk rulebook`
        : 'Rule engine found no matches; classifier results applied'
    );

    /* --- 5. Summarisation -------------------------------------- */
    await tracker.set('generating_summaries', 'active');
    const summaries = await summarizeClauses(clauses, tracker);
    const summarizerModel = summaries[0] ? summaries[0].model : 'unknown';
    await tracker.set(
      'generating_summaries',
      'completed',
      `${summaries.length} plain-English summaries generated`
    );

    /* --- 6. Assemble report + score ---------------------------- */
    await tracker.set('preparing_report', 'active');

    const engine = tracker.mlAvailable ? 'ml-service' : 'server-fallback';
    const finalClauses = clauses.map((clause, index) => {
      const entry = classifications[index] || { rule: null, ml: null };
      const combined = riskService.combineClause(entry.rule, entry.ml);
      return {
        clauseNumber: String(clause.clauseNumber || index + 1),
        index,
        title: clause.title || `Clause ${index + 1}`,
        originalText: clause.text,
        summary: (summaries[index] && summaries[index].summary) || 'Summary unavailable for this clause.',
        classification: combined.classification,
        riskCategory: combined.riskCategory,
        confidence: combined.confidence,
        reason: combined.reason,
        regulatoryReference: combined.regulatoryReference,
        ruleId: combined.ruleId,
        ruleSeverity: combined.ruleSeverity,
        ruleMatched: combined.ruleMatched,
        ruleResult: combined.ruleResult,
        mlResult: combined.mlResult,
        mlConfidence: combined.mlConfidence,
        engine,
        model: (entry.ml && entry.ml.model) || 'unknown'
      };
    });

    const evaluation = riskService.evaluateDocument(finalClauses);

    await repository.update(agreement.id, {
      clauses: finalClauses,
      totalClauses: finalClauses.length,
      riskSummary: evaluation.riskSummary,
      overallRiskScore: evaluation.overallRiskScore,
      overallRisk: evaluation.overallRisk,
      extractionMethod: extraction.method,
      analysisSource: engine,
      summarizerModel,
      status: 'completed',
      error: '',
      analyzedAt: new Date()
    });

    await tracker.set(
      'preparing_report',
      'completed',
      `Overall risk ${evaluation.overallRisk} (${evaluation.overallRiskScore}/100)`
    );
    await tracker.sync({ status: 'completed', progress: 100 });

    logger.info(
      `Analysis complete for ${agreement.filename} (${finalClauses.length} clauses, engine: ${engine}).`
    );

    return { clauses: finalClauses, ...evaluation, engine, summarizerModel, warnings: tracker.warnings };
  } catch (error) {
    const message =
      error instanceof documentService.DocumentError
        ? error.message
        : 'Analysis failed while processing this document. Please try again or upload a different PDF.';

    logger.error(`Analysis failed for ${agreement.filename}: ${error.message}`);

    const activeStage = tracker.stages.find((stage) => stage.status === 'active');
    if (activeStage) {
      activeStage.status = 'failed';
      activeStage.finishedAt = new Date();
      activeStage.detail = message;
    }

    await repository.update(agreement.id, {
      status: 'failed',
      error: message,
      stages: tracker.stages.map((stage) => ({ ...stage }))
    });

    throw error;
  }
}

/** Kick off an analysis without blocking the HTTP request. */
async function startAnalysis(agreement) {
  const stages = initialStages();
  await repository.update(agreement.id, {
    status: 'processing',
    error: '',
    progress: 0,
    stages,
    clauses: [],
    totalClauses: 0,
    riskSummary: { normal: 0, needsReview: 0, risky: 0 },
    overallRiskScore: 0,
    overallRisk: 'Low'
  });

  runAnalysis(agreement).catch(() => {
    /* runAnalysis already persisted the failure state. */
  });

  return stages;
}

module.exports = { STAGE_DEFINITIONS, initialStages, startAnalysis, runAnalysis, detectStructure };
