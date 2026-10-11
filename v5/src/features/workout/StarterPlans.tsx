import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useExerciseLibrary } from './hooks/useExerciseLibrary';
import { useRoutines } from './hooks/useRoutines';
import type {
  RoutineDraft,
  WeightUnit,
} from './repositories/routineRepository';
import type { WorkoutWorkspaceView } from './WorkoutWorkspace';

type TemplateExercise = {
  slug: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  notes?: string;
};

type TemplateDay = {
  name: string;
  focus: string;
  exercises: TemplateExercise[];
};

type StarterPlanTemplate = {
  id: string;
  name: string;
  badge: string;
  summary: string;
  goal: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek: number;
  sessionMinutes: string;
  highlights: string[];
  days: TemplateDay[];
};

type StarterPlansProps = {
  onNavigate: (view: WorkoutWorkspaceView) => void;
};

const starterPlans: StarterPlanTemplate[] = [
  {
    id: 'foundation-three-day',
    name: 'Foundation 3-Day',
    badge: 'Best first plan',
    summary:
      'A balanced full-body plan designed to build consistency, movement confidence and basic strength.',
    goal: 'Build strength, improve fitness and establish a repeatable gym routine',
    difficulty: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: '45–55 min',
    highlights: [
      'Full body each session',
      'Mostly beginner-friendly movements',
      'Rest day between sessions',
    ],
    days: [
      {
        name: 'Full Body A',
        focus: 'Squat, horizontal press and vertical pull',
        exercises: [
          {
            slug: 'goblet-squat',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
          },
          {
            slug: 'incline-dumbbell-press',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
          },
          {
            slug: 'lat-pulldown',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
          },
          {
            slug: 'glute-bridge',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 60,
          },
          {
            slug: 'dead-bug',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 45,
            notes: 'Count repetitions per side.',
          },
        ],
      },
      {
        name: 'Full Body B',
        focus: 'Leg drive, rowing and shoulder stability',
        exercises: [
          {
            slug: 'leg-press',
            sets: 3,
            repsMin: 10,
            repsMax: 12,
            restSeconds: 90,
          },
          {
            slug: 'seated-cable-row',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
          },
          {
            slug: 'push-up',
            sets: 3,
            repsMin: 6,
            repsMax: 15,
            restSeconds: 75,
            notes: 'Use an elevated surface when needed.',
          },
          {
            slug: 'seated-leg-curl',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 75,
          },
          {
            slug: 'face-pull',
            sets: 3,
            repsMin: 12,
            repsMax: 15,
            restSeconds: 60,
          },
          {
            slug: 'cable-crunch',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 60,
          },
        ],
      },
      {
        name: 'Full Body C',
        focus: 'Single-leg strength, posterior chain and upper back',
        exercises: [
          {
            slug: 'walking-lunge',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
            notes: 'Count repetitions per leg.',
          },
          {
            slug: 'single-arm-dumbbell-row',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 75,
            notes: 'Count repetitions per side.',
          },
          {
            slug: 'cable-chest-fly',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 60,
          },
          {
            slug: 'romanian-deadlift',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
          },
          {
            slug: 'dumbbell-lateral-raise',
            sets: 3,
            repsMin: 12,
            repsMax: 15,
            restSeconds: 60,
          },
          {
            slug: 'standing-calf-raise',
            sets: 3,
            repsMin: 12,
            repsMax: 20,
            restSeconds: 60,
          },
        ],
      },
    ],
  },
  {
    id: 'lean-strong-four-day',
    name: 'Lean & Strong 4-Day',
    badge: 'Muscle + fat loss',
    summary:
      'An upper/lower split with enough weekly volume to build muscle while supporting an active fat-loss phase.',
    goal: 'Build lean muscle, preserve strength and increase weekly training volume',
    difficulty: 'intermediate',
    daysPerWeek: 4,
    sessionMinutes: '50–65 min',
    highlights: [
      'Two upper-body days',
      'Two lower-body days',
      'Balanced muscle-group volume',
    ],
    days: [
      {
        name: 'Upper A',
        focus: 'Chest, back, shoulders and arms',
        exercises: [
          {
            slug: 'incline-dumbbell-press',
            sets: 4,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
          },
          {
            slug: 'lat-pulldown',
            sets: 4,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
          },
          {
            slug: 'seated-cable-row',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
          },
          {
            slug: 'dumbbell-lateral-raise',
            sets: 3,
            repsMin: 12,
            repsMax: 15,
            restSeconds: 60,
          },
          {
            slug: 'triceps-pushdown',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 60,
          },
          {
            slug: 'hammer-curl',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 60,
          },
        ],
      },
      {
        name: 'Lower A',
        focus: 'Quadriceps, hamstrings, calves and core',
        exercises: [
          {
            slug: 'leg-press',
            sets: 4,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 120,
          },
          {
            slug: 'romanian-deadlift',
            sets: 4,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 120,
          },
          {
            slug: 'walking-lunge',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
            notes: 'Count repetitions per leg.',
          },
          {
            slug: 'seated-leg-curl',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 75,
          },
          {
            slug: 'standing-calf-raise',
            sets: 4,
            repsMin: 12,
            repsMax: 20,
            restSeconds: 60,
          },
          {
            slug: 'cable-crunch',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 60,
          },
        ],
      },
      {
        name: 'Upper B',
        focus: 'Chest, back, rear shoulders and arms',
        exercises: [
          {
            slug: 'push-up',
            sets: 3,
            repsMin: 8,
            repsMax: 15,
            restSeconds: 75,
            notes: 'Use an elevated surface when needed.',
          },
          {
            slug: 'single-arm-dumbbell-row',
            sets: 4,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
            notes: 'Count repetitions per side.',
          },
          {
            slug: 'cable-chest-fly',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 60,
          },
          {
            slug: 'face-pull',
            sets: 3,
            repsMin: 12,
            repsMax: 15,
            restSeconds: 60,
          },
          {
            slug: 'overhead-triceps-extension',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 60,
          },
          {
            slug: 'barbell-curl',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 60,
          },
        ],
      },
      {
        name: 'Lower B',
        focus: 'Glutes, quadriceps, hamstrings and core',
        exercises: [
          {
            slug: 'goblet-squat',
            sets: 4,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 120,
          },
          {
            slug: 'barbell-hip-thrust',
            sets: 4,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 120,
          },
          {
            slug: 'leg-extension',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 75,
          },
          {
            slug: 'seated-leg-curl',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 75,
          },
          {
            slug: 'glute-bridge',
            sets: 3,
            repsMin: 12,
            repsMax: 15,
            restSeconds: 60,
          },
          {
            slug: 'dead-bug',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 45,
            notes: 'Count repetitions per side.',
          },
        ],
      },
    ],
  },
  {
    id: 'busy-week-two-day',
    name: 'Busy Week 2-Day',
    badge: 'Minimum effective schedule',
    summary:
      'Two efficient full-body sessions for weeks when work, travel or recovery limit your gym time.',
    goal: 'Maintain consistency and train every major muscle group with two weekly sessions',
    difficulty: 'beginner',
    daysPerWeek: 2,
    sessionMinutes: '40–50 min',
    highlights: [
      'Only two gym days',
      'Simple machine and dumbbell options',
      'Easy to repeat during busy weeks',
    ],
    days: [
      {
        name: 'Full Body 1',
        focus: 'Legs, chest, back and core',
        exercises: [
          {
            slug: 'leg-press',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
          },
          {
            slug: 'incline-dumbbell-press',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
          },
          {
            slug: 'lat-pulldown',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
          },
          {
            slug: 'seated-leg-curl',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 75,
          },
          {
            slug: 'face-pull',
            sets: 2,
            repsMin: 12,
            repsMax: 15,
            restSeconds: 60,
          },
          {
            slug: 'cable-crunch',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 60,
          },
        ],
      },
      {
        name: 'Full Body 2',
        focus: 'Squat, glutes, rowing and arms',
        exercises: [
          {
            slug: 'goblet-squat',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 90,
          },
          {
            slug: 'single-arm-dumbbell-row',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restSeconds: 75,
            notes: 'Count repetitions per side.',
          },
          {
            slug: 'cable-chest-fly',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 60,
          },
          {
            slug: 'glute-bridge',
            sets: 3,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 60,
          },
          {
            slug: 'triceps-pushdown',
            sets: 2,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 60,
          },
          {
            slug: 'hammer-curl',
            sets: 2,
            repsMin: 10,
            repsMax: 15,
            restSeconds: 60,
          },
        ],
      },
    ],
  },
];

