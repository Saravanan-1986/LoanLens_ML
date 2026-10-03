/**
 * Dashboard controller - everything the landing dashboard needs in one call.
 */

const repository = require('../services/agreementRepository');
const { buildAggregateStats, toRecentItem } = require('../services/statsService');
const riskService = require('../services/riskService');
const { RISK_RULES } = require('../rules/riskRules');
const mlService = require('../services/mlService');
const { getDbStatus } = require('../config/db');
const analysisPipeline = require('../services/analysisPipeline');

/** GET /api/dashboard/stats */
async function getDashboardStats(req, res, next) {
  try {
    const agreements = await repository.list({ limit: 200, ownerId: req.user.id });
    const stats = buildAggregateStats(agreements);
    const completed = agreements.filter((item) => item.status === 'completed');
    const latest = completed[0] || null;

    res.json({
      success: true,
      data: {
        ...stats,
        recentAnalysis: latest
          ? {
              ...toRecentItem(latest),
              extractionMethod: latest.extractionMethod || '',
              analysisSource: latest.analysisSource || '',
              documentSummary: latest.documentSummary || '',
              summaryLine: latest.riskSummary || { normal: 0, needsReview: 0, risky: 0 }
            }
          : null,
        recentAgreements: completed.slice(0, 6).map(toRecentItem),
        inProgress: agreements
          .filter((item) => item.status === 'processing' || item.status === 'uploaded')
          .slice(0, 3)
          .map((item) => ({
            id: String(item.id),
            filename: item.filename,
            status: item.status,
            progress: item.progress || 0
          })),
        activeRules: RISK_RULES.length,
        disclaimer:
          'LoanLens is an awareness and screening tool and does not provide legal advice.'
      }
    });
  } catch (error) {
    next(error);
  }
}

/** GET /api/dashboard/meta - rulebook, engine status and pipeline description. */
async function getDashboardMeta(req, res, next) {
  try {
    const mlAvailable = await mlService.isAvailable();
    const mlHealth = mlAvailable ? await mlService.health() : null;
    const mlEngines = (mlHealth && mlHealth.engines) || null;

    res.json({
      success: true,
      data: {
        rulebook: RISK_RULES.map((rule) => ({
          ruleId: rule.ruleId,
          name: rule.name,
          category: rule.category,
          severity: rule.severity,
          explanation: rule.explanation,
          regulatoryReference: rule.regulatoryReference,
          regulatoryVerified: rule.regulatoryVerified
        })),
        pipeline: analysisPipeline.STAGE_DEFINITIONS,
        engines: {
          mlService: {
            url: mlService.baseUrl,
            available: mlAvailable,
            classifier: (mlEngines && mlEngines.classifier) || null,
            summarizer: (mlEngines && mlEngines.summarizer) || null,
            extraction: (mlEngines && mlEngines.extraction) || null,
            notice: (mlHealth && mlHealth.notice) || ''
          },
          ruleEngine: { available: true, rules: RISK_RULES.length },
          database: getDbStatus(),
          scoring: {
            weights: riskService.CLAUSE_WEIGHTS,
            amplifier: riskService.RISK_AMPLIFIER,
            bands: riskService.RISK_BANDS
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getDashboardStats, getDashboardMeta };
