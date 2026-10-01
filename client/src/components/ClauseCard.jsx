import { useState } from 'react';
import { BookOpenText, ChevronDown, Cpu, FileText, Gavel, Sparkles } from 'lucide-react';

import RiskBadge from './RiskBadge';
import { percent } from '../utils/format';
import { RISK } from '../utils/constants';

/**
 * Expandable clause card.
 * Collapsed: title + badge + short summary.
 * Expanded: original text, summary, explanation, rule + ML provenance.
 */
export default function ClauseCard({ clause, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const tone =
    clause.classification === RISK.RISKY ? 'risky' : clause.classification === RISK.NORMAL ? 'normal' : 'review';

  return (
    <article className={`clause ${tone} ${open ? 'open' : ''}`.trim()}>
      <button type="button" className="clause-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="clause-num">{clause.clauseNumber}</span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="clause-title">{clause.title}</span>
          <span className="clause-summary">{clause.summary}</span>
        </span>
        <RiskBadge classification={clause.classification} size="sm" showIcon={false} />
        <ChevronDown size={17} className={`clause-chevron ${open ? 'open' : ''}`.trim()} />
      </button>

      {open ? (
        <div className="clause-body">
          <div className="block">
            <div className="block-label">
              <FileText size={13} />
              Original clause
            </div>
            <blockquote className="quote">“{clause.originalText}”</blockquote>
          </div>

          <div className="block">
            <div className="block-label">
              <Sparkles size={13} />
              Plain-language summary
            </div>
            <p className="summary-text">{clause.summary}</p>
          </div>

          <div className="block">
            <div className="block-label">
              <Gavel size={13} />
              Why this was flagged
            </div>
            <p className="text-sm">{clause.reason}</p>
          </div>

          <div className="meta-tiles">
            <div className="meta-tile">
              <span className="k">Risk category</span>
              <span className="v">{clause.riskCategory || 'Uncategorised'}</span>
            </div>
            <div className="meta-tile">
              <span className="k">Confidence</span>
              <span className="v">{percent(clause.confidence, 0)}</span>
            </div>
            <div className="meta-tile">
              <span className="k">Engine</span>
              <span className="v">{clause.engine || 'analysis pipeline'}</span>
            </div>
            <div className="meta-tile">
              <span className="k">Model</span>
              <span className="v">{clause.model || 'heuristic-fallback'}</span>
            </div>
          </div>

          <div className="two-col">
            <div className="prov">
              <div className="block-label">
                <BookOpenText size={13} />
                Rule engine
              </div>
              <p className="text-xs">
                {clause.ruleMatched
                  ? `Matched ${clause.ruleId || 'a rule'} (${clause.ruleSeverity || 'severity unknown'}) → ${clause.ruleResult || clause.classification}.`
                  : 'No rule in the rulebook matched this clause.'}
              </p>
            </div>
            <div className="prov">
              <div className="block-label">
                <Cpu size={13} />
                ML classifier
              </div>
              <p className="text-xs">
                {clause.mlResult
                  ? `${clause.mlResult}${clause.mlConfidence ? ` at ${percent(clause.mlConfidence, 0)} confidence` : ''}.`
                  : 'ML result unavailable - the combined decision used the rule engine.'}
              </p>
            </div>
          </div>

          {clause.regulatoryReference ? (
            <p className="reg-ref">Regulatory reference: {clause.regulatoryReference}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
