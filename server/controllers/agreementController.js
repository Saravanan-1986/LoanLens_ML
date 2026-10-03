'use strict';

/**
 * Agreement controller - HTTP layer only.
 * All document processing lives in the service layer (`analysisPipeline`,
 * `documentService`, `mlService`).
 */

const path = require('path');
const fs = require('fs');
const repository = require('../services/agreementRepository');
const analysisPipeline = require('../services/analysisPipeline');
const documentService = require('../services/documentService');
const riskService = require('../services/riskService');
const { buildAggregateStats } = require('../services/statsService');
const { sanitizeFilename, clampString } = require('../utils/sanitize');
const config = require('../config/env');

/**
 * Convert a stored record into the shape the frontend consumes.
 * `storedFilename` and `ownerId` are deliberately omitted so filesystem and
 * ownership details never leak.
 */
function toPublic(agreement) {
  if (!agreement) return null;
  const {
    storedFilename,
    ownerId,
    _id,
    __v,
    updatedAt,
    createdAt,
    clauses,
    ...rest
  } = agreement;

  return {
    ...rest,
    id: String(agreement.id),
    fileSizeLabel: documentService.formatBytes(agreement.sizeBytes)
  };
}

/** Lightweight list row (no clause payload, but keeps the document summary). */
function toListItem(agreement) {
  const pub = toPublic(agreement);
  return {
    id: pub.id,
    filename: pub.filename,
    uploadedAt: pub.uploadedAt,
    analyzedAt: pub.analyzedAt,
    status: pub.status,
    totalClauses: pub.totalClauses,
    overallRisk: pub.overallRisk,
    overallRiskScore: pub.overallRiskScore,
    riskSummary: pub.riskSummary,
    documentSummary: pub.documentSummary || '',
    summaryHighlights: pub.summaryHighlights || [],
    fileSizeLabel: pub.fileSizeLabel,
    error: pub.error
  };
}

/** True when the signed-in user owns this agreement. */
function isOwner(agreement, user) {
  if (!agreement || !user) return false;
  return String(agreement.ownerId || '') === String(user.id);
}

/** POST /api/agreements/upload */
async function uploadAgreement(req, res, next) {
  try {
    const publicPath = req.file ? req.file.path : null;
    try {
      await documentService.validateUpload(req.file);
    } catch (error) {
      // Never leave an invalid upload on disk.
      await documentService.removeFile(publicPath);
      throw error;
    }

    const passwordProtected = await documentService.isPasswordProtected(req.file.path);
    if (passwordProtected) {
      await documentService.removeFile(publicPath);
      throw new documentService.DocumentError(
        'This PDF appears to be password protected. Please remove the password and upload it again.',
        422,
        'PASSWORD_PROTECTED'
      );
    }

    const originalFilename = sanitizeFilename(req.file.originalname);

    const agreement = await repository.create({
      ownerId: req.user.id,
      filename: originalFilename,
      originalFilename,
      storedFilename: path.basename(req.file.path),
      sizeBytes: req.file.size,
      uploadedAt: new Date(),
      status: 'uploaded',
      isDemo: false,
      progress: 0
    });

    res.status(201).json({
      success: true,
      data: {
        ...toPublic(agreement),
        message: 'Upload complete. Start the analysis when you are ready.'
      }
    });
  } catch (error) {
    next(error);
  }
}

/** POST /api/agreements/:id/analyze */
async function analyzeAgreement(req, res, next) {
  try {
    const agreement = await repository.findById(req.params.id);
    if (!agreement || !isOwner(agreement, req.user)) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'That agreement could not be found.' }
      });
    }

    if (agreement.status === 'processing') {
      return res.status(202).json({
        success: true,
        data: { id: agreement.id, status: 'processing', stages: agreement.stages || [] }
      });
    }

    if (!agreement.storedFilename) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'SOURCE_MISSING',
          message: 'The original PDF for this agreement is no longer available on the server.'
        }
      });
    }

    const filePath = path.join(config.uploadDir, agreement.storedFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'SOURCE_MISSING',
          message: 'The original PDF for this agreement is no longer available on the server.'
        }
      });
    }

    const stages = await analysisPipeline.startAnalysis(agreement);

    res.status(202).json({
      success: true,
      data: { id: agreement.id, status: 'processing', stages, progress: 0 }
    });
  } catch (error) {
    next(error);
  }
}

