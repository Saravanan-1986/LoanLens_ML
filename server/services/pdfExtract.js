'use strict';

/**
 * PDF text extraction for the server-side fallback pipeline.
 *
 * `pdf-parse` is a pure JavaScript extractor that works for digitally generated
 * PDFs. It cannot read scanned images - those need the OCR path in the Python
 * ML service. When pdf-parse is unavailable (or fails) the analysis continues
 * with an empty text result so the caller can decide to fall back to OCR.
 */

const fs = require('fs');
const logger = require('../utils/logger');

let pdfParse = null;
let loadError = null;

try {
  // The package's index.js runs a debug routine when required without a parent
  // module, so we import the implementation directly.
  pdfParse = require('pdf-parse/lib/pdf-parse.js');
} catch (error) {
  try {
    pdfParse = require('pdf-parse');
  } catch (innerError) {
    loadError = innerError;
    logger.warn(`pdf-parse is not installed - digital PDF extraction disabled (${innerError.message}).`);
  }
}

/**
 * @returns {Promise<{text: string, pages: number, method: string, error: string}>}
 */
async function extractPdfText(filePath) {
  if (!pdfParse) {
    return { text: '', pages: 0, method: 'unavailable', error: loadError ? loadError.message : 'pdf-parse missing' };
  }

  const buffer = await fs.promises.readFile(filePath);
  const parsed = await pdfParse(buffer);
  const text = String(parsed.text || '').trim();

  return {
    text,
    pages: parsed.numpages || 0,
    method: text.length > 0 ? 'pdf-parse' : 'empty',
    error: ''
  };
}

module.exports = { extractPdfText, isPdfParserAvailable: () => Boolean(pdfParse) };
