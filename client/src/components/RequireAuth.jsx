import { Loader2 } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

/**
 * Route guard.
 *
 * While a stored session is being validated we show a small loader (so the
 * sign-in screen does not flash for an already signed-in user). If there is no
 * valid session the visitor is sent to `/login`, remembering where they wanted
 * to go so they can be returned there after signing in.
 */
export default function RequireAuth({ children }) {
  const { isAuthenticated, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="auth-loading">
        <Loader2 size={22} className="spin" />
        <span className="text-sm muted">Restoring your session…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
