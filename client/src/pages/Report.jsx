import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, FileText } from 'lucide-react';
import useAgreementReport from '../hooks/useAgreementReport';
import PageHeader from '../components/PageHeader';
import ClauseCard from '../components/ClauseCard';
import ScoreMeter from '../components/ScoreMeter';
import RiskDonut from '../components/RiskDonut';
import RiskLegend from '../components/RiskLegend';
import DistributionBar from '../components/DistributionBar';
import Disclaimer from '../components/Disclaimer';
import DocumentSummaryCard from '../components/DocumentSummaryCard';
import FilterTabs from '../components/FilterTabs';
import SearchInput from '../components/SearchInput';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { SkeletonBlock, SkeletonCard } from '../components/Skeleton';
import { RISK, RISK_FILTERS } from '../utils/constants';
import { fileStem, formatDateTime, pluralize } from '../utils/format';
export default function Report() {
  const { id } = useParams();
  const { data, error, loading, reload } = useAgreementReport(id);
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');
  const [openAll, setOpenAll] = useState(false);
  const rep = data || {};
  const all = Array.isArray(rep.clauses) ? rep.clauses : (rep.agreement?.clauses || []);
  const clauses = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((c) => {
      if (filter !== 'All' && c.classification !== filter) return false;
      if (!needle) return true;
      const hay = [c.title, c.originalText, c.summary, c.riskCategory, c.reason, c.ruleId].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [all, filter, q]);
  if (loading) return (<div className="fade-in"><SkeletonBlock height={22} width={220} /><div style={{ marginTop: 12 }}><SkeletonCard height={220} /></div><div style={{ marginTop: 16 }}><SkeletonCard height={160} /></div></div>);
  if (error) return (<div className="card"><div className="card-body"><ErrorState error={error} onRetry={reload} /></div></div>);
  if (!rep.agreement) return (<div className="card"><div className="card-body"><EmptyState icon={FileText} title="Report not ready" text="This agreement has not finished analysis yet." actions={<Link className="btn btn-primary" to={`/analyze/${encodeURIComponent(id)}/processing`}>Check status</Link>} /></div></div>);
  const a = rep.agreement;
  const counts = [{ key: 'All', label: 'All', count: all.length }];
  RISK_FILTERS.slice(1).forEach((f) => counts.push({ key: f.key, label: f.label, count: all.filter((c) => c.classification === f.key).length }));
  const sum = { normal: a.riskSummary?.normal || 0, needsReview: a.riskSummary?.needsReview || 0, risky: a.riskSummary?.risky || 0 };
  const csv = () => {
    const rows = [['clause', 'title', 'classification', 'category', 'confidence', 'summary']];
    all.forEach((c) => rows.push([c.clauseNumber, JSON.stringify(c.title || ''), c.classification, JSON.stringify(c.riskCategory || ''), c.confidence ?? '', JSON.stringify(String(c.summary || '').slice(0, 400))]));
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${fileStem(a.filename)}-report.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Loan Agreement Analysis" title={fileStem(a.filename)} subtitle={`Analyzed ${formatDateTime(a.analyzedAt)} • ${pluralize(a.totalClauses || 0, 'clause')} • ${a.extractionMethod || 'pdf extraction'}`}
        actions={<div className="row row-gap-2"><button type="button" className="btn btn-secondary btn-sm" onClick={csv}><Download size={14} /> Export CSV</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenAll((v) => !v)}>{openAll ? 'Collapse all' : 'Expand all'}</button></div>} />
      <div className="card" style={{ marginBottom: 16 }}><div className="card-body">
        <div className="report-hero">
          <ScoreMeter score={a.overallRiskScore} band={a.overallRisk} formula={rep.formula?.note || ''} />
          <div className="summary-tiles">
            <div className="summary-tile all"><span className="n">{a.totalClauses || 0}</span><span className="l">Clauses analyzed</span></div>
            <div className="summary-tile risky"><span className="n">{sum.risky}</span><span className="l">Risky</span></div>
            <div className="summary-tile review"><span className="n">{sum.needsReview}</span><span className="l">Needs review</span></div>
            <div className="summary-tile normal"><span className="n">{sum.normal}</span><span className="l">Normal</span></div>
          </div>
        </div>
        <div className="page-grid-2" style={{ marginTop: 18, alignItems: 'center' }}>
          <DistributionBar summary={sum} total={a.totalClauses} />
          <div className="row" style={{ gap: 18, alignItems: 'center' }}><RiskDonut summary={sum} height={170} innerRadius={46} outerRadius={66} centerValue={String(a.overallRiskScore ?? 0)} centerTop="Risk score" /><div className="grow"><RiskLegend summary={sum} /></div></div>
        </div>
        <div className="row row-gap-2 wrap" style={{ marginTop: 14 }}>
          <span className="text-xs muted">Engine: {a.analysisSource || 'pipeline'}</span>
          <span className="text-xs muted">Model: {a.summarizerModel || 'fallback'}</span>
        </div>
      </div></div>
      <DocumentSummaryCard summary={rep.documentSummary} highlights={rep.summaryHighlights} model={rep.summaryModel} />
      <Disclaimer />
      <div style={{ margin: '16px 0' }}>
        <div className="filter-bar">
          <FilterTabs options={counts} value={filter} onChange={setFilter} />
          <SearchInput value={q} onChange={setQ} placeholder='Search clauses... try "interest"' ariaLabel="Search clauses" className="filter-search" />
        </div>
        <p className="text-xs muted" style={{ marginTop: 8 }}>Showing {clauses.length} of {all.length} clauses{filter !== 'All' ? ` • filter: ${filter}` : ''}{q ? ` • search: "${q}"` : ''}</p>
      </div>
      {clauses.length ? (<div className="clause-list">{clauses.map((c) => (<ClauseCard key={`${c.index}-${c.clauseNumber}`} clause={c} defaultOpen={openAll || c.classification === RISK.RISKY} />))}</div>) : (<div className="card"><div className="card-body"><EmptyState icon={FileText} title="No clauses match" text="Try a different search term or clear the risk filter." actions={<button type="button" className="btn btn-secondary" onClick={() => { setFilter('All'); setQ(''); }}>Clear filters</button>} /></div></div>)}
    </div>
  );
}