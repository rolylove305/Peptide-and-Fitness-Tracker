import { useState } from 'react';
import { ActiveWorkout } from './ActiveWorkout';
import { ExerciseLibrary } from './ExerciseLibrary';
import {
  ActiveWorkoutTechniqueDock,
  ExerciseVisualGallery,
} from './ExerciseVisualGallery';
import { PersonalizedPlans } from './PersonalizedPlans';
import { ProgressionCoach } from './ProgressionCoach';
import { ProgressionDashboard } from './ProgressionDashboard';
import { RoutineBuilder } from './RoutineBuilder';
import { WeeklyPlanner } from './WeeklyPlanner';
import { WorkoutCompletionExperience } from './WorkoutCompletionExperience';
import { WorkoutHistory } from './WorkoutHistory';
import { WorkoutOverview } from './WorkoutOverview';
import {
  WorkoutProfileOnboarding,
  WorkoutProfilePanel,
} from './WorkoutProfileExperience';
import { WorkoutProfileProvider } from './WorkoutProfileProvider';

export type WorkoutWorkspaceView =
  | 'overview'
  | 'planner'
  | 'plans'
  | 'train'
  | 'history'
  | 'progression'
  | 'builder'
  | 'library'
  | 'profile';

const tabs: Array<{ view: WorkoutWorkspaceView; label: string }> = [
  { view: 'overview', label: 'Today' },
  { view: 'planner', label: 'Week' },
  { view: 'plans', label: 'Plans' },
  { view: 'train', label: 'Train' },
  { view: 'history', label: 'History' },
  { view: 'progression', label: 'Progress' },
  { view: 'builder', label: 'Routines' },
  { view: 'library', label: 'Exercises' },
  { view: 'profile', label: 'Profile' },
];

function WorkoutWorkspaceContent() {
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
      {view === 'planner' ? <WeeklyPlanner onNavigate={setView} /> : null}
      {view === 'plans' ? <PersonalizedPlans onNavigate={setView} /> : null}
      {view === 'train' ? (
        <div className="live-training-stack">
          <ActiveWorkout />
          <ActiveWorkoutTechniqueDock />
        </div>
      ) : null}
      {view === 'history' ? <WorkoutHistory /> : null}
      {view === 'progression' ? (
        <div className="progression-workspace-stack">
          <ProgressionCoach />
          <ProgressionDashboard />
        </div>
      ) : null}
      {view === 'builder' ? <RoutineBuilder /> : null}
      {view === 'library' ? (
        <div className="exercise-library-visual-stack">
          <ExerciseVisualGallery />
          <ExerciseLibrary />
        </div>
      ) : null}
      {view === 'profile' ? <WorkoutProfilePanel /> : null}

      <WorkoutCompletionExperience onNavigate={setView} />
      <WorkoutProfileOnboarding />
    </div>
  );
}

export function WorkoutWorkspace() {
  return (
    <WorkoutProfileProvider>
      <WorkoutWorkspaceContent />
    </WorkoutProfileProvider>
  );
}
