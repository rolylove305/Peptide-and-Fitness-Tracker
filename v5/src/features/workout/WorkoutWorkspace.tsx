import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ExerciseMediaProvider } from './ExerciseMediaProvider';
import { WorkoutCompletionExperience } from './WorkoutCompletionExperience';
import { WorkoutOverview } from './WorkoutOverview';
import {
  WorkoutProfileOnboarding,
  WorkoutProfilePanel,
} from './WorkoutProfileExperience';
import { WorkoutProfileProvider } from './WorkoutProfileProvider';

const ActiveWorkout = lazy(() =>
  import('./ActiveWorkout').then((module) => ({
    default: module.ActiveWorkout,
  })),
);
const ExerciseLibrary = lazy(() =>
  import('./ExerciseLibrary').then((module) => ({
    default: module.ExerciseLibrary,
  })),
);
const ExerciseVisualGallery = lazy(() =>
  import('./ExerciseVisualGallery').then((module) => ({
    default: module.ExerciseVisualGallery,
  })),
);
const ActiveWorkoutTechniqueDock = lazy(() =>
  import('./ExerciseVisualGallery').then((module) => ({
    default: module.ActiveWorkoutTechniqueDock,
  })),
);
const PersonalizedPlans = lazy(() =>
  import('./PersonalizedPlans').then((module) => ({
    default: module.PersonalizedPlans,
  })),
);
const ProgressionCoach = lazy(() =>
  import('./ProgressionCoach').then((module) => ({
    default: module.ProgressionCoach,
  })),
);
const ProgressionDashboard = lazy(() =>
  import('./ProgressionDashboard').then((module) => ({
    default: module.ProgressionDashboard,
  })),
);
const RoutineBuilder = lazy(() =>
  import('./RoutineBuilder').then((module) => ({
    default: module.RoutineBuilder,
  })),
);
const WeeklyPlanner = lazy(() =>
  import('./WeeklyPlanner').then((module) => ({
    default: module.WeeklyPlanner,
  })),
);
const WorkoutHistory = lazy(() =>
  import('./WorkoutHistory').then((module) => ({
    default: module.WorkoutHistory,
  })),
);
const WorkoutInsights = lazy(() =>
  import('./WorkoutInsights').then((module) => ({
    default: module.WorkoutInsights,
  })),
);
export type WorkoutWorkspaceView =
  | 'overview'
  | 'planner'
  | 'plans'
  | 'train'
  | 'history'
  | 'insights'
  | 'progression'
  | 'builder'
  | 'library'
  | 'profile';

type WorkspaceNavigationIcon =
  | 'today'
  | 'train'
  | 'plans'
  | 'progress'
  | 'more'
  | 'week'
  | 'history'
  | 'insights'
  | 'routines'
  | 'exercises'
  | 'profile';

type WorkspaceNavigationItem = {
  view: WorkoutWorkspaceView;
  label: string;
  description: string;
  icon: WorkspaceNavigationIcon;
};

const primaryNavigation: WorkspaceNavigationItem[] = [
  {
    view: 'overview',
    label: 'Today',
    description: 'Your next workout and weekly status',
    icon: 'today',
  },
  {
    view: 'train',
    label: 'Train',
    description: 'Start or resume a live workout',
    icon: 'train',
  },
  {
    view: 'plans',
    label: 'Plans',
    description: 'Choose a personalized training plan',
    icon: 'plans',
  },
  {
    view: 'progression',
    label: 'Progress',
    description: 'Review coaching and progression',
    icon: 'progress',
  },
];

const secondaryNavigation: WorkspaceNavigationItem[] = [
  {
    view: 'planner',
    label: 'Week',
    description: 'Schedule routine days',
    icon: 'week',
  },
  {
    view: 'history',
    label: 'History',
    description: 'Review completed workouts',
    icon: 'history',
  },
  {
    view: 'insights',
    label: 'Insights',
    description: 'See training patterns',
    icon: 'insights',
  },
  {
    view: 'builder',
    label: 'Routines',
    description: 'Create and edit routines',
    icon: 'routines',
  },
  {
    view: 'library',
    label: 'Exercises',
    description: 'Browse technique and media',
    icon: 'exercises',
  },
  {
    view: 'profile',
    label: 'Profile',
    description: 'Update goals and preferences',
    icon: 'profile',
  },
];

