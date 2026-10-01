import { Check, Loader2, XCircle } from 'lucide-react';
import { STAGE_LABELS } from '../utils/constants';

/** Vertical step list for the live analysis pipeline status. */
export default function PipelineStages({ stages = [] }) {
  const list = stages.length
    ? stages
    : Object.keys(STAGE_LABELS).map((key, index) => ({
        key,
        label: STAGE_LABELS[key],
        status: index === 0 ? 'completed' : 'pending',
        detail: ''
      }));

  return (
    <ol className="stage-list">
      {list.map((stage) => {
        const status = stage.status || 'pending';
        return (
          <li key={stage.key} className={`stage ${status}`}>
            <span className="stage-dot" aria-hidden="true">
              {status === 'completed' ? (
                <Check size={14} strokeWidth={3} />
              ) : status === 'active' ? (
                <Loader2 size={14} className="spin" />
              ) : status === 'failed' ? (
                <XCircle size={14} />
              ) : null}
            </span>
            <div className="grow">
              <div className="stage-label">{stage.label || STAGE_LABELS[stage.key] || stage.key}</div>
              {stage.detail ? <div className="stage-detail">{stage.detail}</div> : null}
            </div>
            <span className="stage-state">{status === 'active' ? 'In progress' : status}</span>
          </li>
        );
      })}
    </ol>
  );
}
