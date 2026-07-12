import { useEffect, useState } from 'react';
import { supabaseConfiguration } from '../lib/supabase/client';

type ConnectionState = 'online' | 'offline';

const foundationItems = [
  {
    title: 'Secure accounts',
    description: 'Supabase authentication and private per-user data.',
    status: 'Next',
  },
  {
    title: 'Workout AI',
    description: 'Exercise library, routines, live sets, rest timer and history.',
    status: 'Priority',
  },
  {
    title: 'Progress intelligence',
    description: 'Exercise, strength and muscle-group progress built from real logs.',
    status: 'Planned',
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

export function App() {
  const connection = useConnectionState();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">BioTrack AI</p>
          <h1>V5 Foundation</h1>
          <p className="subtitle">A clean, modular rebuild beside the current working app.</p>
        </div>
        <div className={`connection-badge connection-badge--${connection}`}>
          <span aria-hidden="true" className="connection-dot" />
          {connection === 'online' ? 'Online' : 'Offline'}
        </div>
      </header>

      <main>
        <section className="hero-card">
          <div>
            <p className="eyebrow">First product milestone</p>
            <h2>Workout AI</h2>
            <p>
              V5 will record structured workouts first, then use that history to generate explainable
              recommendations without silently changing your plan.
            </p>
          </div>
          <div className="milestone-mark" aria-label="Foundation phase">
            01
          </div>
        </section>

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
              {supabaseConfiguration.isConfigured ? 'Supabase ready' : 'Environment setup required'}
            </h2>
            <p>
              {supabaseConfiguration.isConfigured
                ? 'The V5 client has a project URL and publishable key.'
                : 'Copy .env.example to .env.local and add the approved publishable credentials before connecting authentication.'}
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
