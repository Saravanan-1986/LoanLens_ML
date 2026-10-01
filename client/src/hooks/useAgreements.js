import { useCallback } from 'react';
import useAsync from './useAsync';
import { getAgreements } from '../services/api';

/**
 * Agreement list with optional server-side filters.
 * @param {{status?: string, limit?: number, search?: string}} params
 */
export default function useAgreements(params = {}) {
  const { status = '', limit = 50, search = '' } = params;

  const loader = useCallback(
    () => getAgreements({ status: status || undefined, limit, search: search || undefined }),
    [status, limit, search]
  );

  return useAsync(loader, [status, limit, search]);
}
