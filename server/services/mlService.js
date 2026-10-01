'use strict';

/**
 * Client for the Python FastAPI ML service.
 *
 * Every call returns `null` (after logging a warning) when the service is
 * unreachable, so the analysis pipeline can transparently fall back to the
 * local Node implementation instead of failing the whole request.
 */

const axios = require('axios');
const fs = require('fs');
const config = require('../config/env');
const logger = require('../utils/logger');

const http = axios.create({
  baseURL: config.mlServiceUrl,
  timeout: config.mlTimeoutMs,
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
  headers: { 'Content-Type': 'application/json' }
});

let availabilityCache = { checkedAt: 0, available: false };

/** Lightweight health probe (cached for 15 seconds to avoid hammering). */
async function isAvailable(force = false) {
  const now = Date.now();
  if (!force && now - availabilityCache.checkedAt < 15000) return availabilityCache.available;

  try {
    const { data } = await http.get('/health', { timeout: 4000 });
    availabilityCache = { checkedAt: now, available: Boolean(data && data.status === 'ok') };
  } catch (error) {
    availabilityCache = { checkedAt: now, available: false };
  }
  return availabilityCache.available;
}

async function post(path, payload, label) {
  try {
    const { data } = await http.post(path, payload);
    return data;
  } catch (error) {
    const detail = error.response ? `HTTP ${error.response.status}` : error.code || error.message;
    logger.warn(`ML service call ${label || path} failed (${detail}) - using local fallback.`);
    return null;
  }
}

/** Full /health payload from the ML service (engines, model names, metrics). */
async function health() {
  try {
    const { data } = await http.get('/health', { timeout: 8000 });
    return data || null;
  } catch (error) {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Response normalisation                                              */
/* The Python service speaks snake_case; the rest of the Node app uses  */
/* camelCase. Mapping happens here so it is the single boundary.        */
/* ------------------------------------------------------------------ */

function normaliseClauses(payload) {
  const source = (payload && (payload.clauses || payload.results)) || [];
  if (!Array.isArray(source)) return [];
  return source.map((clause, index) => ({
    index: Number.isFinite(clause.index) ? clause.index : index,
    clauseNumber: String(clause.clause_number ?? clause.clauseNumber ?? index + 1),
    title: String(clause.title || `Clause ${index + 1}`),
    text: String(clause.text || clause.original_text || clause.originalText || '')
  }));
}

/**
 * Extract text from a PDF (digital -> PyMuPDF/pdfplumber, scanned -> OCR).
 * The document is sent as base64 so the ML service does not need shared disk
 * access when it runs on another host.
 */
async function extract(filePath, options = {}) {
  let fileB64;
  try {
    fileB64 = await fs.promises.readFile(filePath, { encoding: 'base64' });
  } catch (error) {
    logger.error(`Unable to read upload for extraction: ${error.message}`);
    return null;
  }

  const data = await post(
    '/extract',
    {
      file_b64: fileB64,
      filename: options.filename || '',
      allow_ocr: options.allowOcr !== false
    },
    'extract'
  );
  if (!data) return null;

  return {
    text: String(data.text || ''),
    pages: Number(data.pages || 0),
    method: String(data.method || 'unknown'),
    ocrUsed: Boolean(data.ocr_used),
    characters: Number(data.characters || String(data.text || '').length),
    warnings: Array.isArray(data.warnings) ? data.warnings : []
  };
}

async function segment(text) {
  const data = await post('/segment', { text }, 'segment');
  if (!data) return null;
  return {
    clauses: normaliseClauses(data),
    structure: data.structure || {},
    cleanedText: String(data.cleaned_text || '')
  };
}

async function classify(clauses) {
  const data = await post(
    '/classify',
    {
      clauses: clauses.map((clause) => ({
        clause_number: String(clause.clauseNumber || ''),
        title: clause.title || '',
        text: clause.text || ''
      }))
    },
    'classify'
  );
  if (!data || !Array.isArray(data.results)) return null;

  return data.results.map((entry, index) => ({
    index: Number.isFinite(entry.index) ? entry.index : index,
    rule: entry.rule
      ? {
          ruleId: entry.rule.rule_id,
          name: entry.rule.name,
          category: entry.rule.category,
          severity: entry.rule.severity,
          explanation: entry.rule.explanation,
          regulatoryReference: entry.rule.regulatory_reference || '',
          regulatoryVerified: Boolean(entry.rule.regulatory_verified)
        }
      : null,
    ml: {
      classification: entry.ml && entry.ml.classification,
      confidence: entry.ml && entry.ml.confidence,
      reason: (entry.ml && entry.ml.reason) || '',
      category: (entry.ml && entry.ml.category) || 'Uncategorised',
      model: (entry.ml && entry.ml.model) || 'unknown'
    }
  }));
}

async function summarize(clauses) {
  const data = await post(
    '/summarize',
    {
      clauses: clauses.map((clause) => ({
        clause_number: String(clause.clauseNumber || ''),
        title: clause.title || '',
        text: clause.text || ''
      }))
    },
    'summarize'
  );
  if (!data || !Array.isArray(data.summaries)) return null;

  return data.summaries.map((entry, index) => ({
    index: Number.isFinite(entry.index) ? entry.index : index,
    summary: String(entry.summary || ''),
    model: String(entry.model || 'unknown')
  }));
}

/**
 * One-shot analysis (the whole pipeline inside the ML service).
 * Kept for API completeness; the Node pipeline uses the granular calls so it
 * can surface real per-stage progress to the UI.
 */
async function analyze(payload) {
  const data = await post('/analyze', payload, 'analyze');
  if (!data) return null;
  return {
    clauses: normaliseClauses(data),
    riskSummary: data.risk_summary || {},
    overallScore: Number(data.overall_score || 0),
    engine: data.engine || null
  };
}

module.exports = {
  isAvailable,
  health,
  extract,
  segment,
  classify,
  summarize,
  analyze,
  baseUrl: config.mlServiceUrl
};
