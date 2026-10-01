'use strict';

/**
 * Mongoose schema for an analysed loan agreement.
 *
 * Demo records (created by the seeder) carry `isDemo: true` so the UI can label
 * them honestly as sample data instead of real analysis output.
 */

const mongoose = require('mongoose');

const ClauseSchema = new mongoose.Schema(
  {
    clauseNumber: { type: String, default: '' },
    index: { type: Number, default: 0 },
    title: { type: String, default: 'Clause' },
    originalText: { type: String, default: '' },
    summary: { type: String, default: '' },
    classification: {
      type: String,
      enum: ['Normal', 'Needs Review', 'Risky'],
      default: 'Needs Review'
    },
    riskCategory: { type: String, default: 'Uncategorised' },
    confidence: { type: Number, default: 0 },
    reason: { type: String, default: '' },
    regulatoryReference: { type: String, default: '' },
    ruleId: { type: String, default: '' },
    ruleSeverity: { type: String, default: '' },
    ruleMatched: { type: Boolean, default: false },
    ruleResult: { type: String, default: 'Normal' },
    mlResult: { type: String, default: 'Needs Review' },
    mlConfidence: { type: Number, default: 0 },
    engine: { type: String, default: 'rule-engine' },
    model: { type: String, default: 'heuristic-fallback' }
  },
  { _id: false }
);

const StageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'failed'],
      default: 'pending'
    },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    detail: { type: String, default: '' }
  },
  { _id: false }
);

const AgreementSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalFilename: { type: String, default: '' },
    storedFilename: { type: String, default: '' },
    sizeBytes: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
    analyzedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'completed', 'failed'],
      default: 'uploaded'
    },
    error: { type: String, default: '' },
    extractionMethod: { type: String, default: '' },
    analysisSource: { type: String, default: '' },
    summarizerModel: { type: String, default: '' },
    totalClauses: { type: Number, default: 0 },
    riskSummary: {
      normal: { type: Number, default: 0 },
      needsReview: { type: Number, default: 0 },
      risky: { type: Number, default: 0 }
    },
    overallRiskScore: { type: Number, default: 0 },
    overallRisk: { type: String, default: 'Low' },
    clauses: { type: [ClauseSchema], default: [] },
    stages: { type: [StageSchema], default: [] },
    progress: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

AgreementSchema.index({ uploadedAt: -1 });
AgreementSchema.index({ status: 1 });

module.exports = mongoose.models.Agreement || mongoose.model('Agreement', AgreementSchema);
