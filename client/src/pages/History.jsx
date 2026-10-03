import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, FileText } from 'lucide-react';

import useAgreements from '../hooks/useAgreements';
import PageHeader from '../components/PageHeader';
import FilterTabs from '../components/FilterTabs';
import SearchInput from '../components/SearchInput';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Disclaimer from '../components/Disclaimer';
import { SkeletonCard } from '../components/Skeleton';
import { fileStem, formatDateTime, pluralize, timeAgo } from '../utils/format';

const STATUS_TONE = {
  completed: 'ok',
  processing: 'warn',
  uploaded: 'warn',
  failed: 'bad'
};

/**
 * Chronological activity feed of every upload and analysis run.
 * Ordered newest-first by the upload timestamp returned by the API.
 */
export default function History() {
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useAgreements({ limit: 200 });

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.agreements || [])
      .filter((a) => status === 'all' || a.status === status)
      .filter((a) => !needle || String(a.filename).toLowerCase().includes(needle))
      .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0));
  }, [data, status, q]);

  const options = [
    { key: 'all', label: 'All activity' },
    { key: 'completed', label: 'Completed' },
    { key: 'processing', label: 'Processing' },
    { key: 'failed', label: 'Failed' }
  ];

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Activity"
        title="History"
        subtitle="Every upload and analysis run, newest first."
        actions={
          <Link className="btn btn-primary btn-sm" to="/analyze">
            + New analysis
          </Link>
        }
      />

      <div className="filter-bar" style={{ marginBottom: 14 }}>
        <FilterTabs options={options} value={status} onChange={setStatus} />
        <SearchInput value={q} onChange={setQ} placeholder="Search activity..." ariaLabel="Search history" className="filter-search" />
      </div>

      {loading ? <div className="stack-4"><SkeletonCard height={90} /><SkeletonCard height={90} /><SkeletonCard height={90} /></div> : null}
      {!loading && error ? (<div className="card"><div className="card-body"><ErrorState error={error} onRetry={reload} /></div></div>) : null}
      {!loading && !error && !list.length ? (
        <div className="card"><div className="card-body">
          <EmptyState icon={Activity} title="No activity yet"
            text="Uploads and analysis runs will show up here as soon as you start."
            actions={<Link className="btn btn-primary" to="/analyze">Analyze Agreement</Link>} />
        </div></div>
      ) : null}
      {!loading && !error && list.length ? (
        <div className="card"><div className="card-body" style={{ padding: 8 }}>
          {list.map((a) => (
            <div className="list-row" key={a.id}>
              <div className={`file-chip ${a.status === 'failed' ? 'red' : a.status === 'completed' ? 'green' : 'amber'}`}>
                <FileText size={18} />
              </div>
              <div className="row-main">
                <div className="row row-gap-2 wrap">
                  <Link to={`/agreements/${a.id}`} className="row-title" style={{ textDecoration: 'none', color: 'inherit' }}>{fileStem(a.filename)}</Link>
                </div>
                <div className="row-meta">
                  Uploaded {formatDateTime(a.uploadedAt)}
                  {a.analyzedAt ? ` • Analyzed ${timeAgo(a.analyzedAt)}` : ''}
                  {a.totalClauses ? ` • ${pluralize(a.totalClauses, 'clause')}` : ''}
                </div>
              </div>
              <div className="row-side">
                <span className={`status-pill ${STATUS_TONE[a.status] || 'off'}`}>{a.status}</span>
                <Link className="view-link" to={a.status === 'processing' || a.status === 'uploaded' ? `/analyze/${a.id}/processing` : a.status === 'completed' ? `/report/${a.id}` : `/agreements/${a.id}`}>
                  {a.status === 'processing' || a.status === 'uploaded' ? 'Progress' : a.status === 'completed' ? 'Report' : 'Details'}
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          ))}
        </div></div>
      ) : null}
      <div style={{ marginTop: 16 }}><Disclaimer /></div>
    </div>
  );
}

