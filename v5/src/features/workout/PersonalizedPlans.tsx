import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { StarterPlans } from './StarterPlans';
import { useActiveWorkout } from './hooks/useActiveWorkout';
import { useRoutines } from './hooks/useRoutines';
import { subscribeWorkoutRoutineSaved } from './routineEvents';
import type { WorkoutWorkspaceView } from './WorkoutWorkspace';
import { useWorkoutProfile } from './WorkoutProfileProvider';
import {
  labelForGoal,
  type TrainingGoal,
  type WorkoutProfile,
} from './workoutProfile';

type PersonalizedPlansProps = {
  onNavigate: (view: WorkoutWorkspaceView) => void;
};

type PlanDescriptor = {
  id: 'foundation-three-day' | 'lean-strong-four-day' | 'busy-week-two-day';
  name: string;
  days: number;
  minutes: number;
  difficulty: 'beginner' | 'intermediate';
  goalAffinity: Partial<Record<TrainingGoal, number>>;
};

const plans: PlanDescriptor[] = [
  {
    id: 'foundation-three-day',
    name: 'Foundation 3-Day',
    days: 3,
    minutes: 50,
    difficulty: 'beginner',
    goalAffinity: {
      general_fitness: 32,
      strength: 25,
      consistency: 22,
      muscle_gain: 14,
      fat_loss: 14,
    },
  },
  {
    id: 'lean-strong-four-day',
    name: 'Lean & Strong 4-Day',
    days: 4,
    minutes: 60,
    difficulty: 'intermediate',
    goalAffinity: {
      muscle_gain: 36,
      fat_loss: 32,
      strength: 20,
      general_fitness: 12,
      consistency: 4,
    },
  },
  {
    id: 'busy-week-two-day',
    name: 'Busy Week 2-Day',
    days: 2,
    minutes: 45,
    difficulty: 'beginner',
    goalAffinity: {
      consistency: 38,
      general_fitness: 22,
      fat_loss: 16,
      strength: 8,
      muscle_gain: 5,
    },
  },
];

function scorePlan(plan: PlanDescriptor, profile: WorkoutProfile): number {
  let score = 100;
  score -= Math.abs(plan.days - profile.daysPerWeek) * 22;
  score -= Math.abs(plan.minutes - profile.sessionMinutes) * 0.55;
  score += plan.goalAffinity[profile.goal] ?? 0;

  if (profile.experience === plan.difficulty) score += 18;
  if (profile.experience === 'beginner' && plan.difficulty === 'intermediate')
    score -= 24;
  if (profile.experience === 'advanced' && plan.difficulty === 'beginner')
    score -= 7;
  if (profile.movementPreferences.includes('short_sessions'))
    score -= plan.minutes > 50 ? 18 : 0;
  if (profile.equipment.includes('full_gym')) score += 5;

  return score;
}

function recommendationReason(
  plan: PlanDescriptor,
  profile: WorkoutProfile,
): string {
  const schedule = `${profile.daysPerWeek} training days and about ${profile.sessionMinutes} minutes per session`;
  if (plan.id === 'busy-week-two-day') {
    return `This plan is the closest match to your ${schedule}, with the smallest weekly time commitment.`;
  }
  if (plan.id === 'lean-strong-four-day') {
    return `This plan best matches your ${labelForGoal(profile.goal).toLowerCase()} goal and available ${schedule}.`;
  }
  return `This balanced plan fits your ${schedule} while keeping progression appropriate for your experience.`;
}

