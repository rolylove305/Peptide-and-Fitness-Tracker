import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/global.css';
import './styles/auth.css';
import './styles/auth-recovery.css';
import './styles/workout.css';
import './styles/exercise-library-pro.css';
import './styles/workout-overview.css';
import './styles/starter-plans.css';
import './styles/personalized-plans.css';
import './styles/workout-profile.css';
import './styles/routine-builder.css';
import './styles/routine-builder-controls.css';
import './styles/active-workout.css';
import './styles/fast-workout.css';
import './styles/workout-completion.css';
import './styles/workout-history.css';
import './styles/progression.css';
import './styles/progression-approval.css';
import './styles/progression-coach.css';
import './styles/progression-coach-layout.css';
import './styles/workspace-mobile.css';

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
      console.warn('BioTrack AI service worker registration failed.', error);
    });
  });
}

registerServiceWorker();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('BioTrack AI V5 could not find the root application element.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
