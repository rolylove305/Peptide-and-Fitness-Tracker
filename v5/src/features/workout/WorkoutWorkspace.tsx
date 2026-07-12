import { useState } from 'react';
import { ExerciseLibrary } from './ExerciseLibrary';
import { RoutineBuilder } from './RoutineBuilder';

type WorkspaceView = 'builder' | 'library';

export function WorkoutWorkspace() {
  const [view, setView] = useState<WorkspaceView>('builder');

  return (
    <div className="workout-workspace">
      <div className="workspace-tabs" role="tablist" aria-label="Workout AI tools">
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

      {view === 'builder' ? <RoutineBuilder /> : <ExerciseLibrary />}
    </div>
  );
}
