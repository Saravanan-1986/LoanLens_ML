import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Small async data hook: loading / success / error / reload.
 * Keeps every API-driven page free of duplicated request bookkeeping.
 */
export default function useAsync(loader, deps = [], options = {}) {
  const { immediate = true } = options;
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const mountedRef = useRef(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(immediate);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    []
  );

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
      }
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(err);
        setLoading(false);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (immediate) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload: run, setData };
}
