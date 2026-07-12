import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { AuthScreen } from '../features/auth/AuthScreen';
import { ExerciseLibrary } from '../features/workout/ExerciseLibrary';
import { supabaseConfiguration } from '../lib/supabase/client';

type ConnectionState = 'online' | 'offline';

const foundationItems = [
  {
    title: 'Secure accounts',
    description: 'Supabase session persistence, sign in, account creation and sign out.',
    status: 'Ready',
  },
  {
    title: 'Workout database',
    description: 'Normalized routines, sessions, exercises and set-by-set history with verified RLS.',
    status: 'Ready',
  },
  {
    title: 'Workout experience',
    description: 'Exercise library is connected. Routine builder, live sets and rest timer come next.',
    status: 'In progress',
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
          <h1>Workout AI Foundation</h1>
          <p className="subtitle">Secure workout data and a real exercise library, built beside the current app.</p>
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
            <h2>Structured training starts here</h2>
            <p>
              BioTrack can now store routines, actual workout sessions and every completed set. The
              first connected experience is the searchable exercise library below.
            </p>
          </div>
          <div className="milestone-mark" aria-label="Database and library phase">
            02
          </div>
        </section>

        <ExerciseLibrary />

        <section aria-labelledby="foundation-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Architecture</p>
              <h2 id="foundation-heading">Foundation status</h2>
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
                ? 'The V5 client is using a project URL, browser-safe publishable key and typed Workout AI schema.'
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
