import { useMemo, useState } from 'react';
import type { Exercise } from '../../types/database';
import { useAuth } from '../auth/AuthProvider';
import { useActiveWorkout } from './hooks/useActiveWorkout';
import { useExerciseLibrary } from './hooks/useExerciseLibrary';
import {
  ExerciseTechniqueMedia,
  ExerciseTechniqueSheet,
  getBuiltInExerciseDemo,
} from './ExerciseTechniqueMedia';

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
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [showAll, setShowAll] = useState(false);

  const visualExercises = useMemo(
    () =>
      library.exercises
        .filter((exercise) => Boolean(getBuiltInExerciseDemo(exercise.slug)))
        .sort((a, b) => demoOrder(a) - demoOrder(b) || a.name.localeCompare(b.name)),
    [library.exercises],
  );

  if (library.status === 'loading') {
    return (
      <section className="visual-demo-gallery visual-demo-gallery--loading" aria-live="polite" aria-busy="true">
        <div className="visual-demo-gallery-heading">
          <div><p className="eyebrow">Technique demos</p><h2>Loading movement visuals…</h2></div>
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
            <p className="eyebrow">Technique demos</p>
            <h2 id="visual-demo-gallery-heading">See the movement before you train</h2>
            <p>
              Lightweight BioTrack illustrations show the start and finish positions without relying on random external videos.
            </p>
          </div>
          <span>{visualExercises.length} illustrated exercises</span>
        </div>

        <div className="visual-demo-grid">
          {displayed.map((exercise) => {
            const demo = getBuiltInExerciseDemo(exercise.slug);
            return (
              <article className="visual-demo-card" key={exercise.id}>
                <button type="button" onClick={() => setSelectedExercise(exercise)} aria-label={`Open ${exercise.name} technique demo`}>
                  <ExerciseTechniqueMedia exercise={exercise} />
                </button>
                <div>
                  <span>{exercise.primary_muscle_group}</span>
                  <h3>{exercise.name}</h3>
                  <p>{demo?.direction}</p>
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
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');

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
        (item): item is { sessionExercise: typeof item.sessionExercise; exercise: Exercise } =>
          Boolean(item.exercise && getBuiltInExerciseDemo(item.exercise.slug)),
      );
  }, [active.session, exerciseById]);

  if (!active.session || available.length === 0) return null;

  const nextIncomplete = active.session.exercises.find((exercise) =>
    exercise.sets.some((set) => !set.is_completed),
  );
  const preferredId = selectedId || nextIncomplete?.exercise_id || available[0]?.exercise.id || '';
  const current = available.find((item) => item.exercise.id === preferredId) ?? available[0];
  if (!current) return null;

  return (
    <>
      <aside className="active-technique-dock" aria-labelledby="active-technique-dock-heading">
        <div className="active-technique-dock-copy">
          <span className="overview-kicker">Form check</span>
          <h3 id="active-technique-dock-heading">{current.exercise.name}</h3>
          <p>{getBuiltInExerciseDemo(current.exercise.slug)?.cue}</p>
        </div>
        <div className="active-technique-dock-preview">
          <ExerciseTechniqueMedia exercise={current.exercise} />
        </div>
        <div className="active-technique-dock-actions">
          {available.length > 1 ? (
            <label>
              <span>Exercise demo</span>
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
