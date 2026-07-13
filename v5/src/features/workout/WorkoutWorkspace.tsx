import { useState } from 'react';
import { ActiveWorkout } from './ActiveWorkout';
import { ExerciseLibrary } from './ExerciseLibrary';
import { ProgressionDashboard } from './ProgressionDashboard';
import { RoutineBuilder } from './RoutineBuilder';
import { StarterPlans } from './StarterPlans';
import { WorkoutCompletionExperience } from './WorkoutCompletionExperience';
import { WorkoutHistory } from './WorkoutHistory';
import { WorkoutOverview } from './WorkoutOverview';

export type WorkoutWorkspaceView =
  | 'overview'
  | 'plans'
  | 'train'
  | 'history'
  | 'progression'
  | 'builder'
  | 'library';

const tabs: Array<{ view: WorkoutWorkspaceView; label: string }> = [
  { view: 'overview', label: 'Today' },
  { view: 'plans', label: 'Plans' },
  { view: 'train', label: 'Train' },
  { view: 'history', label: 'History' },
  { view: 'progression', label: 'Progress' },
  { view: 'builder', label: 'Routines' },
  { view: 'library', label: 'Exercises' },
];

export function WorkoutWorkspace() {
  const [view, setView] = useState<WorkoutWorkspaceView>('overview');

  return (
    <div className="workout-workspace">
      <div className="workspace-tabs" role="tablist" aria-label="Workout AI tools">
        {tabs.map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={view === tab.view}
            className={view === tab.view ? 'workspace-tab workspace-tab--active' : 'workspace-tab'}
            onClick={() => setView(tab.view)}
            key={tab.view}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === 'overview' ? <WorkoutOverview onNavigate={setView} /> : null}
      {view === 'plans' ? <StarterPlans onNavigate={setView} /> : null}
      {view === 'train' ? <ActiveWorkout /> : null}
      {view === 'history' ? <WorkoutHistory /> : null}
      {view === 'progression' ? <ProgressionDashboard /> : null}
      {view === 'builder' ? <RoutineBuilder /> : null}
      {view === 'library' ? <ExerciseLibrary /> : null}

      <WorkoutCompletionExperience onNavigate={setView} />
    </div>
  );
}
