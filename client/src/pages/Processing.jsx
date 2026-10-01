import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import PipelineStages from '../components/PipelineStages';
import ErrorState from '../components/ErrorState';
import useAgreementProgress from '../hooks/useAgreementProgress';
import { fileStem } from '../utils/format';
export default function Processing() {
  const { id } = useParams();
  const nav = useNavigate();
  const { agreement, stages, progress, status, loading, error } = useAgreementProgress(id);
  useEffect(() => {
    if (status === 'completed' && id) {
      const t = setTimeout(() => nav(`/report/${encodeURIComponent(id)}`), 900);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [status, id, nav]);
  return (
    <div className="fade-in">
      <PageHeader eyebrow="Analysis in progress" title={agreement?.filename ? fileStem(agreement.filename) : 'Analyzing agreement'} subtitle="Live pipeline status from the backend — no fake timers." />
      <div className="page-grid-2">
        <div className="card"><div className="card-body">
          {loading ? <p className="text-sm muted">Connecting to the analysis pipeline…</p> : null}
          {error ? <ErrorState error={error} title="Could not load pipeline status" onRetry={() => window.location.reload()} /> : null}
          {!loading && !error ? (<><div className="progress-track"><div className="progress-fill" style={{ width: `${progress || 0}%` }} /></div><PipelineStages stages={stages} /></>) : null}
        </div></div>
        <div className="column-stack">
          <div className="card"><div className="card-head"><h3>Status</h3></div><div className="card-body stack-3">
            <div className="row-between"><span className="text-sm muted">Progress</span><span className="strong">{progress || 0}%</span></div>
            <div className="row-between"><span className="text-sm muted">Stage</span><span className="strong">{status}</span></div>
            {status === 'completed' ? (<Link className="btn btn-primary" to={`/report/${encodeURIComponent(id)}`}>View report <ArrowRight size={15} /></Link>) : null}
            {status === 'failed' ? (<p className="inline-alert error"><AlertTriangle size={14} /><span>{agreement?.error || 'Analysis failed. Try again or upload a different PDF.'}</span></p>) : null}
          </div></div>
        </div>
      </div>
    </div>
  );
}
