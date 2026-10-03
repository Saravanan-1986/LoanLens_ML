import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, Trash2 } from 'lucide-react';

import useAsync from '../hooks/useAsync';
import PageHeader from '../components/PageHeader';
import ScoreMeter from '../components/ScoreMeter';
import DistributionBar from '../components/DistributionBar';
import PipelineStages from '../components/PipelineStages';
import ClauseCard from '../components/ClauseCard';
import Disclaimer from '../components/Disclaimer';
import DocumentSummaryCard from '../components/DocumentSummaryCard';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { analyzeAgreement, deleteAgreement, getAgreement } from '../services/api';
import { fileStem, formatDateTime, pluralize } from '../utils/format';

/**
 * Agreement detail: file metadata, pipeline outcome, risk summary and the
 * clauses that were flagged. Full clause-by-clause reading lives on /report/:id.
 */
export default function AgreementDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data, error, loading, reload } = useAsync(() => getAgreement(id), [id]);
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');

  const a = data?.agreement || null;
  const clauses = Array.isArray(data?.clauses) ? data.clauses : [];
  const stages = Array.isArray(data?.stages) ? data.stages : [];
  const flagged = clauses
    .filter((clause) => clause.classification && clause.classification !== 'Normal')
    .slice(0, 8);

  const remove = async () => {
    if (!a || !window.confirm(`Delete "${a.filename}"? This cannot be undone.`)) return;
    setBusy('delete');
    setActionError('');
    try {
      await deleteAgreement(id);
      nav('/agreements');
    } catch (e) {
      setActionError(e.message || 'Could not delete this agreement.');
      setBusy('');
    }
  };

  const reanalyze = async () => {
    setBusy('analyze');
    setActionError('');
    try {
      await analyzeAgreement(id);
      nav(`/analyze/${encodeURIComponent(id)}/processing`);
    } catch (e) {
      setActionError(e.message || 'Could not start the analysis.');
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="fade-in">
        <SkeletonBlock height={14} width={130} />
        <div style={{ marginTop: 10 }}>
          <SkeletonBlock height={28} width={340} />
        </div>
        <div style={{ marginTop: 18 }}>
          <SkeletonCard height={180} />
        </div>
        <div style={{ marginTop: 16 }}>
          <SkeletonCard height={240} />
        </div>
      </div>
    );
  }

  if (error) {
    const notFound = error.status === 404;
    return (
      <div className="fade-in">
        <div className="card">
          <div className="card-body">
            {notFound ? (
              <EmptyState
                icon={AlertTriangle}
                title="Agreement not found"
                text="This agreement does not exist any more. It may have been deleted."
                actions={<Link className="btn btn-primary" to="/agreements">Back to my agreements</Link>}
              />
            ) : (
              <ErrorState error={error} title="Could not load this agreement" onRetry={reload} />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!a) {
    return (
      <div className="fade-in">
        <div className="card">
          <div className="card-body">
            <EmptyState
              icon={AlertTriangle}
              title="Agreement not found"
              text="This agreement does not exist any more. It may have been deleted."
              actions={<Link className="btn btn-primary" to="/agreements">Back to my agreements</Link>}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Agreement"
        title={fileStem(a.filename)}
        subtitle={`Uploaded ${formatDateTime(a.uploadedAt)}${a.analyzedAt ? ` • Analyzed ${formatDateTime(a.analyzedAt)}` : ''}${a.totalClauses ? ` • ${pluralize(a.totalClauses, 'clause')}` : ''}`}
        actions={
          <div className="row row-gap-2 wrap">
            <Link className="btn btn-secondary btn-sm" to="/agreements">
              <RefreshCw size={14} /> Back to library
            </Link>
            {a.status === 'completed' ? (
              <Link className="btn btn-primary btn-sm" to={`/report/${encodeURIComponent(id)}`}>
                View full report <ArrowRight size={14} />
              </Link>
            ) : null}
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={remove}
              disabled={Boolean(busy)}
            >
              {busy === 'delete' ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} Delete
            </button>
          </div>
        }
      />

      {actionError ? (
        <p className="inline-alert error" style={{ marginBottom: 14 }}>
          <AlertTriangle size={15} />
          <span>{actionError}</span>
        </p>
      ) : null}

      {a.status === 'failed' ? (
        <p className="inline-alert error" style={{ marginBottom: 14 }}>
          <AlertTriangle size={15} />
          <span>{a.error || 'The analysis did not complete. You can retry it below.'}</span>
        </p>
      ) : null}

      <div className="page-grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <h3>File details</h3>
            <span className={`status-pill ${a.status === 'completed' ? 'ok' : a.status === 'failed' ? 'bad' : 'warn'}`}>{a.status}</span>
          </div>
          <div className="card-body">
            <div className="kv-grid">
              <div className="kv"><div className="k">File name</div><div className="v">{a.filename}</div></div>
              <div className="kv"><div className="k">Size</div><div className="v">{a.fileSizeLabel || '—'}</div></div>
              <div className="kv"><div className="k">Uploaded</div><div className="v">{formatDateTime(a.uploadedAt)}</div></div>
              <div className="kv"><div className="k">Analyzed</div><div className="v">{a.analyzedAt ? formatDateTime(a.analyzedAt) : 'Not analyzed yet'}</div></div>
              <div className="kv"><div className="k">Clauses</div><div className="v">{a.totalClauses ? pluralize(a.totalClauses, 'clause') : '—'}</div></div>
              <div className="kv"><div className="k">Extraction</div><div className="v">{a.extractionMethod || '—'}</div></div>
            </div>
            <div className="row row-gap-2 wrap" style={{ marginTop: 14 }}>
              <span className="text-xs muted">Record ID: <span className="mono">{a.id}</span></span>
            </div>
          </div>
        </div>

        <div className="column-stack">
          {a.status === 'completed' ? (
            <div className="card">
              <div className="card-head"><h3>Risk overview</h3></div>
              <div className="card-body stack-4">
                <ScoreMeter score={a.overallRiskScore} band={a.overallRisk} compact />
                <DistributionBar summary={a.riskSummary || {}} total={a.totalClauses} />
                <div className="row row-gap-2 wrap">
                  <Link className="btn btn-primary btn-sm" to={`/report/${encodeURIComponent(id)}`}>
                    Open clause report <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-head"><h3>Analysis pipeline</h3></div>
              <div className="card-body stack-3">
                <div className="row-between">
                  <span className="text-sm muted">Progress</span>
                  <span className="strong">{a.progress || 0}%</span>
                </div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${a.progress || 0}%` }} /></div>
                <PipelineStages stages={stages} />
                <div className="row row-gap-2 wrap">
                  {a.status !== 'failed' ? (
                    <Link className="btn btn-primary btn-sm" to={`/analyze/${encodeURIComponent(id)}/processing`}>
                      Open live status <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <button type="button" className="btn btn-primary btn-sm" onClick={reanalyze} disabled={Boolean(busy)}>
                      {busy === 'analyze' ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Retry analysis
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {a.status === 'completed' ? (
        <DocumentSummaryCard
          summary={a.documentSummary}
          highlights={a.summaryHighlights}
          model={a.summaryModel}
        />
      ) : null}

      {a.status === 'completed' && flagged.length ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <div>
              <h3>Clauses needing attention</h3>
              <p className="card-sub">
                {flagged.length} of {clauses.length || a.totalClauses || 0} clauses were flagged for review
              </p>
            </div>
            <Link className="view-link" to={`/report/${encodeURIComponent(id)}`}>
              Open full report
              <ArrowRight size={13} />
            </Link>
          </div>
          <div className="card-body">
            <div className="clause-list">
              {flagged.map((clause) => (
                <ClauseCard
                  key={`${clause.index}-${clause.clauseNumber}`}
                  clause={clause}
                  defaultOpen={clause.classification === 'Risky'}
                />
              ))}
            </div>
            <div className="row row-gap-2 wrap" style={{ marginTop: 14 }}>
              <Link className="btn btn-secondary btn-sm" to={`/report/${encodeURIComponent(id)}`}>
                Review every clause <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <Disclaimer />
    </div>
  );
}



