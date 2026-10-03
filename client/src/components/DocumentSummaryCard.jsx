import { CheckCircle2, Sparkles } from 'lucide-react';

/**
 * Plain-English overview of a whole agreement.
 *
 * The text is produced server-side (services/documentSummaryService.js) from the
 * clause decisions that were already made, so it never invents facts that are
 * not present in the analysed clauses. Shown alongside - never instead of - the
 * clause-by-clause report.
 */
export default function DocumentSummaryCard({ summary, highlights = [], model = '', title = 'Document summary' }) {
  if (!summary) return null;

  const bullets = Array.isArray(highlights) ? highlights.filter(Boolean) : [];

  return (
    <div className="card doc-summary-card" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <div>
          <h3>
            <Sparkles size={15} style={{ display: 'inline', marginRight: 6, verticalAlign: '-2px' }} />
            {title}
          </h3>
          <p className="card-sub">
            A short, plain-English overview of the whole document
            {model ? ` • ${model}` : ''}
          </p>
        </div>
      </div>
      <div className="card-body stack-3">
        <p className="doc-summary-text">{summary}</p>
        {bullets.length ? (
          <ul className="doc-summary-list">
            {bullets.map((item, index) => (
              <li key={index}>
                <CheckCircle2 size={14} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
