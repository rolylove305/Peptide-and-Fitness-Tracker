import { useEffect, useMemo, useState } from 'react';
import type { Exercise } from '../../types/database';
import { useExerciseLibrary } from './hooks/useExerciseLibrary';

const allOption = 'all';
const favoritesStorageKey = 'biotrack-v5-exercise-favorites';

type SortOption = 'name' | 'muscle' | 'difficulty';
type DifficultyFilter = typeof allOption | Exercise['difficulty'];

const difficultyOrder: Record<Exercise['difficulty'], number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function readFavoriteIds(): string[] {
  try {
    const saved = window.localStorage.getItem(favoritesStorageKey);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function ExerciseMedia({ exercise, expanded = false }: { exercise: Exercise; expanded?: boolean }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [exercise.id, exercise.media_url]);

  if (exercise.media_url && !failed) {
    if (exercise.media_type === 'video') {
      return (
        <video
          className={expanded ? 'exercise-media-image exercise-media-image--expanded' : 'exercise-media-image'}
          src={exercise.media_url}
          controls
          playsInline
          preload="metadata"
          aria-label={`${exercise.name} demonstration`}
          onError={() => setFailed(true)}
        />
      );
    }

    return (
      <img
        className={expanded ? 'exercise-media-image exercise-media-image--expanded' : 'exercise-media-image'}
        src={exercise.media_url}
        alt={`${exercise.name} demonstration`}
        loading={expanded ? 'eager' : 'lazy'}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={expanded ? 'exercise-media-placeholder exercise-media-placeholder--expanded' : 'exercise-media-placeholder'}
      aria-label="Exercise demonstration not yet available"
    >
      <span aria-hidden="true">{exercise.primary_muscle_group.slice(0, 1)}</span>
      <small>Technique guide</small>
    </div>
  );
}

function getSubstitutions(exercise: Exercise, exercises: Exercise[]): Exercise[] {
  const targetEquipment = new Set(exercise.equipment);
  const targetSecondary = new Set(exercise.secondary_muscle_groups);

  return exercises
    .filter(
      (candidate) =>
        candidate.id !== exercise.id && candidate.primary_muscle_group === exercise.primary_muscle_group,
    )
    .map((candidate) => {
      const sharedEquipment = candidate.equipment.filter((item) => targetEquipment.has(item)).length;
      const sharedSecondary = candidate.secondary_muscle_groups.filter((item) => targetSecondary.has(item)).length;
      const difficultyDistance = Math.abs(
        difficultyOrder[candidate.difficulty] - difficultyOrder[exercise.difficulty],
      );
      const score = sharedEquipment * 5 + sharedSecondary * 2 + (2 - Math.min(2, difficultyDistance));
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name))
    .slice(0, 4)
    .map(({ candidate }) => candidate);
}

type ExerciseCardProps = {
  exercise: Exercise;
  favorite: boolean;
  onToggleFavorite: (exerciseId: string) => void;
  onOpen: (exercise: Exercise) => void;
};

function ExerciseCard({ exercise, favorite, onToggleFavorite, onOpen }: ExerciseCardProps) {
  const firstInstruction = exercise.instructions[0] ?? 'Open the guide for setup and technique cues.';

  return (
    <article className="exercise-card exercise-card--interactive">
      <div className="exercise-media-wrap">
        <ExerciseMedia exercise={exercise} />
        <span className={exercise.media_url ? 'exercise-media-status exercise-media-status--ready' : 'exercise-media-status'}>
          {exercise.media_url ? 'Demo available' : 'Guide available'}
        </span>
        <button
          className={favorite ? 'exercise-favorite-button exercise-favorite-button--active' : 'exercise-favorite-button'}
          type="button"
          aria-label={favorite ? `Remove ${exercise.name} from favorites` : `Add ${exercise.name} to favorites`}
          aria-pressed={favorite}
          onClick={() => onToggleFavorite(exercise.id)}
        >
          <span aria-hidden="true">{favorite ? '★' : '☆'}</span>
        </button>
      </div>

      <div className="exercise-card-body">
        <div className="exercise-card-heading">
          <div>
            <p className="exercise-muscle">{exercise.primary_muscle_group}</p>
            <h3>{exercise.name}</h3>
          </div>
          <span className="difficulty-chip">{exercise.difficulty}</span>
        </div>

        <p className="exercise-card-summary">{firstInstruction}</p>

        <div className="exercise-tags" aria-label="Equipment">
          {exercise.equipment.length > 0 ? (
            exercise.equipment.slice(0, 3).map((item) => <span key={item}>{item}</span>)
          ) : (
            <span>No equipment</span>
          )}
          {exercise.equipment.length > 3 ? <span>+{exercise.equipment.length - 3}</span> : null}
        </div>

        <button className="exercise-guide-button" type="button" onClick={() => onOpen(exercise)}>
          Open exercise guide
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}

function ExerciseGuide({
  exercise,
  exercises,
  favorite,
  onClose,
  onSelect,
  onToggleFavorite,
}: {
  exercise: Exercise;
  exercises: Exercise[];
  favorite: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  onToggleFavorite: (exerciseId: string) => void;
}) {
  const substitutions = useMemo(() => getSubstitutions(exercise, exercises), [exercise, exercises]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="exercise-guide-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="exercise-guide-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-guide-title"
      >
        <header className="exercise-guide-header">
          <div>
            <p className="exercise-muscle">{exercise.primary_muscle_group}</p>
            <h2 id="exercise-guide-title">{exercise.name}</h2>
          </div>
          <div className="exercise-guide-header-actions">
            <button
              className={favorite ? 'exercise-favorite-button exercise-favorite-button--active' : 'exercise-favorite-button'}
              type="button"
              aria-label={favorite ? `Remove ${exercise.name} from favorites` : `Add ${exercise.name} to favorites`}
              aria-pressed={favorite}
              onClick={() => onToggleFavorite(exercise.id)}
            >
              <span aria-hidden="true">{favorite ? '★' : '☆'}</span>
            </button>
            <button className="exercise-guide-close" type="button" aria-label="Close exercise guide" onClick={onClose}>
              ×
            </button>
          </div>
        </header>

        <div className="exercise-guide-scroll">
          <div className="exercise-guide-media">
            <ExerciseMedia exercise={exercise} expanded />
          </div>

          <div className="exercise-guide-meta" aria-label="Exercise details">
            <span><strong>Level</strong>{exercise.difficulty}</span>
            <span><strong>Primary</strong>{exercise.primary_muscle_group}</span>
            <span><strong>Equipment</strong>{exercise.equipment.join(', ') || 'None'}</span>
          </div>

          <div className="exercise-guide-layout">
            <article className="exercise-guide-section">
              <span className="overview-kicker">Technique</span>
              <h3>Step-by-step instructions</h3>
              {exercise.instructions.length > 0 ? (
                <ol className="exercise-guide-steps">
                  {exercise.instructions.map((instruction, index) => (
                    <li key={`${exercise.id}-${index}`}>
                      <span aria-hidden="true">{index + 1}</span>
                      <p>{instruction}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>Detailed instructions are being prepared for this exercise.</p>
              )}
            </article>

            <aside className="exercise-guide-section exercise-guide-section--support">
              <span className="overview-kicker">Training focus</span>
              <h3>Muscles and setup</h3>
              <dl className="exercise-guide-list">
                <div><dt>Primary muscle</dt><dd>{exercise.primary_muscle_group}</dd></div>
                <div>
                  <dt>Also trains</dt>
                  <dd>{exercise.secondary_muscle_groups.join(', ') || 'No secondary muscles listed'}</dd>
                </div>
                <div><dt>Equipment</dt><dd>{exercise.equipment.join(', ') || 'Bodyweight'}</dd></div>
                <div><dt>Difficulty</dt><dd>{exercise.difficulty}</dd></div>
              </dl>
              <p className="exercise-safety-note">
                Use a controlled range of motion and stop if you feel sharp pain. Adjust the load or choose a substitute when needed.
              </p>
            </aside>
          </div>

          <section className="exercise-substitution-section" aria-labelledby="substitution-heading">
            <div className="exercise-guide-section-heading">
              <div>
                <span className="overview-kicker">Exercise swap</span>
                <h3 id="substitution-heading">Compatible substitutions</h3>
              </div>
              <p>Same primary muscle, ranked by similar equipment and difficulty.</p>
            </div>

            {substitutions.length > 0 ? (
              <div className="exercise-substitution-grid">
                {substitutions.map((candidate) => (
                  <button type="button" key={candidate.id} onClick={() => onSelect(candidate)}>
                    <span>{candidate.primary_muscle_group}</span>
                    <strong>{candidate.name}</strong>
                    <small>{candidate.equipment.join(' · ') || 'Bodyweight'} · {candidate.difficulty}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="exercise-substitution-empty">No close substitutes are available in the current library.</p>
            )}
          </section>
        </div>
      </section>
    </div>
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
  const [difficulty, setDifficulty] = useState<DifficultyFilter>(allOption);
  const [sort, setSort] = useState<SortOption>('name');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyWithMedia, setOnlyWithMedia] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readFavoriteIds());
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    window.localStorage.setItem(favoritesStorageKey, JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

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

    return exercises
      .filter((exercise) => {
        const matchesSearch =
          searchTerm.length === 0 ||
          normalize(exercise.name).includes(searchTerm) ||
          normalize(exercise.primary_muscle_group).includes(searchTerm) ||
          exercise.secondary_muscle_groups.some((item) => normalize(item).includes(searchTerm)) ||
          exercise.equipment.some((item) => normalize(item).includes(searchTerm)) ||
          exercise.instructions.some((item) => normalize(item).includes(searchTerm));
        const matchesMuscle = muscleGroup === allOption || exercise.primary_muscle_group === muscleGroup;
        const matchesEquipment = equipment === allOption || exercise.equipment.includes(equipment);
        const matchesDifficulty = difficulty === allOption || exercise.difficulty === difficulty;
        const matchesFavorites = !onlyFavorites || favoriteSet.has(exercise.id);
        const matchesMedia = !onlyWithMedia || Boolean(exercise.media_url);

        return matchesSearch && matchesMuscle && matchesEquipment && matchesDifficulty && matchesFavorites && matchesMedia;
      })
      .sort((a, b) => {
        if (sort === 'muscle') {
          return a.primary_muscle_group.localeCompare(b.primary_muscle_group) || a.name.localeCompare(b.name);
        }
        if (sort === 'difficulty') {
          return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty] || a.name.localeCompare(b.name);
        }
        return a.name.localeCompare(b.name);
      });
  }, [difficulty, equipment, exercises, favoriteSet, muscleGroup, onlyFavorites, onlyWithMedia, search, sort]);

  const activeFilterCount = [
    search.trim().length > 0,
    muscleGroup !== allOption,
    equipment !== allOption,
    difficulty !== allOption,
    onlyFavorites,
    onlyWithMedia,
  ].filter(Boolean).length;

  function toggleFavorite(exerciseId: string) {
    setFavoriteIds((current) =>
      current.includes(exerciseId)
        ? current.filter((id) => id !== exerciseId)
        : [...current, exerciseId],
    );
  }

  function clearFilters() {
    setSearch('');
    setMuscleGroup(allOption);
    setEquipment(allOption);
    setDifficulty(allOption);
    setOnlyFavorites(false);
    setOnlyWithMedia(false);
    setSort('name');
  }

  return (
    <section className="exercise-library" aria-labelledby="exercise-library-heading">
      <div className="section-heading exercise-library-heading">
        <div>
          <p className="eyebrow">Workout AI</p>
          <h2 id="exercise-library-heading">Exercise library</h2>
          <p>Find an exercise, review technique and compare compatible substitutions before training.</p>
        </div>
        <span className="library-count" aria-live="polite">
          {status === 'ready' ? `${filteredExercises.length} of ${exercises.length}` : 'Loading'}
        </span>
      </div>

      <div className="exercise-filters exercise-filters--advanced" aria-label="Exercise filters">
        <label className="exercise-search">
          <span>Search</span>
          <input
            type="search"
            value={search}
            placeholder="Exercise, muscle, cue or equipment"
            autoComplete="off"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label>
          <span>Muscle group</span>
          <select value={muscleGroup} onChange={(event) => setMuscleGroup(event.target.value)}>
            <option value={allOption}>All muscle groups</option>
            {muscleGroups.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </label>

        <label>
          <span>Equipment</span>
          <select value={equipment} onChange={(event) => setEquipment(event.target.value)}>
            <option value={allOption}>All equipment</option>
            {equipmentOptions.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </label>

        <label>
          <span>Difficulty</span>
          <select
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as DifficultyFilter)}
          >
            <option value={allOption}>All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>

        <label>
          <span>Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
            <option value="name">Name</option>
            <option value="muscle">Muscle group</option>
            <option value="difficulty">Beginner first</option>
          </select>
        </label>
      </div>

      <div className="exercise-library-toolbar">
        <div className="exercise-filter-toggles">
          <button
            className={onlyFavorites ? 'exercise-toggle-button exercise-toggle-button--active' : 'exercise-toggle-button'}
            type="button"
            aria-pressed={onlyFavorites}
            onClick={() => setOnlyFavorites((current) => !current)}
          >
            <span aria-hidden="true">★</span> Favorites
            {favoriteIds.length > 0 ? <small>{favoriteIds.length}</small> : null}
          </button>
          <button
            className={onlyWithMedia ? 'exercise-toggle-button exercise-toggle-button--active' : 'exercise-toggle-button'}
            type="button"
            aria-pressed={onlyWithMedia}
            onClick={() => setOnlyWithMedia((current) => !current)}
          >
            <span aria-hidden="true">▶</span> Demo available
          </button>
        </div>
        {activeFilterCount > 0 ? (
          <button className="exercise-clear-button" type="button" onClick={clearFilters}>
            Clear {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'}
          </button>
        ) : null}
      </div>

      {status === 'loading' ? <ExerciseSkeletons /> : null}

      {status === 'error' ? (
        <div className="exercise-state-card" role="alert">
          <h3>Exercise library unavailable</h3>
          <p>{error ?? 'Please check your connection and try again.'}</p>
          <button className="secondary-button" type="button" onClick={refresh}>Try again</button>
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
          <p>Clear a filter, remove the favorites-only option or try a broader search.</p>
          <button className="secondary-button" type="button" onClick={clearFilters}>Clear filters</button>
        </div>
      ) : null}

      {status === 'ready' && filteredExercises.length > 0 ? (
        <div className="exercise-grid">
          {filteredExercises.map((exercise) => (
            <ExerciseCard
              exercise={exercise}
              favorite={favoriteSet.has(exercise.id)}
              onToggleFavorite={toggleFavorite}
              onOpen={setSelectedExercise}
              key={exercise.id}
            />
          ))}
        </div>
      ) : null}

      {selectedExercise ? (
        <ExerciseGuide
          exercise={selectedExercise}
          exercises={exercises}
          favorite={favoriteSet.has(selectedExercise.id)}
          onClose={() => setSelectedExercise(null)}
          onSelect={(exercise) => {
            setSelectedExercise(exercise);
            document.querySelector('.exercise-guide-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onToggleFavorite={toggleFavorite}
        />
      ) : null}
    </section>
  );
}
