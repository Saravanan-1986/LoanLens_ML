import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, FlaskConical, LineChart, ShieldAlert } from 'lucide-react';

import useAgreements from '../hooks/useAgreements';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import ProgressRing from '../components/ProgressRing';
import AgreementCard from '../components/AgreementCard';
import FilterTabs from '../components/FilterTabs';
import SearchInput from '../components/SearchInput';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Disclaimer from '../components/Disclaimer';
import { SkeletonCard } from '../components/Skeleton';
import { loadDemoAgreements } from '../services/api';

/**
 * Risk-focused view: band statistics on top, then every completed analysis
 * sorted by risk score. Data comes from GET /api/agreements?status=completed.
 */
export default function Reports() {
  const [band, setBand] = useState('All');
  const [q, setQ] = useState('');
  const [demoBusy, setDemoBusy] = useState(false);
  const { data, error, loading, reload } = useAgreements({ status: 'completed', limit: 200 });

  const stats = data?.stats || {};
  const bands = stats.riskBands || { Low: 0, Medium: 0, High: 0 };
  const total = data?.total || bands.Low + bands.Medium + bands.High || 0;
  const pctHigh = total ? Math.round(((bands.High || 0) / total) * 100) : 0;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.agreements || [])
      .filter((a) => band === 'All' || (a.overallRisk || 'Low') === band)
      .filter((a) => !needle || String(a.filename).toLowerCase().includes(needle))
      .sort((a, b) => (b.overallRiskScore || 0) - (a.overallRiskScore || 0));
  }, [data, band, q]);

  const demo = async () => {
    setDemoBusy(true);
    try {
      await loadDemoAgreements();
      await reload();
    } catch (e) {
      alert(e.message);
    } finally {
      setDemoBusy(false);
    }
  };

  const options = [
    { key: 'All', label: 'All bands', count: total },
    { key: 'High', label: 'High risk', count: bands.High },
    { key: 'Medium', label: 'Medium risk', count: bands.Medium },
    { key: 'Low', label: 'Low risk', count: bands.Low }
  ];

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Risk"
        title="Risk Reports"
        subtitle="Completed analyses ordered by overall risk score."
        actions={
          <div className="row row-gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={demo} disabled={demoBusy}>
              <FlaskConical size={14} /> {demoBusy ? 'Loading…' : 'Load demo'}
            </button>
            <Link className="btn btn-primary btn-sm" to="/analyze">
              + New analysis
            </Link>
          </div>
        }
      />

      <div className="stat-grid">
        <StatCard
          label="High-risk files"
          value={String(bands.High || 0).padStart(2, '0')}
          variant="accent"
          extra={<ProgressRing value={pctHigh} label={`${pctHigh}%`} />}
          footer={`${pctHigh}% of completed analyses`}
        />
        <StatCard label="Medium-risk files" value={String(bands.Medium || 0).padStart(2, '0')} icon={AlertTriangle} iconTone="amber" variant="warm" footer="Worth a closer read" />
        <StatCard label="Average risk score" value={String(stats.averageRiskScore ?? 0)} icon={LineChart} iconTone="blue" footer={`Band: ${stats.averageRisk || 'Low'} • ${stats.totalClauses || 0} clauses`} />
      </div>


      {loading ? <div className="stack-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div> : null}
      {!loading && error ? (<div className="card"><div className="card-body"><ErrorState error={error} onRetry={reload} /></div></div>) : null}
      {!loading && !error && !total ? (
        <div className="card"><div className="card-body">
          <EmptyState icon={ShieldAlert} title="No risk reports yet"
            text="Reports appear once an agreement finishes analysis. Load the demo set to explore the risk view."
            actions={<div className="row row-gap-2 wrap"><Link className="btn btn-primary" to="/analyze">Analyze Agreement</Link><button type="button" className="btn btn-secondary" onClick={demo} disabled={demoBusy}><FlaskConical size={15} />{demoBusy ? 'Loading demo...' : 'Load demo data'}</button></div>} />
        </div></div>
      ) : null}
      {!loading && !error && total ? (
        <>
          <div className="filter-bar" style={{ margin: '4px 0 14px' }}>
            <FilterTabs options={options} value={band} onChange={setBand} />
            <SearchInput value={q} onChange={setQ} placeholder="Search files..." ariaLabel="Search reports" className="filter-search" />
          </div>
          <p className="text-xs muted" style={{ marginBottom: 10 }}>Showing {list.length} of {total} reports{band !== 'All' ? ` • band: ${band}` : ''}{q ? ` • search: "${q}"` : ''}</p>
          {list.length ? (
            <div className="stack-4">{list.map((a) => (<AgreementCard key={a.id} agreement={a} linkTo={`/report/${a.id}`} />))}</div>
          ) : (
            <div className="card"><div className="card-body">
              <EmptyState icon={ShieldAlert} title="No reports match" text="Try another risk band or clear the search."
                actions={<button type="button" className="btn btn-secondary" onClick={() => { setBand('All'); setQ(''); }}>Clear filters</button>} />
            </div></div>
          )}
        </>
      ) : null}
      <div style={{ marginTop: 16 }}><Disclaimer /></div>
    </div>
  );
}
