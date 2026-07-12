import { useState } from 'react';
import { ActiveWorkout } from './ActiveWorkout';
import { ExerciseLibrary } from './ExerciseLibrary';
import { ProgressionDashboard } from './ProgressionDashboard';
import { RoutineBuilder } from './RoutineBuilder';
import { WorkoutHistory } from './WorkoutHistory';

type WorkspaceView = 'train' | 'history' | 'progression' | 'builder' | 'library';

export function WorkoutWorkspace() {
  const [view, setView] = useState<WorkspaceView>('train');

  return (
    <div className="workout-workspace">
      <div className="workspace-tabs" role="tablist" aria-label="Workout AI tools">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'train'}
          className={view === 'train' ? 'workspace-tab workspace-tab--active' : 'workspace-tab'}
          onClick={() => setView('train')}
        >
          Train
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'history'}
          className={view === 'history' ? 'workspace-tab workspace-tab--active' : 'workspace-tab'}
          onClick={() => setView('history')}
        >
          History
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'progression'}
          className={view === 'progression' ? 'workspace-tab workspace-tab--active' : 'workspace-tab'}
          onClick={() => setView('progression')}
        >
          Progression
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'builder'}
          className={view === 'builder' ? 'workspace-tab workspace-tab--active' : 'workspace-tab'}
          onClick={() => setView('builder')}
        >
          Routine builder
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'library'}
          className={view === 'library' ? 'workspace-tab workspace-tab--active' : 'workspace-tab'}
          onClick={() => setView('library')}
        >
          Exercise library
        </button>
      </div>

      {view === 'train' ? <ActiveWorkout /> : null}
      {view === 'history' ? <WorkoutHistory /> : null}
      {view === 'progression' ? <ProgressionDashboard /> : null}
      {view === 'builder' ? <RoutineBuilder /> : null}
      {view === 'library' ? <ExerciseLibrary /> : null}
    </div>
  );
}
