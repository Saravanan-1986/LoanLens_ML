import { AlertOctagon, RefreshCw } from 'lucide-react';
import EmptyState from './EmptyState';

const FALLBACK_MESSAGE =
  'Something went wrong while loading this agreement. Please try again.';

/** Error state - never surfaces raw JS errors or stack traces. */
export default function ErrorState({
  error,
  title = 'Something went wrong',
  onRetry,
  retryLabel = 'Try again'
}) {
  const message = (error && error.message) || FALLBACK_MESSAGE;

  return (
    <EmptyState
      icon={AlertOctagon}
      tone="red"
      title={title}
      text={message}
      actions={
        onRetry ? (
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            <RefreshCw size={15} />
            {retryLabel}
          </button>
        ) : null
      }
    />
  );
}
