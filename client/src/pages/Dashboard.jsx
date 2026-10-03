import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, FileSearch, FileText, ShieldAlert } from 'lucide-react';
import useDashboardStats from '../hooks/useDashboardStats';
import StatCard from '../components/StatCard';
import ProgressRing from '../components/ProgressRing';
import RecentAnalysisCard from '../components/RecentAnalysisCard';
import RecentAgreementsList from '../components/RecentAgreementsList';
import RiskDonut from '../components/RiskDonut';
import RiskLegend from '../components/RiskLegend';
import Disclaimer from '../components/Disclaimer';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { SkeletonCard, SkeletonBlock } from '../components/Skeleton';
import { greeting, pluralize } from '../utils/format';
import { riskyShare } from '../utils/risk';

export default function Dashboard() {
  const { data, error, loading, reload } = useDashboardStats();
  if (loading) return (
    <div className="fade-in">
      <div className="page-head"><div><SkeletonBlock height={14} width={150} /><div style={{ marginTop: 10 }}><SkeletonBlock height={30} width={320} /></div></div><SkeletonBlock height={42} width={210} radius={999} /></div>
      <div className="stat-grid"><SkeletonCard height={152} /><SkeletonCard height={152} /><SkeletonCard height={152} /></div>
      <div className="dashboard-columns"><SkeletonCard height={330} /><SkeletonCard height={330} /></div>
    </div>
  );
  if (error) return <div className="card"><div className="card-body"><ErrorState error={error} onRetry={reload} /></div></div>;
  const stats = data || {};
  const hasData = Boolean(stats.hasData);
  const summary = { normal: stats.normalClauses || 0, needsReview: stats.needsReviewClauses || 0, risky: stats.riskyClauses || 0 };
  const total = stats.totalClauses || (summary.normal + summary.needsReview + summary.risky);
  const riskyPct = riskyShare(summary, total);
  const reviewPct = total ? Math.round(((summary.needsReview || 0) / total) * 100) : 0;
  return (
    <div className="fade-in">
      <div className="page-head">
        <div>
          <div className="eyebrow">{greeting()}</div>
          <h1>Understand your loan agreement before you sign.</h1>
          <p className="subtitle">Upload a PDF and LoanLens segments every clause, explains it in plain English and highlights risky wording.</p>
        </div>
        <div className="page-head-actions"><Link className="btn btn-primary" to="/analyze">+ Analyze New Agreement</Link></div>
      </div>
      {!hasData ? (
        <div className="card" style={{ marginBottom: 18 }}><div className="card-body">
          <EmptyState icon={FileSearch} title="No loan agreements analyzed yet."
            text="Upload your first agreement to see clause-level risk analysis and plain-language summaries."
            actions={<Link className="btn btn-primary" to="/analyze">Analyze Agreement<ArrowRight size={15} /></Link>} />
        </div></div>
      ) : null}
      <div className="stat-grid">
        <StatCard label="Documents Analyzed" value={String(stats.documentsAnalyzed ?? 0).padStart(2, '0')} icon={FileText} iconTone="blue" footer={`${pluralize(total, 'clause')} screened`} to="/agreements" />
        <StatCard label="Risky Clauses" value={String(stats.riskyClauses ?? 0).padStart(2, '0')} variant="accent" extra={<ProgressRing value={riskyPct} label={`${riskyPct}%`} />} footer={`${riskyPct}% of clauses`} to="/reports" />
        <StatCard label="Needs Review" value={String(stats.needsReviewClauses ?? 0).padStart(2, '0')} icon={AlertTriangle} iconTone="amber" variant="warm" footer={`${reviewPct}% ambiguous`} to="/reports" />
      </div>
      {hasData ? (
        <div className="dashboard-columns">
          <div className="column-stack">
            <RecentAnalysisCard analysis={stats.recentAnalysis} />
            <div className="card"><div className="card-head"><h3>Clause Risk Distribution</h3><span className="text-xs muted">{pluralize(total, 'clause')} total</span></div>
              <div className="card-body"><div className="page-grid-2" style={{ alignItems: 'center' }}>
                <RiskDonut summary={summary} centerValue={String(total)} centerTop="Clauses" />
                <div className="stack-4"><RiskLegend summary={summary} />
                  <div className="row row-gap-2 wrap"><span className="badge badge-normal">{summary.normal} Normal</span><span className="badge badge-review">{summary.needsReview} Needs Review</span><span className="badge badge-risky">{summary.risky} Risky</span></div>
                </div></div></div></div>
          </div>
          <div className="column-stack">
            <div className="card"><div className="card-head"><div><h3>Recent Agreements</h3><p className="card-sub">Latest completed analyses</p></div><ShieldAlert size={18} color="var(--ink-400)" /></div>
              <div className="card-body"><RecentAgreementsList agreements={stats.recentAgreements || []} /></div></div>
            <div className="card"><div className="card-head"><h3>How it works</h3></div><div className="card-body"><ol className="stack-3 text-sm">
              {['Upload a loan agreement PDF (scanned files go through OCR).', 'LoanLens segments clauses and screens each one with the rule engine + ML classifier.', 'Read the plain-English report and confirm anything risky with a professional.'].map((s, i) => (
                <li key={i} className="row row-gap-3" style={{ alignItems: 'flex-start' }}><span className="clause-num" style={{ width: 26, height: 26, fontSize: 12 }}>{i + 1}</span><span className="muted">{s}</span></li>))}
            </ol></div></div>
            <Disclaimer />
          </div>
        </div>
      ) : <Disclaimer />}
    </div>
  );
}

