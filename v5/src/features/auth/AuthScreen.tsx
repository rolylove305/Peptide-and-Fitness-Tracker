import { useState, type FormEvent } from 'react';
import { supabaseConfiguration } from '../../lib/supabase/client';
import { useAuth } from './AuthProvider';

type AuthMode = 'login' | 'signup' | 'reset-request';

function currentRedirectUrl(): string {
  const url = new URL(window.location.href);
  url.hash = '';
  url.search = '';
  return url.toString();
}

export function AuthScreen() {
  const {
    status,
    error,
    clearError,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    signOut,
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const isPasswordRecovery = status === 'password-recovery';

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    clearError();
    setLocalError(null);
    setNotice(null);
    setPassword('');
    setConfirmPassword('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setLocalError(null);
    clearError();

    try {
      if (isPasswordRecovery) {
        if (password !== confirmPassword) {
          setLocalError('The two passwords do not match.');
          return;
        }

        await updatePassword(password);
        return;
      }

      if (mode === 'reset-request') {
        await requestPasswordReset(email, currentRedirectUrl());
        setNotice(
          'If an account exists for this email, a password reset link has been sent. Open it on this device to choose a new password.',
        );
        return;
      }

      if (mode === 'login') {
        await signIn(email, password);
        return;
      }

      const result = await signUp(name, email, password);
      if (result === 'confirmation-required') {
        setNotice(
          'Account created. Check your email to confirm it, then return here to sign in.',
        );
        setMode('login');
        setPassword('');
      }
    } catch {
      // The provider exposes a safe user-facing error message.
    } finally {
      setBusy(false);
    }
  }

  async function cancelRecovery() {
    setBusy(true);
    clearError();
    setLocalError(null);
    setNotice(null);
    try {
      await signOut();
    } catch {
      // The provider exposes a safe user-facing error message.
    } finally {
      setBusy(false);
    }
  }

  if (status === 'misconfigured' || !supabaseConfiguration.isConfigured) {
    return (
      <main className="auth-shell">
        <section
          className="auth-card auth-card--setup"
          aria-labelledby="setup-heading"
        >
          <p className="eyebrow">BioTrack AI V5</p>
          <h1 id="setup-heading">Connect the secure environment</h1>
          <p>
            V5 is ready for authentication, but the local build needs the
            Supabase project URL and publishable key.
          </p>
          <div className="setup-steps">
            <code>cp .env.example .env.local</code>
            <p>
              Then fill in <strong>VITE_SUPABASE_URL</strong> and{' '}
              <strong>VITE_SUPABASE_PUBLISHABLE_KEY</strong>. Never use a
              service-role or secret key in this browser app.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const heading = isPasswordRecovery
    ? 'Choose a new password'
    : mode === 'login'
      ? 'Welcome back'
      : mode === 'signup'
        ? 'Create your account'
        : 'Reset your password';

  const intro = isPasswordRecovery
    ? 'Enter and confirm a new password for your BioTrack account.'
    : mode === 'reset-request'
      ? 'Enter your account email. BioTrack will send a secure reset link if an account exists.'
      : 'Your workout history and health tracking stay private under your Supabase account.';

  const visibleError = localError ?? error;

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-heading">
        <div className="auth-brand">
          <div className="auth-mark" aria-hidden="true">
            B
          </div>
          <div>
            <p className="eyebrow">BioTrack AI V5</p>
            <h1 id="auth-heading">{heading}</h1>
          </div>
        </div>

        <p className="auth-intro">{intro}</p>

        {!isPasswordRecovery && mode !== 'reset-request' ? (
          <div
            className="auth-tabs"
            role="tablist"
            aria-label="Authentication mode"
          >
            <button
              className={
                mode === 'login' ? 'auth-tab auth-tab--active' : 'auth-tab'
              }
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => changeMode('login')}
            >
              Sign in
            </button>
            <button
              className={
                mode === 'signup' ? 'auth-tab auth-tab--active' : 'auth-tab'
              }
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => changeMode('signup')}
            >
              Create account
            </button>
          </div>
        ) : null}

        <form className="auth-form" onSubmit={submit}>
          {!isPasswordRecovery && mode === 'signup' ? (
            <label>
              Name
              <input
                autoComplete="name"
                minLength={2}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </label>
          ) : null}

          {!isPasswordRecovery ? (
            <label>
              Email
              <input
                autoCapitalize="none"
                autoComplete="email"
                inputMode="email"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
          ) : null}

          {mode !== 'reset-request' ? (
            <label>
              {isPasswordRecovery ? 'New password' : 'Password'}
              <input
                autoComplete={
                  isPasswordRecovery || mode === 'signup'
                    ? 'new-password'
                    : 'current-password'
                }
                minLength={6}
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
              />
            </label>
          ) : null}

          {isPasswordRecovery ? (
            <label>
              Confirm new password
              <input
                autoComplete="new-password"
                minLength={6}
                required
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your new password"
              />
            </label>
          ) : null}

          {!isPasswordRecovery && mode === 'login' ? (
            <button
              className="auth-link-button"
              type="button"
              onClick={() => changeMode('reset-request')}
            >
              Forgot password?
            </button>
          ) : null}

          {visibleError ? (
            <p className="auth-message auth-message--error" role="alert">
              {visibleError}
            </p>
          ) : null}

          {notice ? (
            <p className="auth-message auth-message--success" role="status">
              {notice}
            </p>
          ) : null}

          <button className="primary-button" disabled={busy} type="submit">
            {busy
              ? 'Please wait…'
              : isPasswordRecovery
                ? 'Save new password'
                : mode === 'login'
                  ? 'Sign in securely'
                  : mode === 'signup'
                    ? 'Create secure account'
                    : 'Send reset link'}
          </button>

          {!isPasswordRecovery && mode === 'reset-request' ? (
            <button
              className="auth-link-button auth-link-button--center"
              type="button"
              onClick={() => changeMode('login')}
            >
              Back to sign in
            </button>
          ) : null}

          {isPasswordRecovery ? (
            <button
              className="auth-link-button auth-link-button--center"
              disabled={busy}
              type="button"
              onClick={() => void cancelRecovery()}
            >
              Cancel and return to sign in
            </button>
          ) : null}
        </form>

        <p className="auth-footnote">
          BioTrack AI is an organization and fitness-tracking tool. It does not
          provide medical diagnosis or prescriptions.
        </p>
      </section>
    </main>
  );
}