function NavigationIcon({ name }: { name: WorkspaceNavigationIcon }) {
  const iconProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'today':
      return (
        <svg {...iconProps}>
          <path d="M4 10.5 12 4l8 6.5" />
          <path d="M6.5 9.5V20h11V9.5" />
          <path d="M9.5 20v-6h5v6" />
        </svg>
      );
    case 'train':
      return (
        <svg {...iconProps}>
          <path d="M3.5 9v6M6.5 7v10M17.5 7v10M20.5 9v6" />
          <path d="M6.5 12h11" />
        </svg>
      );
    case 'plans':
      return (
        <svg {...iconProps}>
          <path d="M6 3.5v3M18 3.5v3" />
          <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
          <path d="M4 9.5h16M8 13h3M8 16.5h6" />
        </svg>
      );
    case 'progress':
      return (
        <svg {...iconProps}>
          <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />
          <path d="M2.5 19.5h20" />
        </svg>
      );
    case 'week':
      return (
        <svg {...iconProps}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
          <path d="M7 3.5v3M17 3.5v3M3.5 9h17" />
          <path d="m8 14 2 2 5-5" />
        </svg>
      );
    case 'history':
      return (
        <svg {...iconProps}>
          <path d="M4.5 8.5H9V4" />
          <path d="M5 7.5a8 8 0 1 1-1 8.5" />
          <path d="M12 8v4.5l3 2" />
        </svg>
      );
    case 'insights':
      return (
        <svg {...iconProps}>
          <path d="M5 19V11M10 19V7M15 19v-4M20 19V4" />
          <path d="m4 8 5-3 5 4 6-6" />
        </svg>
      );
    case 'routines':
      return (
        <svg {...iconProps}>
          <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
          <path d="M9 3.5h6v3H9zM8.5 11h7M8.5 15h5" />
        </svg>
      );
    case 'exercises':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="5" r="2" />
          <path d="m8 10 4-2 4 2M12 8v5M8 20l4-7 4 7M7 12h10" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6" />
        </svg>
      );
    case 'more':
    default:
      return (
        <svg {...iconProps}>
          <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

type WorkspaceNavigationProps = {
  view: WorkoutWorkspaceView;
  onNavigate: (view: WorkoutWorkspaceView) => void;
};

function WorkspaceNavigation({ view, onNavigate }: WorkspaceNavigationProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigationRef = useRef<HTMLElement>(null);
  const secondaryActive = secondaryNavigation.some(
    (item) => item.view === view,
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [view]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        navigationRef.current &&
        !navigationRef.current.contains(target)
      ) {
        setMoreOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMoreOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function navigate(nextView: WorkoutWorkspaceView) {
    onNavigate(nextView);
    setMoreOpen(false);
  }

  return (
    <nav
      className="workspace-navigation"
      aria-label="Workout AI navigation"
      ref={navigationRef}
    >
      <div className="workspace-primary-nav">
        {primaryNavigation.map((item) => {
          const active = view === item.view;
          return (
            <button
              type="button"
              className={
                active
                  ? 'workspace-nav-button workspace-nav-button--active'
                  : 'workspace-nav-button'
              }
              aria-current={active ? 'page' : undefined}
              aria-label={`${item.label}: ${item.description}`}
              onClick={() => navigate(item.view)}
              key={item.view}
            >
              <span className="workspace-nav-icon">
                <NavigationIcon name={item.icon} />
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          className={
            secondaryActive || moreOpen
              ? 'workspace-nav-button workspace-nav-button--more workspace-nav-button--active'
              : 'workspace-nav-button workspace-nav-button--more'
          }
          aria-expanded={moreOpen}
          aria-controls="workspace-more-panel"
          aria-label="More Workout AI tools"
          onClick={() => setMoreOpen((current) => !current)}
        >
          <span className="workspace-nav-icon">
            <NavigationIcon name="more" />
          </span>
          <span>More</span>
          {secondaryActive ? (
            <i className="workspace-nav-status-dot" aria-hidden="true" />
          ) : null}
        </button>
      </div>

      {moreOpen ? (
        <div className="workspace-more-panel" id="workspace-more-panel">
          <div className="workspace-more-heading">
            <div>
              <span>More tools</span>
              <small>Planning, records and settings</small>
            </div>
            <button
              type="button"
              aria-label="Close more tools"
              onClick={() => setMoreOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="workspace-more-grid" role="menu">
            {secondaryNavigation.map((item) => {
              const active = view === item.view;
              return (
                <button
                  type="button"
                  role="menuitem"
                  className={
                    active
                      ? 'workspace-more-item workspace-more-item--active'
                      : 'workspace-more-item'
                  }
                  aria-current={active ? 'page' : undefined}
                  onClick={() => navigate(item.view)}
                  key={item.view}
                >
                  <span className="workspace-more-icon">
                    <NavigationIcon name={item.icon} />
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </nav>
  );
}

function WorkoutWorkspaceContent() {
  const [view, setView] = useState<WorkoutWorkspaceView>('overview');

  return (
    <div className="workout-workspace">
      <WorkspaceNavigation view={view} onNavigate={setView} />

      <div className="workspace-view-shell" id="workout-workspace-view">
        <Suspense
          fallback={
            <div
              className="workspace-view-loading"
              role="status"
              aria-live="polite"
            >
              <span
                className="workspace-view-loading__pulse"
                aria-hidden="true"
              />
              <span>Preparing your workspace…</span>
            </div>
          }
        >
          {view === 'overview' ? (
            <WorkoutOverview onNavigate={setView} />
          ) : null}
          {view === 'planner' ? <WeeklyPlanner onNavigate={setView} /> : null}
          {view === 'plans' ? <PersonalizedPlans onNavigate={setView} /> : null}
          {view === 'train' ? (
            <div className="live-training-stack">
              <ActiveWorkout />
              <ActiveWorkoutTechniqueDock />
            </div>
          ) : null}
          {view === 'history' ? <WorkoutHistory /> : null}
          {view === 'insights' ? <WorkoutInsights /> : null}
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
        </Suspense>
      </div>

      <WorkoutCompletionExperience onNavigate={setView} />
      <WorkoutProfileOnboarding />
    </div>
  );
}

export function WorkoutWorkspace() {
  return (
    <WorkoutProfileProvider>
      <ExerciseMediaProvider>
        <WorkoutWorkspaceContent />
      </ExerciseMediaProvider>
    </WorkoutProfileProvider>
  );
}
