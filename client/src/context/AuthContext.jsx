import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  getCurrentUser,
  login as loginRequest,
  register as registerRequest,
  setAuthToken,
  setUnauthorizedHandler
} from '../services/api';

const TOKEN_KEY = 'loanlens.token';
const USER_KEY = 'loanlens.user';

const AuthContext = createContext(null);

/**
 * Owns the signed-in session.
 *
 * The token + user are persisted in localStorage so a refresh keeps the user
 * signed in. The token is pushed into the axios client (so every request is
 * authenticated) and the context also reacts to a global 401 by clearing the
 * session, which sends the user back to the sign-in screen.
 */
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  });
  const [ready, setReady] = useState(false);

  const persist = useCallback((session) => {
    if (session && session.token) {
      localStorage.setItem(TOKEN_KEY, session.token);
      setToken(session.token);
      setAuthToken(session.token);
    }
    if (session && session.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(session.user));
      setUser(session.user);
    }
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken('');
    setUser(null);
    setAuthToken('');
  }, []);

  // Keep the axios client in step with the current token.
  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  // Return to the sign-in screen whenever the API rejects the session.
  useEffect(() => {
    setUnauthorizedHandler(() => clear());
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  // Validate a stored session once, on first mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setReady(true);
        return;
      }
      try {
        const data = await getCurrentUser();
        if (!cancelled && data && data.user) {
          setUser(data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        }
      } catch (error) {
        if (!cancelled) clear();
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (credentials) => {
      const session = await loginRequest(credentials);
      persist(session);
      return session.user;
    },
    [persist]
  );

  const register = useCallback(
    async (payload) => {
      const session = await registerRequest(payload);
      persist(session);
      return session.user;
    },
    [persist]
  );

  const logout = useCallback(() => clear(), [clear]);

  const value = useMemo(
    () => ({
      user,
      token,
      ready,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout
    }),
    [user, token, ready, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the current session (throws when used outside the provider). */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export default AuthContext;
