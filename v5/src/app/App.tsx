import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { AuthScreen } from '../features/auth/AuthScreen';
import { WorkoutWorkspace } from '../features/workout/WorkoutWorkspace';

type ConnectionState = 'online' | 'offline';

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

function WorkoutApp() {
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
        <div className="app-brand">
          <div className="app-brand-mark" aria-hidden="true">B</div>
          <div>
            <p className="eyebrow">BioTrack AI</p>
            <h1>Workout AI</h1>
            <p className="subtitle">Train with a plan, record every set and turn your history into progress.</p>
          </div>
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

        <WorkoutWorkspace />
      </main>
    </div>
  );
}

function AppContent() {
  const { status } = useAuth();

  if (status === 'checking') return <LoadingScreen />;
  if (status !== 'signed-in') return <AuthScreen />;

  return <WorkoutApp />;
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
