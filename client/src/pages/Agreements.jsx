import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSearch, FlaskConical, Trash2 } from 'lucide-react';
import useAgreements from '../hooks/useAgreements';
import PageHeader from '../components/PageHeader';
import AgreementCard from '../components/AgreementCard';
import SearchInput from '../components/SearchInput';
import FilterTabs from '../components/FilterTabs';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Disclaimer from '../components/Disclaimer';
import { SkeletonCard } from '../components/Skeleton';
import { deleteAgreement, loadDemoAgreements } from '../services/api';
import { SORT_OPTIONS } from '../utils/constants';
export default function Agreements() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('recent');
  const { data, error, loading, reload } = useAgreements({ status, search, limit: 100 });
  const [busyId, setBusyId] = useState('');
  const [demoBusy, setDemoBusy] = useState(false);
  const list = useMemo(() => {
    const arr = [...(data?.agreements || [])];
    if (sort === 'risk') arr.sort((a, b) => (b.overallRiskScore || 0) - (a.overallRiskScore || 0));
    else if (sort === 'name') arr.sort((a, b) => String(a.filename).localeCompare(String(b.filename)));
    else arr.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    return arr;
  }, [data, sort]);
  const remove = async (ag) => {
    if (!window.confirm(`Delete ${ag.filename}?`)) return;
    setBusyId(ag.id);
    try { await deleteAgreement(ag.id); await reload(); }
    catch (e) { alert(e.message); }
    finally { setBusyId(''); }
  };
  const demo = async () => {
    setDemoBusy(true);
    try { await loadDemoAgreements(); await reload(); }
    catch (e) { alert(e.message); }
    finally { setDemoBusy(false); }
  };
  return (
    <div className="fade-in">
      <PageHeader eyebrow="Library" title="My Agreements" subtitle="Every uploaded agreement with its risk outcome." actions={<div className="row row-gap-2"><button type="button" className="btn btn-secondary btn-sm" onClick={demo} disabled={demoBusy}><FlaskConical size={14} /> {demoBusy ? 'Loading…' : 'Load demo'}</button><Link className="btn btn-primary btn-sm" to="/analyze">+ New analysis</Link></div>} />
      <div className="filter-bar" style={{ marginBottom: 12 }}>
        <FilterTabs value={status || 'all'} onChange={(v) => setStatus(v === 'all' ? '' : v)} options={[{ key: 'all', label: 'All' }, { key: 'completed', label: 'Completed' }, { key: 'processing', label: 'Processing' }, { key: 'failed', label: 'Failed' }, { key: 'uploaded', label: 'Uploaded' }]} />
        <SearchInput value={search} onChange={setSearch} placeholder="Search agreements..." ariaLabel="Search agreements" className="filter-search" />
      </div>
      <div className="row row-gap-2" style={{ marginBottom: 14 }}>
        <span className="text-xs muted">Sort:</span>
        {SORT_OPTIONS.map((o) => (<button key={o.key} type="button" className={`chip ${sort === o.key ? 'active' : ''}`} onClick={() => setSort(o.key)}>{o.label}</button>))}
        <span className="text-xs muted" style={{ marginLeft: 'auto' }}>{list.length} shown • <Trash2 size={11} style={{ display: 'inline' }} /> deletes permanently</span>
      </div>
      {loading ? (<div className="stack-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>) : null}
      {!loading && error ? (<div className="card"><div className="card-body"><ErrorState error={error} onRetry={reload} /></div></div>) : null}
      {!loading && !error && !list.length ? (<div className="card"><div className="card-body"><EmptyState icon={FileSearch} title="No agreements found" text="Upload a PDF or load the demo set to explore the interface." actions={<Link className="btn btn-primary" to="/analyze">Analyze Agreement</Link>} /></div></div>) : null}
      {!loading && !error && list.length ? (<div className="stack-4">{list.map((a) => (<AgreementCard key={a.id} agreement={a} onDelete={remove} deleting={busyId === a.id} />))}</div>) : null}
      <div style={{ marginTop: 16 }}><Disclaimer /></div>
    </div>
  );
}