/** GET /api/agreements */
async function listAgreements(req, res, next) {
  try {
    const status = ['uploaded', 'processing', 'completed', 'failed'].includes(req.query.status)
      ? req.query.status
      : undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const search = clampString(req.query.search, 80).toLowerCase();

    let agreements = await repository.list({ status, limit: 200, ownerId: req.user.id });
    if (search) {
      agreements = agreements.filter((item) => item.filename.toLowerCase().includes(search));
    }

    const items = agreements.slice(0, limit).map(toListItem);

    res.json({
      success: true,
      data: {
        agreements: items,
        total: agreements.length,
        stats: buildAggregateStats(agreements)
      }
    });
  } catch (error) {
    next(error);
  }
}

/** GET /api/agreements/:id */
async function getAgreement(req, res, next) {
  try {
    const agreement = await repository.findById(req.params.id);
    if (!agreement || !isOwner(agreement, req.user)) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'That agreement could not be found.' }
      });
    }

    res.json({
      success: true,
      data: {
        agreement: toPublic(agreement),
        clauses: agreement.clauses || [],
        stages: agreement.stages || []
      }
    });
  } catch (error) {
    next(error);
  }
}

/** GET /api/agreements/:id/report */
async function getAgreementReport(req, res, next) {
  try {
    const agreement = await repository.findById(req.params.id);
    if (!agreement || !isOwner(agreement, req.user)) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'That agreement could not be found.' }
      });
    }

    if (agreement.status !== 'completed') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'REPORT_NOT_READY',
          message:
            agreement.status === 'failed'
              ? agreement.error || 'The analysis for this agreement did not complete.'
              : 'This agreement is still being analysed. Please wait for the analysis to finish.'
        },
        data: { status: agreement.status, progress: agreement.progress, stages: agreement.stages || [] }
      });
    }

    const clauses = agreement.clauses || [];
    const evaluation = riskService.evaluateDocument(clauses);

    const categoryCounts = clauses.reduce((acc, clause) => {
      const key = clause.riskCategory || 'Uncategorised';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        agreement: toPublic(agreement),
        riskSummary: agreement.riskSummary,
        overallRiskScore: agreement.overallRiskScore,
        overallRisk: agreement.overallRisk,
        documentSummary: agreement.documentSummary || '',
        summaryHighlights: agreement.summaryHighlights || [],
        summaryModel: agreement.summaryModel || '',
        formula: evaluation.formula,
        clauses,
        categoryBreakdown: Object.entries(categoryCounts)
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count),
        topRisks: clauses
          .filter((clause) => clause.classification === 'Risky')
          .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
          .slice(0, 5)
          .map((clause) => ({
            clauseNumber: clause.clauseNumber,
            title: clause.title,
            riskCategory: clause.riskCategory,
            confidence: clause.confidence,
            ruleId: clause.ruleId,
            reason: clause.reason
          })),
        disclaimer:
          'LoanLens is an awareness and screening tool. It does not provide legal advice or determine whether a loan agreement is legally enforceable.'
      }
    });
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/agreements/:id */
async function deleteAgreement(req, res, next) {
  try {
    const existing = await repository.findById(req.params.id);
    if (!existing || !isOwner(existing, req.user)) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'That agreement could not be found.' }
      });
    }

    const agreement = await repository.remove(req.params.id);
    if (!agreement) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'That agreement could not be found.' }
      });
    }

    if (agreement.storedFilename) {
      await documentService.removeFile(path.join(config.uploadDir, agreement.storedFilename));
    }

    res.json({ success: true, data: { id: agreement.id, deleted: true } });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadAgreement,
  analyzeAgreement,
  listAgreements,
  getAgreement,
  getAgreementReport,
  deleteAgreement
};
