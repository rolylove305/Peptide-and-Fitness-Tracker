import { useMemo, useState } from 'react';
import type { Exercise } from '../../types/database';
import { useAuth } from '../auth/AuthProvider';
import { useExerciseLibrary } from './hooks/useExerciseLibrary';
import { useRoutines } from './hooks/useRoutines';
import type {
  RoutineDayDraft,
  RoutineDraft,
  RoutineExerciseDraft,
  RoutineTree,
  WeightUnit,
} from './repositories/routineRepository';

function localId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function newExercise(weightUnit: WeightUnit = 'lb'): RoutineExerciseDraft {
  return {
    localId: localId(),
    exercise_id: '',
    target_sets: 3,
    target_reps_min: 8,
    target_reps_max: 12,
    target_rest_seconds: 90,
    target_weight: null,
    weight_unit: weightUnit,
    tempo: '',
    notes: '',
  };
}

function cloneExercise(exercise: RoutineExerciseDraft): RoutineExerciseDraft {
  return { ...exercise, localId: localId() };
}

function newDay(order: number): RoutineDayDraft {
  return {
    localId: localId(),
    name: `Day ${order}`,
    focus: '',
    focus_muscle_groups: [],
    exercises: [newExercise()],
  };
}

function cloneDay(day: RoutineDayDraft): RoutineDayDraft {
  return {
    ...day,
    localId: localId(),
    name: `${day.name.trim() || 'Workout day'} Copy`,
    exercises: day.exercises.map(cloneExercise),
  };
}

function blankRoutine(): RoutineDraft {
  return {
    name: '',
    description: '',
    goal: 'Build strength and consistency',
    difficulty: 'beginner',
    days: [newDay(1)],
  };
}

function routineToDraft(routine: RoutineTree): RoutineDraft {
  return {
    name: routine.name,
    description: routine.description ?? '',
    goal: routine.goal ?? '',
    difficulty: routine.difficulty,
    days: routine.days.map((day) => ({
      localId: localId(),
      name: day.name,
      focus: day.focus ?? '',
      focus_muscle_groups: day.focus_muscle_groups,
      exercises: day.exercises.map((exercise) => ({
        localId: localId(),
        exercise_id: exercise.exercise_id,
        target_sets: exercise.target_sets,
        target_reps_min: exercise.target_reps_min ?? 8,
        target_reps_max:
          exercise.target_reps_max ?? exercise.target_reps_min ?? 12,
        target_rest_seconds: exercise.target_rest_seconds,
        target_weight: exercise.target_weight,
        weight_unit: exercise.weight_unit,
        tempo: exercise.tempo ?? '',
        notes: exercise.notes ?? '',
      })),
    })),
  };
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return items;
  next.splice(toIndex, 0, moved);
  return next;
}

function substitutionScore(current: Exercise, candidate: Exercise): number {
  let score = 0;
  if (candidate.primary_muscle_group === current.primary_muscle_group)
    score += 12;
  if (candidate.secondary_muscle_groups.includes(current.primary_muscle_group))
    score += 3;
  if (current.secondary_muscle_groups.includes(candidate.primary_muscle_group))
    score += 2;
  const sharedEquipment = candidate.equipment.filter((item) =>
    current.equipment.includes(item),
  ).length;
  score += sharedEquipment * 4;
  if (candidate.difficulty === current.difficulty) score += 2;
  return score;
}

function validateRoutine(draft: RoutineDraft): string | null {
  if (draft.name.trim().length < 2)
    return 'Give the routine a name with at least 2 characters.';
  if (draft.days.length === 0) return 'Add at least one workout day.';

  for (const [dayIndex, day] of draft.days.entries()) {
    if (day.name.trim().length < 2) return `Day ${dayIndex + 1} needs a name.`;
    if (day.exercises.length === 0)
      return `${day.name} needs at least one exercise.`;

    for (const [exerciseIndex, exercise] of day.exercises.entries()) {
      if (!exercise.exercise_id)
        return `Choose exercise ${exerciseIndex + 1} for ${day.name}.`;
      if (exercise.target_sets < 1 || exercise.target_sets > 20) {
        return `${day.name}: sets must be between 1 and 20.`;
      }
      if (exercise.target_reps_min < 1 || exercise.target_reps_max < 1) {
        return `${day.name}: repetitions must be at least 1.`;
      }
      if (exercise.target_reps_max < exercise.target_reps_min) {
        return `${day.name}: maximum repetitions cannot be lower than minimum repetitions.`;
      }
      if (
        exercise.target_rest_seconds < 0 ||
        exercise.target_rest_seconds > 3600
      ) {
        return `${day.name}: rest must be between 0 and 3600 seconds.`;
      }
      if (
        exercise.target_weight !== null &&
        (!Number.isFinite(exercise.target_weight) || exercise.target_weight < 0)
      ) {
        return `${day.name}: target weight must be empty or a non-negative number.`;
      }
      if (exercise.weight_unit !== 'lb' && exercise.weight_unit !== 'kg') {
        return `${day.name}: choose pounds or kilograms.`;
      }
    }
  }

  return null;
}