export function PersonalizedPlans({ onNavigate }: PersonalizedPlansProps) {
  const { user } = useAuth();
  const { profile } = useWorkoutProfile();
  const routineState = useRoutines(user?.id);
  const active = useActiveWorkout(user?.id);
  const refreshRoutines = routineState.refresh;
  const [recentRoutineId, setRecentRoutineId] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const activationRef = useRef<HTMLElement | null>(null);

  const recommendation = useMemo(() => {
    if (!profile) return null;
    return (
      [...plans]
        .map((plan) => ({ plan, score: scorePlan(plan, profile) }))
        .sort((left, right) => right.score - left.score)[0]?.plan ?? null
    );
  }, [profile]);

  useEffect(
    () =>
      subscribeWorkoutRoutineSaved(({ routineId }) => {
        setRecentRoutineId(routineId);
        setActivationError(null);
        void refreshRoutines().then(() => {
          window.setTimeout(() => {
            activationRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }, 120);
        });
      }),
    [refreshRoutines],
  );

  const launchRoutine = useMemo(() => {
    if (recentRoutineId) {
      const recent = routineState.routines.find(
        (routine) => routine.id === recentRoutineId,
      );
      if (recent) return recent;
    }
    return routineState.routines[0] ?? null;
  }, [recentRoutineId, routineState.routines]);

  const launchDay = useMemo(
    () => launchRoutine?.days.find((day) => day.exercises.length > 0) ?? null,
    [launchRoutine],
  );

  async function startNextWorkout() {
    setActivationError(null);

    if (active.session) {
      onNavigate('train');
      return;
    }

    if (!launchDay) {
      onNavigate('builder');
      return;
    }

    const result = await active.start(launchDay.id);
    if (!result.ok) {
      setActivationError(result.error);
      return;
    }

    onNavigate('train');
  }

  const wrapperClass = recommendation
    ? `personalized-plans personalized-plans--${recommendation.id}`
    : 'personalized-plans personalized-plans--incomplete';
  const showActivation = Boolean(active.session || launchRoutine);
  const activationBusy = active.startingDayId !== null;

  return (
    <div className={wrapperClass}>
      <aside className="starter-personalization-note">
        <div>
          <strong>
            {recommendation
              ? `${recommendation.name} is your current best match`
              : 'Personalize your plan ranking'}
          </strong>
          <span>
            {recommendation && profile
              ? recommendationReason(recommendation, profile)
              : 'Complete your training profile so BioTrack can prioritize plans around your goal, schedule and experience.'}
          </span>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={() => onNavigate('profile')}
        >
          {profile ? 'Review profile' : 'Set up profile'}
        </button>
      </aside>

      {showActivation ? (
        <section
          className={
            recentRoutineId
              ? 'plan-activation-card plan-activation-card--new'
              : 'plan-activation-card'
          }
          aria-labelledby="plan-activation-heading"
          aria-live="polite"
          ref={activationRef}
        >
          <div className="plan-activation-copy">
            <span>
              {active.session
                ? 'Workout in progress'
                : recentRoutineId
                  ? 'Plan activated'
                  : 'Ready to train'}
            </span>
            <h2 id="plan-activation-heading">
              {active.session?.name ??
                launchRoutine?.name ??
                'Your training plan'}
            </h2>
            <p>
              {active.session
                ? 'Your current session is saved and ready to resume.'
                : launchDay
                  ? `${launchDay.name} is ready with ${launchDay.exercises.length} programmed exercises.`
                  : 'Add at least one exercise day before starting this routine.'}
            </p>
            {activationError || active.error || routineState.error ? (
              <small role="alert">
                {activationError ?? active.error ?? routineState.error}
              </small>
            ) : null}
          </div>
          <div className="plan-activation-actions">
            <button
              className="primary-button"
              type="button"
              disabled={activationBusy}
              onClick={() => void startNextWorkout()}
            >
              {active.session
                ? 'Resume workout'
                : activationBusy
                  ? 'Starting…'
                  : launchDay
                    ? `Start ${launchDay.name}`
                    : 'Edit routine'}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => onNavigate('planner')}
            >
              Plan my week
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => onNavigate('builder')}
            >
              Edit routine
            </button>
          </div>
        </section>
      ) : null}

      <StarterPlans onNavigate={onNavigate} />
    </div>
  );
}
