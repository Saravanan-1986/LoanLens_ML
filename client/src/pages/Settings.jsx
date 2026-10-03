import { Link } from 'react-router-dom';
import { Cpu, Database, RefreshCw, ScanEye, Server } from 'lucide-react';

import useAsync from '../hooks/useAsync';
import PageHeader from '../components/PageHeader';
import Disclaimer from '../components/Disclaimer';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { SkeletonCard } from '../components/Skeleton';
import { getDashboardMeta, getHealth } from '../services/api';
import { APP_NAME } from '../utils/constants';

function StatusPill({ ok, labelOn = 'Available', labelOff = 'Unavailable' }) {
  return <span className={`status-pill ${ok ? 'ok' : 'off'}`}>{ok ? labelOn : labelOff}</span>;
}

/** Settings + system transparency: health, engines, rulebook and scoring. */
export default function Settings() {
  const health = useAsync(() => getHealth(), []);
  const meta = useAsync(() => getDashboardMeta(), []);

  const h = health.data || {};
  const deps = h.dependencies || {};
  const m = meta.data || {};
  const engines = m.engines || {};
  const db = engines.database || deps.database || {};
  const scoring = engines.scoring || {};
  const rulebook = Array.isArray(m.rulebook) ? m.rulebook : [];

  return (
    <div className="fade-in">
      <PageHeader eyebrow="Configuration" title="Settings" subtitle="System status, analysis engines and the risk rulebook."
        actions={<button type="button" className="btn btn-secondary btn-sm" onClick={() => { health.reload(); meta.reload(); }}><RefreshCw size={14} /> Refresh</button>} />

      {health.loading || meta.loading ? <div className="stack-4"><SkeletonCard height={140} /><SkeletonCard height={220} /></div> : null}
      {health.error ? (<div className="card" style={{ marginBottom: 16 }}><div className="card-body"><ErrorState error={health.error} title="Could not reach the API" onRetry={health.reload} /></div></div>) : null}

      {!health.loading && !health.error ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h3>System status</h3><span className="text-xs muted">GET /api/health</span></div>
          <div className="card-body stack-4">
            <div className="kv-grid">
              <div className="kv"><div className="k">API</div><div className="v">{h.service || 'loanlens-server'} v{h.version || '—'} • {h.environment || '—'}</div></div>
              <div className="kv"><div className="k">Database</div><div className="v"><StatusPill ok={Boolean(deps.database?.connected)} labelOn={`MongoDB (${deps.database?.state || 'connected'})`} labelOff={deps.database?.configured ? 'Disconnected — in-memory store' : 'In-memory store'} /></div></div>
              <div className="kv"><div className="k">ML service</div><div className="v"><StatusPill ok={Boolean(deps.mlService?.available)} labelOn="FastAPI online" labelOff="Offline — rules-only mode" /></div></div>
              <div className="kv"><div className="k">Classifier</div><div className="v">{engines.mlService?.classifier ? `${engines.mlService.classifier.engine} • ${engines.mlService.classifier.model}` : 'heuristic-keyword-fallback (not a trained model)'}</div></div>
              {engines.mlService?.classifier?.trained_metrics ? (
                <div className="kv"><div className="k">Accuracy</div><div className="v">
                  {`validation ${(engines.mlService.classifier.trained_metrics.validation_accuracy * 100).toFixed(1)}% • macro-F1 ${(engines.mlService.classifier.trained_metrics.validation_macro_f1 * 100).toFixed(1)}% • test ${(engines.mlService.classifier.trained_metrics.test_accuracy * 100).toFixed(1)}%`}
                </div></div>
              ) : null}
              <div className="kv"><div className="k">Summarizer</div><div className="v">{engines.mlService?.summarizer?.model || 'rule-based-extractive-fallback (not a trained model)'}</div></div>
              <div className="kv"><div className="k">Extraction</div><div className="v">{engines.mlService?.extraction ? Object.entries(engines.mlService.extraction).filter(([, v]) => v).map(([k]) => k).join(' → ') : 'server pdf fallback'}</div></div>
              <div className="kv"><div className="k">Storage</div><div className="v">{deps.storage || 'unknown'}</div></div>
            </div>
            <p className="text-xs muted">Last checked: {h.timestamp ? new Date(h.timestamp).toLocaleString('en-GB') : '—'}{deps.mlService?.url ? ` • ML endpoint: ${deps.mlService.url}` : ''}</p>
          </div>
        </div>
      ) : null}

      {meta.error ? (<div className="card" style={{ marginBottom: 16 }}><div className="card-body"><ErrorState error={meta.error} title="Could not load engine metadata" onRetry={meta.reload} /></div></div>) : null}

      {!meta.loading && !meta.error ? (
        <div className="page-grid-2" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="card-head"><h3>Analysis engines</h3></div>
            <div className="card-body stack-3">
              <div className="settings-row"><div><div className="label">Rule engine</div><div className="desc">Deterministic regex rulebook applied to every clause. {engines.ruleEngine?.rules ?? 0} rules active.</div></div><div className="control"><StatusPill ok={Boolean(engines.ruleEngine?.available)} /></div></div>
              <div className="settings-row"><div><div className="label">ML classifier</div><div className="desc">FastAPI service at {engines.mlService?.url || '—'}. Falls back to heuristics when offline.</div></div><div className="control"><StatusPill ok={Boolean(engines.mlService?.available)} /></div></div>
              <div className="settings-row"><div><div className="label">Storage backend</div><div className="desc">{db.connected ? 'Records persist in MongoDB.' : 'MongoDB not connected — records live in memory and reset on restart.'}</div></div><div className="control"><StatusPill ok={Boolean(db.connected)} labelOn="MongoDB" labelOff="In-memory" /></div></div>
              {scoring.weights ? (
                <div className="settings-row"><div><div className="label">Scoring model</div><div className="desc mono">Normal {scoring.weights.Normal ?? 0} • Needs Review {scoring.weights['Needs Review'] ?? 3} • Risky {scoring.weights.Risky ?? 10} • amplifier ×{scoring.amplifier ?? 1.3}</div></div></div>
              ) : null}
            </div>
          </div>

          <div className="column-stack">
            <div className="card">
              <div className="card-head"><h3>Your library</h3></div>
              <div className="card-body stack-3">
                <p className="text-sm muted">Every agreement you upload is analysed and kept in your own library. Open it to review clause-level risk, plain-language summaries and the exported reports.</p>
                <div className="row row-gap-2 wrap">
                  <Link className="btn btn-primary btn-sm" to="/analyze">Analyze a document</Link>
                  <Link className="btn btn-secondary btn-sm" to="/agreements">Go to library</Link>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>About {APP_NAME}</h3><ScanEye size={17} color="var(--ink-400)" /></div>
              <div className="card-body stack-3">
                <div className="row row-gap-3"><Cpu size={16} color="var(--ink-400)" /><span className="text-sm">React (Vite) + Express + FastAPI ML microservice</span></div>
                <div className="row row-gap-3"><Server size={16} color="var(--ink-400)" /><span className="text-sm">API uptime: {h.uptimeSeconds != null ? `${Math.round(h.uptimeSeconds / 60)} min` : '—'}</span></div>
                <div className="row row-gap-3"><Database size={16} color="var(--ink-400)" /><span className="text-sm">Storage: {deps.storage || 'unknown'}</span></div>
              </div>
            </div>
          </div>
        </div>
      ) : null}



      {!meta.loading && !meta.error ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><div><h3>Risk rulebook</h3><p className="card-sub">{rulebook.length} active rules — every flagged clause links back to one of these</p></div></div>
          {rulebook.length ? (
            <div className="card-body" style={{ paddingTop: 6 }}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Rule</th><th>Category</th><th>Severity</th><th>Reference</th></tr></thead>
                  <tbody>
                    {rulebook.map((rule) => (
                      <tr key={rule.ruleId}>
                        <td className="cell-file"><div className="name">{rule.name}</div><div className="sub mono">{rule.ruleId}</div></td>
                        <td>{rule.category || '—'}</td>
                        <td><span className={`badge ${rule.severity === 'HIGH' ? 'badge-risky' : rule.severity === 'MEDIUM' ? 'badge-review' : 'badge-normal'}`}>{rule.severity || 'LOW'}</span></td>
                        <td className="text-xs muted">{rule.regulatoryReference || '—'}{rule.regulatoryVerified ? ' ✓' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card-body"><EmptyState icon={Cpu} title="Rulebook unavailable" text="The API did not return the rulebook. Try refreshing." /></div>
          )}
        </div>
      ) : null}

      <Disclaimer full />
    </div>
  );
}
