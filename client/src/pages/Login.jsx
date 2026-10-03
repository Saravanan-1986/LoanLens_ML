import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Loader2, Lock, Mail, ShieldCheck, User } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { APP_NAME, APP_TAGLINE, SHORT_DISCLAIMER } from '../utils/constants';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Sign in / create account screen.
 *
 * One page handles both modes (the toggle swaps the heading and the extra
 * "name" field) so credentials are validated in a single place before they
 * ever reach the API. On success the user is returned to the page they
 * originally asked for (see RequireAuth) or to the dashboard.
 */
export default function Login() {
  const { login, register, isAuthenticated, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || '/dashboard';

  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'signup';

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  /** Client-side checks mirror the server rules in authController. */
  const validate = () => {
    if (isRegister && form.name.trim().length < 2) {
      return 'Please enter your name (at least 2 characters).';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (isRegister && form.password.length < MIN_PASSWORD_LENGTH) {
      return `Your password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
    }
    if (!form.password) {
      return 'Please enter your password.';
    }
    return '';
  };

  const submit = async (event) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const credentials = { email: form.email.trim(), password: form.password };
      if (isRegister) {
        await register({ ...credentials, name: form.name.trim() });
      } else {
        await login(credentials);
      }
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'We could not complete that request. Please try again.');
      setBusy(false);
    }
  };

  // An already signed-in visitor never needs to see the form again.
  if (ready && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo"><ShieldCheck size={22} strokeWidth={2.2} /></span>
          <div>
            <strong>{APP_NAME}</strong>
            <span>{APP_TAGLINE}</span>
          </div>
        </div>

        <h1 className="auth-title">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-subtitle">
          {isRegister
            ? 'Start screening loan agreements clause by clause.'
            : 'Sign in to review your analysed agreements.'}
        </p>

        <div className="auth-toggle" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={!isRegister}
            className={`auth-toggle-btn ${!isRegister ? 'active' : ''}`.trim()}
            onClick={() => switchMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isRegister}
            className={`auth-toggle-btn ${isRegister ? 'active' : ''}`.trim()}
            onClick={() => switchMode('signup')}
          >
            Sign up
          </button>
        </div>

        {error ? (
          <p className="inline-alert error" role="alert">
            <AlertCircle size={15} />
            <span>{error}</span>
          </p>
        ) : null}

        <form className="auth-form" onSubmit={submit} noValidate>
          {isRegister ? (
            <label className="auth-field">
              <span className="auth-label">Full name</span>
              <span className="auth-input">
                <User size={16} />
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="Asha Verma"
                  value={form.name}
                  onChange={update('name')}
                  disabled={busy}
                />
              </span>
            </label>
          ) : null}

          <label className="auth-field">
            <span className="auth-label">Email address</span>
            <span className="auth-input">
              <Mail size={16} />
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={update('email')}
                disabled={busy}
              />
            </span>
          </label>

          <label className="auth-field">
            <span className="auth-label">Password</span>
            <span className="auth-input">
              <Lock size={16} />
              <input
                type="password"
                name="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder={isRegister ? `At least ${MIN_PASSWORD_LENGTH} characters` : 'Your password'}
                value={form.password}
                onChange={update('password')}
                disabled={busy}
              />
            </span>
          </label>

          <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : null}
            {busy
              ? isRegister
                ? 'Creating account…'
                : 'Signing in…'
              : isRegister
                ? 'Create account'
                : 'Sign in'}
            {!busy ? <ArrowRight size={15} /> : null}
          </button>
        </form>

        <p className="auth-foot">
          {isRegister ? 'Already have an account?' : `New to ${APP_NAME}?`}{' '}
          <button
            type="button"
            className="auth-link"
            onClick={() => switchMode(isRegister ? 'signin' : 'signup')}
          >
            {isRegister ? 'Sign in instead' : 'Create one now'}
          </button>
        </p>

        <p className="auth-note">
          <Lock size={12} />
          {SHORT_DISCLAIMER} Your agreements stay on your own server.
        </p>

        <Link className="auth-back" to="/dashboard">Continue to dashboard</Link>
      </div>
    </div>
  );
}
