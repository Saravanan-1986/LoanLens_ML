import { useCallback } from 'react';
import useAsync from './useAsync';
import { getAgreementReport } from '../services/api';

/** Full clause-by-clause report for a completed agreement. */
export default function useAgreementReport(id) {
  const loader = useCallback(() => {
    if (!id) return Promise.resolve(null);
    return getAgreementReport(id);
  }, [id]);

  return useAsync(loader, [id]);
}
