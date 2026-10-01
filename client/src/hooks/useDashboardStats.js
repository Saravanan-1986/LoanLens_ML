import { useCallback } from 'react';
import useAsync from './useAsync';
import { getDashboardStats } from '../services/api';

/** Dashboard statistics (counts, distribution, recent agreements). */
export default function useDashboardStats() {
  const loader = useCallback(() => getDashboardStats(), []);
  return useAsync(loader, []);
}