export function RoutineBuilder() {
  const { user } = useAuth();
  const exerciseLibrary = useExerciseLibrary();
  const routineState = useRoutines(user?.id);
  const [draft, setDraft] = useState<RoutineDraft>(() => blankRoutine());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const exerciseById = useMemo(
    () =>
      new Map(
        exerciseLibrary.exercises.map((exercise) => [exercise.id, exercise]),
      ),
    [exerciseLibrary.exercises],
  );

  const groupedExercises = useMemo(() => {
    const groups = new Map<string, Exercise[]>();
    for (const exercise of exerciseLibrary.exercises) {
      const current = groups.get(exercise.primary_muscle_group) ?? [];
      current.push(exercise);
      groups.set(exercise.primary_muscle_group, current);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([group, exercises]) =>
          [
            group,
            [...exercises].sort((a, b) => a.name.localeCompare(b.name)),
          ] as const,
      );
  }, [exerciseLibrary.exercises]);

  function compatibleSubstitutions(exerciseId: string): Exercise[] {
    const selected = exerciseById.get(exerciseId);
    if (!selected) return [];
    return exerciseLibrary.exercises
      .filter((candidate) => candidate.id !== selected.id)
      .map((candidate) => ({
        candidate,
        score: substitutionScore(selected, candidate),
      }))
      .filter(({ score }) => score > 0)
      .sort(
        (a, b) =>
          b.score - a.score || a.candidate.name.localeCompare(b.candidate.name),
      )
      .slice(0, 8)
      .map(({ candidate }) => candidate);
  }

  function resetBuilder() {
    setEditingId(null);
    setDraft(blankRoutine());
    setMessage(null);
    setLocalError(null);
  }

  function updateDay(dayId: string, changes: Partial<RoutineDayDraft>) {
    setDraft((current) => ({
      ...current,
      days: current.days.map((day) =>
        day.localId === dayId ? { ...day, ...changes } : day,
      ),
    }));
  }

  function updateExercise(
    dayId: string,
    exerciseId: string,
    changes: Partial<RoutineExerciseDraft>,
  ) {
    setDraft((current) => ({
      ...current,
      days: current.days.map((day) =>
        day.localId === dayId
          ? {
              ...day,
              exercises: day.exercises.map((exercise) =>
                exercise.localId === exerciseId
                  ? { ...exercise, ...changes }
                  : exercise,
              ),
            }
          : day,
      ),
    }));
  }

  function addDay() {
    setDraft((current) => ({
      ...current,
      days: [...current.days, newDay(current.days.length + 1)],
    }));
    setMessage('Workout day added. Save the routine when you are finished.');
  }

  function duplicateDay(dayId: string) {
    setDraft((current) => {
      const index = current.days.findIndex((day) => day.localId === dayId);
      const sourceDay = current.days[index];
      if (index < 0 || !sourceDay) return current;
      const nextDays = [...current.days];
      nextDays.splice(index + 1, 0, cloneDay(sourceDay));
      return { ...current, days: nextDays };
    });
    setMessage('Day duplicated with the same exercise targets.');
  }

  function moveDay(dayId: string, direction: -1 | 1) {
    setDraft((current) => {
      const index = current.days.findIndex((day) => day.localId === dayId);
      return {
        ...current,
        days: moveItem(current.days, index, index + direction),
      };
    });
  }

  function removeDay(dayId: string) {
    setDraft((current) => ({
      ...current,
      days: current.days.filter((day) => day.localId !== dayId),
    }));
  }

  function addExercise(dayId: string) {
    setDraft((current) => ({
      ...current,
      days: current.days.map((day) => {
        if (day.localId !== dayId) return day;
        const inheritedUnit = day.exercises.at(-1)?.weight_unit ?? 'lb';
        return {
          ...day,
          exercises: [...day.exercises, newExercise(inheritedUnit)],
        };
      }),
    }));
  }

  function duplicateExercise(dayId: string, exerciseId: string) {
    setDraft((current) => ({
      ...current,
      days: current.days.map((day) => {
        if (day.localId !== dayId) return day;
        const index = day.exercises.findIndex(
          (exercise) => exercise.localId === exerciseId,
        );
        const sourceExercise = day.exercises[index];
        if (index < 0 || !sourceExercise) return day;
        const exercises = [...day.exercises];
        exercises.splice(index + 1, 0, cloneExercise(sourceExercise));
        return { ...day, exercises };
      }),
    }));
  }

  function moveExercise(dayId: string, exerciseId: string, direction: -1 | 1) {
    setDraft((current) => ({
      ...current,
      days: current.days.map((day) => {
        if (day.localId !== dayId) return day;
        const index = day.exercises.findIndex(
          (exercise) => exercise.localId === exerciseId,
        );
        return {
          ...day,
          exercises: moveItem(day.exercises, index, index + direction),
        };
      }),
    }));
  }

  function removeExercise(dayId: string, exerciseId: string) {
    setDraft((current) => ({
      ...current,
      days: current.days.map((day) =>
        day.localId === dayId
          ? {
              ...day,
              exercises: day.exercises.filter(
                (exercise) => exercise.localId !== exerciseId,
              ),
            }
          : day,
      ),
    }));
  }

  async function handleSave() {
    setMessage(null);
    setLocalError(null);

    const validationError = validateRoutine(draft);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    const normalizedDraft: RoutineDraft = {
      ...draft,
      days: draft.days.map((day) => ({
        ...day,
        focus_muscle_groups: Array.from(
          new Set(
            day.exercises
              .map(
                (exercise) =>
                  exerciseById.get(exercise.exercise_id)?.primary_muscle_group,
              )
              .filter((group): group is string => Boolean(group)),
          ),
        ),
      })),
    };

    const result = await routineState.save(normalizedDraft, editingId);
    if (!result.ok) {
      setLocalError(result.error);
      return;
    }

    setEditingId(result.data);
    setMessage(
      editingId
        ? 'Routine updated successfully.'
        : 'Routine saved successfully.',
    );
  }

  function editRoutine(routine: RoutineTree) {
    setEditingId(routine.id);
    setDraft(routineToDraft(routine));
    setMessage(`Editing ${routine.name}`);
    setLocalError(null);
    document
      .getElementById('routine-editor-heading')
      ?.scrollIntoView({ behavior: 'smooth' });
  }

  function duplicateRoutine(routine: RoutineTree) {
    const copied = routineToDraft(routine);
    setEditingId(null);
    setDraft({ ...copied, name: `${routine.name} Copy` });
    setMessage('Routine copied into a new unsaved plan.');
    setLocalError(null);
    document
      .getElementById('routine-editor-heading')
      ?.scrollIntoView({ behavior: 'smooth' });
  }

  async function deleteRoutine(routine: RoutineTree) {
    const confirmed = window.confirm(
      `Delete “${routine.name}” and all of its workout days?`,
    );
    if (!confirmed) return;

    const result = await routineState.remove(routine.id);
    if (!result.ok) {
      setLocalError(result.error);
      return;
    }

    if (editingId === routine.id) resetBuilder();
    setMessage('Routine deleted.');
  }

  return (
    <section
      className="routine-builder"
      aria-labelledby="routine-builder-heading"
    >
      <div className="section-heading routine-builder-heading">
        <div>
          <p className="eyebrow">Workout AI</p>
          <h2 id="routine-builder-heading">Routine builder</h2>
          <p>
            Build, reorder and adapt training days without losing the targets
            that power future workouts.
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={resetBuilder}
        >
          New routine
        </button>
      </div>

      <div className="routine-layout">
        <div className="routine-editor-card">
          <div className="routine-editor-title">
            <div>
              <span className="status-chip">
                {editingId ? 'Editing' : 'New'}
              </span>
              <h3 id="routine-editor-heading">
                {editingId ? 'Edit routine' : 'Build a routine'}
              </h3>
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={
                routineState.saving || exerciseLibrary.status !== 'ready'
              }
              onClick={() => void handleSave()}
            >
              {routineState.saving
                ? 'Saving…'
                : editingId
                  ? 'Update routine'
                  : 'Save routine'}
            </button>
          </div>

          {message ? (
            <p className="builder-message builder-message--success">
              {message}
            </p>
          ) : null}
          {localError || routineState.error ? (
            <p className="builder-message builder-message--error" role="alert">
              {localError ?? routineState.error}
            </p>
          ) : null}

          <div className="routine-basics-grid">
            <label className="field field--wide">
              <span>Routine name</span>
              <input
                value={draft.name}
                placeholder="Example: 3-Day Strength Plan"
                maxLength={120}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Difficulty</span>
              <select
                value={draft.difficulty}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    difficulty: event.target
                      .value as RoutineDraft['difficulty'],
                  }))
                }
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <label className="field field--wide">
              <span>Goal</span>
              <input
                value={draft.goal}
                placeholder="Strength, muscle, conditioning…"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    goal: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field field--full">
              <span>Description</span>
              <textarea
                rows={2}
                value={draft.description}
                placeholder="Optional notes about the plan"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <div className="routine-days">
            {draft.days.map((day, dayIndex) => (
              <article className="routine-day-card" key={day.localId}>
                <div className="routine-day-heading routine-day-heading--managed">
                  <span className="day-number">{dayIndex + 1}</span>
                  <div className="routine-day-title-copy">
                    <p>Training day</p>
                    <h3>{day.name.trim() || `Day ${dayIndex + 1}`}</h3>
                  </div>
                  <div
                    className="day-command-bar"
                    aria-label={`Controls for ${day.name}`}
                  >
                    <button
                      type="button"
                      disabled={dayIndex === 0}
                      onClick={() => moveDay(day.localId, -1)}
                      aria-label="Move day earlier"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={dayIndex === draft.days.length - 1}
                      onClick={() => moveDay(day.localId, 1)}
                      aria-label="Move day later"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateDay(day.localId)}
                    >
                      Duplicate
                    </button>
                    <button
                      className="day-command-danger"
                      type="button"
                      disabled={draft.days.length === 1}
                      onClick={() => removeDay(day.localId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="day-fields">
                  <label className="field">
                    <span>Day name</span>
                    <input
                      value={day.name}
                      placeholder="Upper body"
                      onChange={(event) =>
                        updateDay(day.localId, { name: event.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Focus</span>
                    <input
                      value={day.focus}
                      placeholder="Chest, shoulders and triceps"
                      onChange={(event) =>
                        updateDay(day.localId, { focus: event.target.value })
                      }
                    />
                  </label>
                </div>

                <div className="routine-exercise-list">
                  {day.exercises.map((exercise, exerciseIndex) => {
                    const selectedExercise = exerciseById.get(
                      exercise.exercise_id,
                    );
                    const recommended = compatibleSubstitutions(
                      exercise.exercise_id,
                    );
                    const recommendedIds = new Set(
                      recommended.map((item) => item.id),
                    );
                    const otherExercises = exerciseLibrary.exercises.filter(
                      (item) =>
                        item.id !== exercise.exercise_id &&
                        !recommendedIds.has(item.id),
                    );

                    return (
                      <div
                        className="routine-exercise-row routine-exercise-row--managed"
                        key={exercise.localId}
                      >
                        <div className="exercise-row-number">
                          {exerciseIndex + 1}
                        </div>
                        <div className="exercise-row-main">
                          <div
                            className="exercise-row-toolbar"
                            aria-label={`Controls for exercise ${exerciseIndex + 1}`}
                          >
                            <button
                              type="button"
                              disabled={exerciseIndex === 0}
                              onClick={() =>
                                moveExercise(day.localId, exercise.localId, -1)
                              }
                              aria-label="Move exercise up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={
                                exerciseIndex === day.exercises.length - 1
                              }
                              onClick={() =>
                                moveExercise(day.localId, exercise.localId, 1)
                              }
                              aria-label="Move exercise down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                duplicateExercise(day.localId, exercise.localId)
                              }
                            >
                              Duplicate
                            </button>
                            <button
                              className="exercise-row-remove"
                              type="button"
                              disabled={day.exercises.length === 1}
                              onClick={() =>
                                removeExercise(day.localId, exercise.localId)
                              }
                            >
                              Remove
                            </button>
                          </div>

                          <label className="field field--full">
                            <span>Exercise</span>
                            <select
                              value={exercise.exercise_id}
                              onChange={(event) =>
                                updateExercise(day.localId, exercise.localId, {
                                  exercise_id: event.target.value,
                                })
                              }
                            >
                              <option value="">Select an exercise</option>
                              {groupedExercises.map(([group, exercises]) => (
                                <optgroup label={group} key={group}>
                                  {exercises.map((item) => (
                                    <option value={item.id} key={item.id}>
                                      {item.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </label>

                          {selectedExercise ? (
                            <>
                              <p className="selected-exercise-meta">
                                {selectedExercise.primary_muscle_group} ·{' '}
                                {selectedExercise.equipment.join(', ') ||
                                  'No equipment'}{' '}
                                · {selectedExercise.difficulty}
                              </p>
                              <div className="routine-substitution-panel">
                                <label className="field field--full">
                                  <span>Quick substitute</span>
                                  <select
                                    value=""
                                    onChange={(event) => {
                                      if (!event.target.value) return;
                                      updateExercise(
                                        day.localId,
                                        exercise.localId,
                                        { exercise_id: event.target.value },
                                      );
                                    }}
                                  >
                                    <option value="">
                                      Choose a replacement
                                    </option>
                                    {recommended.length > 0 ? (
                                      <optgroup label="Recommended: similar muscle and equipment">
                                        {recommended.map((item) => (
                                          <option value={item.id} key={item.id}>
                                            {item.name}
                                          </option>
                                        ))}
                                      </optgroup>
                                    ) : null}
                                    <optgroup label="All other exercises">
                                      {otherExercises
                                        .sort((a, b) =>
                                          a.name.localeCompare(b.name),
                                        )
                                        .map((item) => (
                                          <option value={item.id} key={item.id}>
                                            {item.name}
                                          </option>
                                        ))}
                                    </optgroup>
                                  </select>
                                </label>
                                <p>
                                  Replacing the exercise keeps the programmed
                                  sets, reps, rest, tempo and target load.
                                </p>
                              </div>
                            </>
                          ) : null}

                          <div className="exercise-target-grid">
                            <label className="field field--compact">
                              <span>Sets</span>
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={exercise.target_sets}
                                onChange={(event) =>
                                  updateExercise(
                                    day.localId,
                                    exercise.localId,
                                    { target_sets: Number(event.target.value) },
                                  )
                                }
                              />
                            </label>
                            <label className="field field--compact">
                              <span>Reps min</span>
                              <input
                                type="number"
                                min={1}
                                max={1000}
                                value={exercise.target_reps_min}
                                onChange={(event) =>
                                  updateExercise(
                                    day.localId,
                                    exercise.localId,
                                    {
                                      target_reps_min: Number(
                                        event.target.value,
                                      ),
                                    },
                                  )
                                }
                              />
                            </label>
                            <label className="field field--compact">
                              <span>Reps max</span>
                              <input
                                type="number"
                                min={1}
                                max={1000}
                                value={exercise.target_reps_max}
                                onChange={(event) =>
                                  updateExercise(
                                    day.localId,
                                    exercise.localId,
                                    {
                                      target_reps_max: Number(
                                        event.target.value,
                                      ),
                                    },
                                  )
                                }
                              />
                            </label>
                            <label className="field field--compact">
                              <span>Rest sec.</span>
                              <input
                                type="number"
                                min={0}
                                max={3600}
                                step={15}
                                value={exercise.target_rest_seconds}
                                onChange={(event) =>
                                  updateExercise(
                                    day.localId,
                                    exercise.localId,
                                    {
                                      target_rest_seconds: Number(
                                        event.target.value,
                                      ),
                                    },
                                  )
                                }
                              />
                            </label>
                            <label className="field field--compact">
                              <span>Target weight</span>
                              <input
                                type="number"
                                min={0}
                                step="0.5"
                                inputMode="decimal"
                                value={exercise.target_weight ?? ''}
                                placeholder="Optional"
                                onChange={(event) =>
                                  updateExercise(
                                    day.localId,
                                    exercise.localId,
                                    {
                                      target_weight:
                                        event.target.value.trim() === ''
                                          ? null
                                          : Number(event.target.value),
                                    },
                                  )
                                }
                              />
                            </label>
                            <label className="field field--compact">
                              <span>Weight unit</span>
                              <select
                                value={exercise.weight_unit}
                                onChange={(event) =>
                                  updateExercise(
                                    day.localId,
                                    exercise.localId,
                                    {
                                      weight_unit: event.target
                                        .value as WeightUnit,
                                    },
                                  )
                                }
                              >
                                <option value="lb">lb</option>
                                <option value="kg">kg</option>
                              </select>
                            </label>
                            <label className="field">
                              <span>Tempo</span>
                              <input
                                value={exercise.tempo}
                                placeholder="Optional: 3-1-1"
                                onChange={(event) =>
                                  updateExercise(
                                    day.localId,
                                    exercise.localId,
                                    { tempo: event.target.value },
                                  )
                                }
                              />
                            </label>
                            <label className="field field--full exercise-notes-field">
                              <span>Exercise notes</span>
                              <input
                                value={exercise.notes}
                                placeholder="Cues, limitations or setup notes"
                                onChange={(event) =>
                                  updateExercise(
                                    day.localId,
                                    exercise.localId,
                                    { notes: event.target.value },
                                  )
                                }
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  className="secondary-button secondary-button--wide"
                  type="button"
                  onClick={() => addExercise(day.localId)}
                >
                  + Add exercise
                </button>
              </article>
            ))}
          </div>

          <button
            className="secondary-button secondary-button--wide add-day-button"
            type="button"
            onClick={addDay}
          >
            + Add workout day
          </button>
        </div>

        <aside
          className="saved-routines"
          aria-labelledby="saved-routines-heading"
        >
          <div className="saved-routines-heading">
            <div>
              <p className="eyebrow">Cloud routines</p>
              <h3 id="saved-routines-heading">Saved plans</h3>
            </div>
            <button
              className="text-button"
              type="button"
              disabled={routineState.status === 'loading'}
              onClick={routineState.refresh}
            >
              Refresh
            </button>
          </div>

          {routineState.status === 'loading' ? (
            <p>Loading your routines…</p>
          ) : null}
          {routineState.status === 'error' ? (
            <div className="saved-routine-state" role="alert">
              <p>{routineState.error}</p>
              <button
                className="secondary-button"
                type="button"
                onClick={routineState.refresh}
              >
                Try again
              </button>
            </div>
          ) : null}
          {routineState.status === 'empty' ? (
            <div className="saved-routine-state">
              <h4>No routines saved yet</h4>
              <p>Your first routine will appear here after you save it.</p>
            </div>
          ) : null}

          {routineState.routines.map((routine) => {
            const exerciseCount = routine.days.reduce(
              (total, day) => total + day.exercises.length,
              0,
            );
            const presetLoadCount = routine.days.reduce(
              (total, day) =>
                total +
                day.exercises.filter(
                  (exercise) => exercise.target_weight !== null,
                ).length,
              0,
            );
            return (
              <article
                className={`saved-routine-card ${editingId === routine.id ? 'saved-routine-card--active' : ''}`}
                key={routine.id}
              >
                <div className="saved-routine-card-heading">
                  <div>
                    <span className="difficulty-chip">
                      {routine.difficulty}
                    </span>
                    <h4>{routine.name}</h4>
                  </div>
                  {routine.source === 'ai' ? (
                    <span className="status-chip">AI</span>
                  ) : null}
                </div>
                <p>{routine.goal || 'Custom workout routine'}</p>
                <div className="routine-summary">
                  <span>{routine.days.length} days</span>
                  <span>{exerciseCount} exercises</span>
                  <span>{presetLoadCount} preset loads</span>
                </div>
                <div className="saved-routine-actions saved-routine-actions--managed">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => editRoutine(routine)}
                  >
                    Edit
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => duplicateRoutine(routine)}
                  >
                    Copy
                  </button>
                  <button
                    className="text-button text-button--danger"
                    type="button"
                    disabled={routineState.deletingId === routine.id}
                    onClick={() => void deleteRoutine(routine)}
                  >
                    {routineState.deletingId === routine.id
                      ? 'Deleting…'
                      : 'Delete'}
                  </button>
                </div>
              </article>
            );
          })}
        </aside>
      </div>
    </section>
  );
}
