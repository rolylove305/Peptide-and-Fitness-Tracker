import { useMemo } from 'react';
import { StarterPlans } from './StarterPlans';
import type { WorkoutWorkspaceView } from './WorkoutWorkspace';
import { useWorkoutProfile } from './WorkoutProfileProvider';
import { labelForGoal, type TrainingGoal, type WorkoutProfile } from './workoutProfile';

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
    goalAffinity: { general_fitness: 32, strength: 25, consistency: 22, muscle_gain: 14, fat_loss: 14 },
  },
  {
    id: 'lean-strong-four-day',
    name: 'Lean & Strong 4-Day',
    days: 4,
    minutes: 60,
    difficulty: 'intermediate',
    goalAffinity: { muscle_gain: 36, fat_loss: 32, strength: 20, general_fitness: 12, consistency: 4 },
  },
  {
    id: 'busy-week-two-day',
    name: 'Busy Week 2-Day',
    days: 2,
    minutes: 45,
    difficulty: 'beginner',
    goalAffinity: { consistency: 38, general_fitness: 22, fat_loss: 16, strength: 8, muscle_gain: 5 },
  },
];

function scorePlan(plan: PlanDescriptor, profile: WorkoutProfile): number {
  let score = 100;
  score -= Math.abs(plan.days - profile.daysPerWeek) * 22;
  score -= Math.abs(plan.minutes - profile.sessionMinutes) * 0.55;
  score += plan.goalAffinity[profile.goal] ?? 0;

  if (profile.experience === plan.difficulty) score += 18;
  if (profile.experience === 'beginner' && plan.difficulty === 'intermediate') score -= 24;
  if (profile.experience === 'advanced' && plan.difficulty === 'beginner') score -= 7;
  if (profile.movementPreferences.includes('short_sessions')) score -= plan.minutes > 50 ? 18 : 0;
  if (profile.equipment.includes('full_gym')) score += 5;

  return score;
}

function recommendationReason(plan: PlanDescriptor, profile: WorkoutProfile): string {
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
  const { profile } = useWorkoutProfile();

  const recommendation = useMemo(() => {
    if (!profile) return null;
    return [...plans]
      .map((plan) => ({ plan, score: scorePlan(plan, profile) }))
      .sort((left, right) => right.score - left.score)[0]?.plan ?? null;
  }, [profile]);

  const wrapperClass = recommendation
    ? `personalized-plans personalized-plans--${recommendation.id}`
    : 'personalized-plans personalized-plans--incomplete';

  return (
    <div className={wrapperClass}>
      <aside className="starter-personalization-note">
        <div>
          <strong>{recommendation ? `${recommendation.name} is your current best match` : 'Personalize your plan ranking'}</strong>
          <span>
            {recommendation && profile
              ? recommendationReason(recommendation, profile)
              : 'Complete your training profile so BioTrack can prioritize plans around your goal, schedule and experience.'}
          </span>
        </div>
        <button className="secondary-button" type="button" onClick={() => onNavigate('profile')}>
          {profile ? 'Review profile' : 'Set up profile'}
        </button>
      </aside>
      <StarterPlans onNavigate={onNavigate} />
    </div>
  );
}
