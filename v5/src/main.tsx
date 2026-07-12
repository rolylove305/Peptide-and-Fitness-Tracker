import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/global.css';
import './styles/auth.css';
import './styles/workout.css';
import './styles/routine-builder.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('BioTrack AI V5 could not find the root application element.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
