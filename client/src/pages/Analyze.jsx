import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FileText, Loader2, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import UploadDropzone from '../components/UploadDropzone';
import Disclaimer from '../components/Disclaimer';
import { UPLOAD_RULES } from '../utils/constants';
import { analyzeAgreement, uploadAgreement } from '../services/api';
export default function Analyze() {
  const nav = useNavigate();
  const [file, setFile] = useState(null);
  const [err, setErr] = useState('');
  const [pct, setPct] = useState(0);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!file || busy) return;
    setBusy(true); setErr(''); setPct(0);
    try {
      const up = await uploadAgreement(file, setPct);
      const id = up.agreement?.id || up.id;
      if (!id) throw new Error('Upload succeeded but no id.');
      await analyzeAgreement(id);
      nav(`/analyze/${encodeURIComponent(id)}/processing`);
    } catch (e) { setErr(e.message || 'Upload failed.'); setBusy(false); }
  };
  return (
    <div className="fade-in">
      <PageHeader eyebrow="New analysis" title="Analyze Loan Agreement" subtitle="Upload a PDF. Digital text is extracted directly; scanned pages go through OCR." />
      <div className="page-grid-2">
        <div className="card"><div className="card-body stack-4">
          <UploadDropzone file={file} onSelect={setFile} onClear={() => { setFile(null); setPct(0); }} disabled={busy} error={err} />
          {busy ? (<div><div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div><p className="text-xs muted">Uploading… {pct}%</p></div>) : null}
          <div className="row row-gap-2">
            <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={submit}>{busy ? (<><Loader2 size={15} className="spin" /> Uploading…</>) : 'Analyze Agreement →'}</button>
          </div>
          {err && !busy ? <p className="inline-alert error"><AlertTriangle size={14} /> <span>{err}</span></p> : null}
        </div></div>
        <div className="column-stack">
          <div className="card"><div className="card-head"><h3>Before you upload</h3></div><div className="card-body"><ul className="stack-3 text-sm muted">{UPLOAD_RULES.map((r, i) => (<li key={i} className="row row-gap-3" style={{ alignItems: 'flex-start' }}><ShieldCheck size={15} style={{ flex: 'none', marginTop: 3 }} /><span>{r}</span></li>))}</ul><div className="row row-gap-2 wrap" style={{ marginTop: 14 }}><span className="badge badge-normal"><FileText size={12} /> Digital PDF</span><span className="badge badge-review">Scanned PDF → OCR</span></div></div></div>
          <Disclaimer full />
        </div>
      </div>
    </div>
  );
}
