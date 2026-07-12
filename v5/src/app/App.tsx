import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { AuthScreen } from '../features/auth/AuthScreen';
import { WorkoutWorkspace } from '../features/workout/WorkoutWorkspace';
import { supabaseConfiguration } from '../lib/supabase/client';

type ConnectionState = 'online' | 'offline';

const foundationItems = [
  {
    title: 'Secure accounts',
    description: 'Supabase session persistence, sign in, account creation and sign out.',
    status: 'Ready',
  },
  {
    title: 'Workout system',
    description: 'Exercise library, routine targets, live set logging and programmed rest timers.',
    status: 'Ready',
  },
  {
    title: 'Controlled progression',
    description: 'Explainable guidance, explicit approval, audited before-and-after values and protected undo.',
    status: 'Ready',
  },
] as const;

function useConnectionState(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(navigator.onLine ? 'online' : 'offline');

  useEffect(() => {
    const setOnline = () => setState('online');
    const setOffline = () => setState('offline');

    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);

    return () => {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  return state;
}

function LoadingScreen() {
  return (
    <main className="loading-shell" aria-live="polite" aria-busy="true">
      <div className="loading-mark" aria-hidden="true">
        B
      </div>
      <p>Checking your secure BioTrack session…</p>
    </main>
  );
}

function FoundationDashboard() {
  const connection = useConnectionState();
  const { user, error, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // The auth provider exposes the error below.
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">BioTrack AI</p>
          <h1>Workout AI</h1>
          <p className="subtitle">Plan, train, review every set and turn real sessions into measurable progress.</p>
        </div>

        <div className="topbar-actions">
          <div className={`connection-badge connection-badge--${connection}`}>
            <span aria-hidden="true" className="connection-dot" />
            {connection === 'online' ? 'Online' : 'Offline'}
          </div>
          <div className="account-chip" title={user?.email ?? 'Signed-in account'}>
            <span>{user?.email ?? 'Signed-in account'}</span>
            <button
              className="secondary-button secondary-button--compact"
              disabled={signingOut}
              type="button"
              onClick={() => void handleSignOut()}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      <main>
        {error ? (
          <p className="auth-message auth-message--error" role="alert">
            {error}
          </p>
        ) : null}

        <section className="hero-card">
          <div>
            <p className="eyebrow">Workout AI milestone</p>
            <h2>Progression changes now require your approval</h2>
            <p>
              BioTrack compares recent training, shows the evidence, locates the exact saved routine target and
              presents current versus proposed values. Nothing changes until you approve it; every application is
              audited and can be safely undone when it would not overwrite a newer edit.
            </p>
          </div>
          <div className="milestone-mark" aria-label="Controlled progression approval phase">
            07
          </div>
        </section>

        <WorkoutWorkspace />

        <section aria-labelledby="foundation-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Architecture</p>
              <h2 id="foundation-heading">Workout AI status</h2>
            </div>
          </div>

          <div className="card-grid">
            {foundationItems.map((item) => (
              <article className="feature-card" key={item.title}>
                <span className="status-chip">{item.status}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="system-card" aria-labelledby="system-heading">
          <div>
            <p className="eyebrow">Cloud configuration</p>
            <h2 id="system-heading">
              {supabaseConfiguration.isConfigured ? 'Supabase connected' : 'Environment setup required'}
            </h2>
            <p>
              {supabaseConfiguration.isConfigured
                ? 'The V5 client uses a browser-safe publishable key, authenticated sessions and RLS-protected workout data.'
                : 'Add the approved environment variables before connecting authentication.'}
            </p>
          </div>
          <span
            className={`system-indicator ${
              supabaseConfiguration.isConfigured ? 'system-indicator--ready' : ''
            }`}
            aria-hidden="true"
          />
        </section>
      </main>
    </div>
  );
}

function AppContent() {
  const { status } = useAuth();

  if (status === 'checking') return <LoadingScreen />;
  if (status !== 'signed-in') return <AuthScreen />;

  return <FoundationDashboard />;
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
