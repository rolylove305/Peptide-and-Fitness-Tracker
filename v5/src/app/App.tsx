import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { AuthScreen } from '../features/auth/AuthScreen';
import { FirstWorkoutCoach } from '../features/workout/FirstWorkoutCoach';
import {
  subscribeWorkoutProfileCompleted,
  type WorkoutProfileCompletedDetail,
} from '../features/workout/workoutProfileEvents';
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
  const [firstRunNotice, setFirstRunNotice] = useState<WorkoutProfileCompletedDetail | null>(null);

  useEffect(() => {
    let dismissTimer: number | null = null;

    const unsubscribe = subscribeWorkoutProfileCompleted((detail) => {
      setFirstRunNotice(detail);
      if (dismissTimer !== null) window.clearTimeout(dismissTimer);

      window.requestAnimationFrame(() => {
        const plansButton = document.querySelector<HTMLButtonElement>(
          '.workspace-nav-button[aria-label^="Plans:"]',
        );
        plansButton?.click();

        window.requestAnimationFrame(() => {
          document
            .getElementById('workout-workspace-view')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      dismissTimer = window.setTimeout(() => setFirstRunNotice(null), 9000);
    });

    return () => {
      unsubscribe();
      if (dismissTimer !== null) window.clearTimeout(dismissTimer);
    };
  }, []);

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

        {firstRunNotice ? (
          <section className="first-run-handoff" role="status" aria-live="polite">
            <div className="first-run-handoff-mark" aria-hidden="true">✓</div>
            <div>
              <span>Profile complete</span>
              <strong>Your personalized plan ranking is ready</strong>
              <p>
                BioTrack saved your {firstRunNotice.profile.daysPerWeek}-day schedule and{' '}
                {firstRunNotice.profile.sessionMinutes}-minute sessions. Plans is open with your
                strongest match highlighted first.
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss profile completion message"
              onClick={() => setFirstRunNotice(null)}
            >
              ×
            </button>
          </section>
        ) : null}

        <FirstWorkoutCoach />
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
