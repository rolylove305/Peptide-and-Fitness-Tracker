import { useState, type FormEvent } from 'react';
import { supabaseConfiguration } from '../../lib/supabase/client';
import { useAuth } from './AuthProvider';

type AuthMode = 'login' | 'signup';

export function AuthScreen() {
  const { status, error, clearError, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    clearError();
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    clearError();

    try {
      if (mode === 'login') {
        await signIn(email, password);
        return;
      }

      const result = await signUp(name, email, password);
      if (result === 'confirmation-required') {
        setNotice('Account created. Check your email to confirm it, then return here to sign in.');
        setMode('login');
        setPassword('');
      }
    } catch {
      // The provider exposes a safe user-facing error message.
    } finally {
      setBusy(false);
    }
  }

  if (status === 'misconfigured' || !supabaseConfiguration.isConfigured) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-card--setup" aria-labelledby="setup-heading">
          <p className="eyebrow">BioTrack AI V5</p>
          <h1 id="setup-heading">Connect the secure environment</h1>
          <p>
            V5 is ready for authentication, but the local build needs the Supabase project URL and
            publishable key.
          </p>
          <div className="setup-steps">
            <code>cp .env.example .env.local</code>
            <p>
              Then fill in <strong>VITE_SUPABASE_URL</strong> and{' '}
              <strong>VITE_SUPABASE_PUBLISHABLE_KEY</strong>. Never use a service-role or secret key
              in this browser app.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-heading">
        <div className="auth-brand">
          <div className="auth-mark" aria-hidden="true">
            B
          </div>
          <div>
            <p className="eyebrow">BioTrack AI V5</p>
            <h1 id="auth-heading">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
          </div>
        </div>

        <p className="auth-intro">
          Your workout history and health tracking stay private under your Supabase account.
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            className={mode === 'login' ? 'auth-tab auth-tab--active' : 'auth-tab'}
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => changeMode('login')}
          >
            Sign in
          </button>
          <button
            className={mode === 'signup' ? 'auth-tab auth-tab--active' : 'auth-tab'}
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => changeMode('signup')}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' ? (
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

          <label>
            Password
            <input
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
            />
          </label>

          {error ? (
            <p className="auth-message auth-message--error" role="alert">
              {error}
            </p>
          ) : null}

          {notice ? (
            <p className="auth-message auth-message--success" role="status">
              {notice}
            </p>
          ) : null}

          <button className="primary-button" disabled={busy} type="submit">
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in securely' : 'Create secure account'}
          </button>
        </form>

        <p className="auth-footnote">
          BioTrack AI is an organization and fitness-tracking tool. It does not provide medical
          diagnosis or prescriptions.
        </p>
      </section>
    </main>
  );
}
