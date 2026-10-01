import { useEffect, useRef, useState } from 'react';
import { getAgreement } from '../services/api';
import { STAGE_LABELS } from '../utils/constants';

const STAGE_KEYS = Object.keys(STAGE_LABELS);

/** Fallback stage list so the UI still renders before the API responds. */
function defaultStages() {
  return STAGE_KEYS.map((key, index) => ({
    key,
    label: STAGE_LABELS[key],
    status: index === 0 ? 'completed' : 'pending',
    detail: ''
  }));
}

/**
 * Poll the backend while an analysis is running so the processing screen shows
 * real pipeline status rather than a fake timer.
 */
export default function useAgreementProgress(id, options = {}) {
  const { intervalMs = 1500, start = true } = options;

  const [state, setState] = useState({
    agreement: null,
    stages: defaultStages(),
    progress: 0,
    status: 'processing',
    loading: true,
    error: null
  });

  const timerRef = useRef(null);

  useEffect(() => {
    if (!id || !start) return undefined;

    let cancelled = false;

    const tick = async () => {
      try {
        const payload = await getAgreement(id);
        if (cancelled) return;

        const agreement = payload.agreement || {};
        const stages = Array.isArray(payload.stages) && payload.stages.length
          ? payload.stages
          : defaultStages();

        setState({
          agreement,
          stages,
          progress: Number(agreement.progress || 0),
          status: agreement.status || 'processing',
          loading: false,
          error: null
        });

        if (agreement.status === 'completed' || agreement.status === 'failed') return;
      } catch (error) {
        if (cancelled) return;
        setState((prev) => ({ ...prev, loading: false, error }));
        // A missing record will never recover - stop polling.
        if (error && error.status === 404) return;
      }

      timerRef.current = setTimeout(tick, intervalMs);
    };

    tick();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id, intervalMs, start]);

  return state;
}