function localId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function StarterPlans({ onNavigate }: StarterPlansProps) {
  const { user } = useAuth();
  const exerciseLibrary = useExerciseLibrary();
  const routineState = useRoutines(user?.id);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lb');
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const exerciseBySlug = useMemo(
    () =>
      new Map(
        exerciseLibrary.exercises.map((exercise) => [exercise.slug, exercise]),
      ),
    [exerciseLibrary.exercises],
  );

  const existingRoutineNames = useMemo(
    () =>
      new Set(
        routineState.routines.map((routine) =>
          routine.name.trim().toLocaleLowerCase(),
        ),
      ),
    [routineState.routines],
  );

  function planAvailability(template: StarterPlanTemplate) {
    const requiredSlugs = Array.from(
      new Set(
        template.days.flatMap((day) =>
          day.exercises.map((exercise) => exercise.slug),
        ),
      ),
    );
    const missing = requiredSlugs.filter((slug) => !exerciseBySlug.has(slug));
    return { available: missing.length === 0, missing };
  }

  function buildDraft(template: StarterPlanTemplate): RoutineDraft | null {
    const availability = planAvailability(template);
    if (!availability.available) return null;

    return {
      name: template.name,
      description: `${template.summary} Suggested schedule: ${template.daysPerWeek} days per week, approximately ${template.sessionMinutes} per session.`,
      goal: template.goal,
      difficulty: template.difficulty,
      days: template.days.map((day) => {
        const resolvedExercises = day.exercises.map((item) => {
          const exercise = exerciseBySlug.get(item.slug);
          if (!exercise)
            throw new Error(`Exercise ${item.slug} is unavailable.`);
          return {
            localId: localId(),
            exercise_id: exercise.id,
            target_sets: item.sets,
            target_reps_min: item.repsMin,
            target_reps_max: item.repsMax,
            target_rest_seconds: item.restSeconds,
            target_weight: null,
            weight_unit: weightUnit,
            tempo: '',
            notes: item.notes ?? '',
          };
        });

        return {
          localId: localId(),
          name: day.name,
          focus: day.focus,
          focus_muscle_groups: Array.from(
            new Set(
              resolvedExercises
                .map(
                  (item) =>
                    exerciseLibrary.exercises.find(
                      (exercise) => exercise.id === item.exercise_id,
                    )?.primary_muscle_group,
                )
                .filter((group): group is string => Boolean(group)),
            ),
          ),
          exercises: resolvedExercises,
        };
      }),
    };
  }

  async function addPlan(template: StarterPlanTemplate) {
    setMessage(null);
    setLocalError(null);

    if (!user) {
      setLocalError('Sign in before adding a starter plan.');
      return;
    }

    const draft = buildDraft(template);
    if (!draft) {
      setLocalError(
        'This plan cannot be created because one or more exercises are unavailable.',
      );
      return;
    }

    setInstallingId(template.id);
    try {
      const result = await routineState.save(draft, null);
      if (!result?.ok) {
        setLocalError(
          result?.error ?? 'BioTrack could not add this starter plan.',
        );
        return;
      }
      setMessage(
        `${template.name} was added to your routines. You can edit any exercise before training.`,
      );
    } finally {
      setInstallingId(null);
    }
  }

  const loading =
    exerciseLibrary.status === 'loading' || routineState.status === 'loading';

  return (
    <section className="starter-plans" aria-labelledby="starter-plans-heading">
      <div className="starter-plans-heading">
        <div>
          <p className="eyebrow">Quick setup</p>
          <h2 id="starter-plans-heading">Choose a starter plan</h2>
          <p>
            Add a complete routine in one tap, then edit exercises, targets or
            rest periods whenever you need.
          </p>
        </div>
        <label className="starter-unit-control">
          <span>Weight unit</span>
          <select
            value={weightUnit}
            onChange={(event) =>
              setWeightUnit(event.target.value as WeightUnit)
            }
          >
            <option value="lb">Pounds (lb)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </label>
      </div>

      {message ? (
        <div
          className="starter-plan-message starter-plan-message--success"
          role="status"
        >
          <div>
            <strong>Plan ready</strong>
            <p>{message}</p>
          </div>
          <div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => onNavigate('builder')}
            >
              View routines
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => onNavigate('train')}
            >
              Go to training
            </button>
          </div>
        </div>
      ) : null}

      {localError || exerciseLibrary.error || routineState.error ? (
        <p className="builder-message builder-message--error" role="alert">
          {localError ?? exerciseLibrary.error ?? routineState.error}
        </p>
      ) : null}

      {loading ? (
        <div className="starter-plan-grid" aria-live="polite" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              className="starter-plan-card starter-plan-card--loading"
              key={index}
            />
          ))}
        </div>
      ) : (
        <div className="starter-plan-grid">
          {starterPlans.map((template) => {
            const availability = planAvailability(template);
            const alreadyAdded = existingRoutineNames.has(
              template.name.toLocaleLowerCase(),
            );
            const installing = installingId === template.id;

            return (
              <article
                className={`starter-plan-card starter-plan-card--${template.id}`}
                key={template.id}
              >
                <header className="starter-plan-card-header">
                  <div>
                    <span className="starter-plan-badge">{template.badge}</span>
                    <h3>{template.name}</h3>
                    <p>{template.summary}</p>
                  </div>
                  <span className="starter-plan-days">
                    {template.daysPerWeek}
                    <small>days</small>
                  </span>
                </header>

                <div className="starter-plan-meta">
                  <span>{template.difficulty}</span>
                  <span>{template.sessionMinutes}</span>
                  <span>
                    {template.days.reduce(
                      (sum, day) => sum + day.exercises.length,
                      0,
                    )}{' '}
                    exercises programmed
                  </span>
                </div>

                <ul className="starter-plan-highlights">
                  {template.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>

                <div className="starter-plan-days-list">
                  {template.days.map((day, index) => (
                    <details key={day.name} open={index === 0}>
                      <summary>
                        <span>
                          <strong>{day.name}</strong>
                          <small>{day.focus}</small>
                        </span>
                        <em>{day.exercises.length}</em>
                      </summary>
                      <ol>
                        {day.exercises.map((item) => (
                          <li key={`${day.name}-${item.slug}`}>
                            <span>
                              {exerciseBySlug.get(item.slug)?.name ?? item.slug}
                            </span>
                            <small>
                              {item.sets} ×{' '}
                              {item.repsMin === item.repsMax
                                ? item.repsMin
                                : `${item.repsMin}–${item.repsMax}`}
                            </small>
                          </li>
                        ))}
                      </ol>
                    </details>
                  ))}
                </div>

                {!availability.available ? (
                  <p className="starter-plan-unavailable">
                    Missing {availability.missing.length} required exercises.
                  </p>
                ) : null}

                <button
                  className={
                    alreadyAdded
                      ? 'starter-plan-add starter-plan-add--added'
                      : 'starter-plan-add'
                  }
                  type="button"
                  disabled={
                    !availability.available ||
                    alreadyAdded ||
                    installingId !== null ||
                    routineState.saving
                  }
                  onClick={() => void addPlan(template)}
                >
                  {installing
                    ? 'Adding plan…'
                    : alreadyAdded
                      ? '✓ Already in routines'
                      : 'Add to my routines'}
                </button>
              </article>
            );
          })}
        </div>
      )}

      <aside className="starter-plan-note">
        <strong>Make the plan fit your body.</strong>
        <p>
          These are general training templates. Edit or replace any movement
          that conflicts with an injury, equipment limitation or professional
          medical advice. Stop a movement that causes pain.
        </p>
      </aside>
    </section>
  );
}
