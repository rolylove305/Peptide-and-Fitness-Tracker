import { useMemo, useState } from 'react';
import type { Exercise } from '../../types/database';
import { useAuth } from '../auth/AuthProvider';
import { ExerciseTechniqueMedia, ExerciseTechniqueSheet } from './ExerciseTechniqueMedia';
import { useExerciseMediaLibrary } from './ExerciseMediaProvider';
import { getTechniqueSummary } from './exerciseMedia';
import { hasExerciseVisual } from './exerciseVisuals';
import { useActiveWorkout } from './hooks/useActiveWorkout';
import { useExerciseLibrary } from './hooks/useExerciseLibrary';

const starterExerciseOrder = [
  'goblet-squat',
  'incline-dumbbell-press',
  'lat-pulldown',
  'leg-press',
  'seated-cable-row',
  'romanian-deadlift',
  'walking-lunge',
  'push-up',
  'glute-bridge',
  'dead-bug',
  'seated-leg-curl',
  'leg-extension',
  'dumbbell-lateral-raise',
  'face-pull',
  'standing-calf-raise',
  'cable-chest-fly',
  'single-arm-dumbbell-row',
  'barbell-hip-thrust',
  'triceps-pushdown',
  'overhead-triceps-extension',
  'hammer-curl',
  'barbell-curl',
  'cable-crunch',
];

function demoOrder(exercise: Exercise): number {
  const index = starterExerciseOrder.indexOf(exercise.slug);
  return index < 0 ? starterExerciseOrder.length : index;
}

export function ExerciseVisualGallery() {
  const library = useExerciseLibrary();
  const media = useExerciseMediaLibrary();
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showAll, setShowAll] = useState(false);

  const visualExercises = useMemo(
    () =>
      library.exercises
        .filter((exercise) => hasExerciseVisual(exercise, media.bundlesByExerciseId.get(exercise.id)))
        .sort((left, right) => demoOrder(left) - demoOrder(right) || left.name.localeCompare(right.name)),
    [library.exercises, media.bundlesByExerciseId],
  );

  if (library.status === 'loading' || media.status === 'loading') {
    return (
      <section className="visual-demo-gallery visual-demo-gallery--loading" aria-live="polite" aria-busy="true">
        <div className="visual-demo-gallery-heading">
          <div><p className="eyebrow">Technique media</p><h2>Loading professional movement demos…</h2></div>
        </div>
        <div className="visual-demo-skeleton-row">
          {Array.from({ length: 3 }, (_, index) => <span key={index} />)}
        </div>
      </section>
    );
  }

  if (visualExercises.length === 0) return null;

  const displayed = showAll ? visualExercises : visualExercises.slice(0, 8);

  return (
    <>
      <section className="visual-demo-gallery" aria-labelledby="visual-demo-gallery-heading">
        <div className="visual-demo-gallery-heading">
          <div>
            <p className="eyebrow">Technique media</p>
            <h2 id="visual-demo-gallery-heading">See the movement before you train</h2>
            <p>
              BioTrack uses rights-cleared professional images, movement loops and short videos stored in its own media catalog.
            </p>
          </div>
          <span>{visualExercises.length} professional demos</span>
        </div>

        <div className="visual-demo-grid">
          {displayed.map((exercise) => {
            const bundle = media.getBundle(exercise.id);
            const summary = getTechniqueSummary(bundle) ?? exercise.instructions[0] ?? 'Open the complete technique guide.';

            return (
              <article className="visual-demo-card" key={exercise.id}>
                <button type="button" onClick={() => setSelectedExercise(exercise)} aria-label={`Open ${exercise.name} technique demo`}>
                  <ExerciseTechniqueMedia exercise={exercise} />
                </button>
                <div>
                  <span>{exercise.primary_muscle_group}</span>
                  <h3>{exercise.name}</h3>
                  <p>{summary}</p>
                  <button className="exercise-guide-button" type="button" onClick={() => setSelectedExercise(exercise)}>
                    View technique
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {visualExercises.length > 8 ? (
          <button className="visual-demo-toggle" type="button" onClick={() => setShowAll((current) => !current)}>
            {showAll ? 'Show featured demos' : `Show all ${visualExercises.length} demos`}
          </button>
        ) : null}
      </section>

      {selectedExercise ? (
        <ExerciseTechniqueSheet exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />
      ) : null}
    </>
  );
}

export function ActiveWorkoutTechniqueDock() {
  const { user } = useAuth();
  const active = useActiveWorkout(user?.id);
  const library = useExerciseLibrary();
  const media = useExerciseMediaLibrary();
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [selectedId, setSelectedId] = useState('');

  const exerciseById = useMemo(
    () => new Map(library.exercises.map((exercise) => [exercise.id, exercise])),
    [library.exercises],
  );

  const available = useMemo(() => {
    if (!active.session) return [];

    return active.session.exercises
      .map((sessionExercise) => ({
        sessionExercise,
        exercise: exerciseById.get(sessionExercise.exercise_id) ?? null,
      }))
      .filter(
        (item): item is { sessionExercise: typeof item.sessionExercise; exercise: Exercise } => {
          if (!item.exercise) return false;
          const bundle = media.bundlesByExerciseId.get(item.exercise.id);
          return Boolean(bundle?.guide) || hasExerciseVisual(item.exercise, bundle);
        },
      );
  }, [active.session, exerciseById, media.bundlesByExerciseId]);

  if (!active.session || available.length === 0) return null;

  const nextIncomplete = active.session.exercises.find((exercise) =>
    exercise.sets.some((set) => !set.is_completed && !set.is_skipped),
  );
  const preferredId = selectedId || nextIncomplete?.exercise_id || available[0]?.exercise.id || '';
  const current = available.find((item) => item.exercise.id === preferredId) ?? available[0];
  if (!current) return null;

  const bundle = media.getBundle(current.exercise.id);
  const coachingCue =
    bundle?.guide?.coaching_cues[0] ??
    bundle?.guide?.execution_steps[0] ??
    current.exercise.instructions[0] ??
    'Move through a controlled, comfortable range of motion.';

  return (
    <>
      <aside className="active-technique-dock" aria-labelledby="active-technique-dock-heading">
        <div className="active-technique-dock-copy">
          <span className="overview-kicker">Form check</span>
          <h3 id="active-technique-dock-heading">{current.exercise.name}</h3>
          <p>{coachingCue}</p>
        </div>
        <div className="active-technique-dock-preview">
          <ExerciseTechniqueMedia exercise={current.exercise} />
        </div>
        <div className="active-technique-dock-actions">
          {available.length > 1 ? (
            <label>
              <span>Exercise guide</span>
              <select value={current.exercise.id} onChange={(event) => setSelectedId(event.target.value)}>
                {available.map((item) => (
                  <option key={item.exercise.id} value={item.exercise.id}>{item.exercise.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <button className="primary-button" type="button" onClick={() => setSelectedExercise(current.exercise)}>
            Open full technique guide
          </button>
        </div>
      </aside>

      {selectedExercise ? (
        <ExerciseTechniqueSheet exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />
      ) : null}
    </>
  );
}
