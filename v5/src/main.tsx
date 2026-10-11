import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { GlobalErrorBoundary } from './app/GlobalErrorBoundary';
import { startClientErrorReporting } from './observability/clientErrorReporter';
import { startPwaUpdateManager } from './pwa/pwaUpdateManager';
import './styles/global.css';
import './styles/global-error-recovery.css';
import './styles/auth.css';
import './styles/auth-recovery.css';
import './styles/workout.css';
import './styles/exercise-library-pro.css';
import './styles/exercise-technique-visuals.css';
import './styles/exercise-media-engine.css';
import './styles/workout-overview.css';
import './styles/today-command-center.css';
import './styles/starter-plans.css';
import './styles/personalized-plans.css';
import './styles/workout-profile.css';
import './styles/first-run-handoff.css';
import './styles/first-workout-coach.css';
import './styles/workout-sync-status.css';
import './styles/pwa-update-status.css';
import './styles/weekly-planner.css';
import './styles/routine-builder.css';
import './styles/routine-builder-controls.css';
import './styles/active-workout.css';
import './styles/fast-workout.css';
import './styles/flexible-live-workout.css';
import './styles/workout-completion.css';
import './styles/workout-history.css';
import './styles/active-workout-history-notice.css';
import './styles/workout-insights.css';
import './styles/progression.css';
import './styles/progression-approval.css';
import './styles/progression-coach.css';
import './styles/progression-coach-layout.css';
import './styles/workspace-mobile.css';
import './styles/peptides.css';

startClientErrorReporting();
startPwaUpdateManager(import.meta.env.PROD);

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'BioTrack AI V5 could not find the root application element.',
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);
