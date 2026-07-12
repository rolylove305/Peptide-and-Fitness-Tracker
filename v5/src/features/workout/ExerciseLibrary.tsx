import { useMemo, useState } from 'react';
import type { Exercise } from '../../types/database';
import { useExerciseLibrary } from './hooks/useExerciseLibrary';

const allOption = 'all';

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function ExerciseMedia({ exercise }: { exercise: Exercise }) {
  if (exercise.media_url) {
    return (
      <img
        className="exercise-media-image"
        src={exercise.media_url}
        alt={`${exercise.name} demonstration`}
        loading="lazy"
      />
    );
  }

  return (
    <div className="exercise-media-placeholder" aria-label="Exercise demonstration coming soon">
      <span aria-hidden="true">{exercise.primary_muscle_group.slice(0, 1)}</span>
      <small>Demo coming next</small>
    </div>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  return (
    <article className="exercise-card">
      <ExerciseMedia exercise={exercise} />
      <div className="exercise-card-body">
        <div className="exercise-card-heading">
          <div>
            <p className="exercise-muscle">{exercise.primary_muscle_group}</p>
            <h3>{exercise.name}</h3>
          </div>
          <span className="difficulty-chip">{exercise.difficulty}</span>
        </div>

        <div className="exercise-tags" aria-label="Equipment">
          {exercise.equipment.length > 0 ? (
            exercise.equipment.map((item) => <span key={item}>{item}</span>)
          ) : (
            <span>No equipment</span>
          )}
        </div>

        <details className="exercise-details">
          <summary>View instructions</summary>
          <ol>
            {exercise.instructions.map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ol>
          {exercise.secondary_muscle_groups.length > 0 ? (
            <p>
              Also trains: <strong>{exercise.secondary_muscle_groups.join(', ')}</strong>
            </p>
          ) : null}
        </details>
      </div>
    </article>
  );
}

function ExerciseSkeletons() {
  return (
    <div className="exercise-grid" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="exercise-card exercise-card--loading" key={index}>
          <div className="exercise-skeleton exercise-skeleton--media" />
          <div className="exercise-card-body">
            <div className="exercise-skeleton exercise-skeleton--line" />
            <div className="exercise-skeleton exercise-skeleton--title" />
            <div className="exercise-skeleton exercise-skeleton--line" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExerciseLibrary() {
  const { status, exercises, error, refresh } = useExerciseLibrary();
  const [search, setSearch] = useState('');
  const [muscleGroup, setMuscleGroup] = useState(allOption);
  const [equipment, setEquipment] = useState(allOption);

  const muscleGroups = useMemo(
    () =>
      Array.from(new Set(exercises.map((exercise) => exercise.primary_muscle_group))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [exercises],
  );

  const equipmentOptions = useMemo(
    () =>
      Array.from(new Set(exercises.flatMap((exercise) => exercise.equipment))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [exercises],
  );

  const filteredExercises = useMemo(() => {
    const searchTerm = normalize(search);

    return exercises.filter((exercise) => {
      const matchesSearch =
        searchTerm.length === 0 ||
        normalize(exercise.name).includes(searchTerm) ||
        normalize(exercise.primary_muscle_group).includes(searchTerm) ||
        exercise.secondary_muscle_groups.some((item) => normalize(item).includes(searchTerm)) ||
        exercise.equipment.some((item) => normalize(item).includes(searchTerm));
      const matchesMuscle =
        muscleGroup === allOption || exercise.primary_muscle_group === muscleGroup;
      const matchesEquipment =
        equipment === allOption || exercise.equipment.includes(equipment);

      return matchesSearch && matchesMuscle && matchesEquipment;
    });
  }, [equipment, exercises, muscleGroup, search]);

  return (
    <section className="exercise-library" aria-labelledby="exercise-library-heading">
      <div className="section-heading exercise-library-heading">
        <div>
          <p className="eyebrow">Workout AI</p>
          <h2 id="exercise-library-heading">Exercise library</h2>
          <p>
            Search the structured library before building routines and recording your first workout.
          </p>
        </div>
        <span className="library-count" aria-live="polite">
          {status === 'ready' ? `${filteredExercises.length} of ${exercises.length}` : 'Loading'}
        </span>
      </div>

      <div className="exercise-filters" aria-label="Exercise filters">
        <label className="exercise-search">
          <span>Search</span>
          <input
            type="search"
            value={search}
            placeholder="Exercise, muscle or equipment"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label>
          <span>Muscle group</span>
          <select value={muscleGroup} onChange={(event) => setMuscleGroup(event.target.value)}>
            <option value={allOption}>All muscle groups</option>
            {muscleGroups.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Equipment</span>
          <select value={equipment} onChange={(event) => setEquipment(event.target.value)}>
            <option value={allOption}>All equipment</option>
            {equipmentOptions.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {status === 'loading' ? <ExerciseSkeletons /> : null}

      {status === 'error' ? (
        <div className="exercise-state-card" role="alert">
          <h3>Exercise library unavailable</h3>
          <p>{error ?? 'Please check your connection and try again.'}</p>
          <button className="secondary-button" type="button" onClick={refresh}>
            Try again
          </button>
        </div>
      ) : null}

      {status === 'empty' ? (
        <div className="exercise-state-card">
          <h3>No exercises yet</h3>
          <p>The database is connected, but the shared exercise library has not been seeded.</p>
        </div>
      ) : null}

      {status === 'ready' && filteredExercises.length === 0 ? (
        <div className="exercise-state-card">
          <h3>No matching exercises</h3>
          <p>Clear one of the filters or try a broader search.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setSearch('');
              setMuscleGroup(allOption);
              setEquipment(allOption);
            }}
          >
            Clear filters
          </button>
        </div>
      ) : null}

      {status === 'ready' && filteredExercises.length > 0 ? (
        <div className="exercise-grid">
          {filteredExercises.map((exercise) => (
            <ExerciseCard exercise={exercise} key={exercise.id} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
