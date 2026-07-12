import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useProgressionChanges } from './hooks/useProgressionChanges';
import { useProgressionRecommendations } from './hooks/useProgressionRecommendations';
import { useRoutines } from './hooks/useRoutines';
import type {
  ApplicableRecommendationType,
  ApplyProgressionChangeInput,
  ProgressionChange,
} from './repositories/progressionChangeRepository';
import type {
  ProgressionEvidenceSession,
  ProgressionRecommendation,
  ProgressionRecommendationType,
} from './repositories/progressionRepository';

type ProgressionFilter = 'all' | ProgressionRecommendationType;

type RoutineExerciseLocation = {
  id: string;
  exerciseId: string;
  routineName: string;
  dayName: string;
  targetWeight: number | null;
  weightUnit: 'lb' | 'kg';
  targetRepsMin: number | null;
  targetRepsMax: number | null;
};

const filters: Array<{ value: ProgressionFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'increase_load', label: 'Load' },
  { value: 'increase_reps', label: 'Reps' },
  { value: 'review_recovery', label: 'Review' },
  { value: 'hold', label: 'Hold' },
  { value: 'insufficient_data', label: 'More data' },
];

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function recommendationLabel(type: ProgressionRecommendationType): string {
  switch (type) {
    case 'increase_load':
      return 'Load progression';
    case 'increase_reps':
      return 'Rep progression';
    case 'review_recovery':
      return 'Review before progressing';
    case 'hold':
      return 'Hold steady';
    default:
      return 'More data needed';
  }
}

function formatTargetRange(recommendation: ProgressionRecommendation): string {
  const { target_reps_min: minimum, target_reps_max: maximum } = recommendation;
  if (minimum === null || maximum === null) return 'Custom';
  return minimum === maximum ? `${minimum}` : `${minimum}–${maximum}`;
}

function formatRoutineTarget(
  weight: number | null,
  unit: 'lb' | 'kg',
  minimum: number | null,
  maximum: number | null,
): string {
  const weightLabel = weight === null ? 'No preset load' : `${formatNumber(weight)} ${unit}`;
  const repLabel =
    minimum === null || maximum === null
      ? 'custom reps'
      : minimum === maximum
        ? `${minimum} reps`
        : `${minimum}–${maximum} reps`;
  return `${weightLabel} · ${repLabel}`;
}

function isApplicable(
  recommendation: ProgressionRecommendation,
): recommendation is ProgressionRecommendation & { recommendation_type: ApplicableRecommendationType } {
  return (
    recommendation.recommendation_type === 'increase_load' ||
    recommendation.recommendation_type === 'increase_reps'
  );
}

function EvidenceRow({
  evidence,
  weightUnit,
}: {
  evidence: ProgressionEvidenceSession;
  weightUnit: 'lb' | 'kg';
}) {
  return (
    <div className="progression-evidence-row">
      <div>
        <strong>{formatDate(evidence.performed_at)}</strong>
        <span>{evidence.completed_set_count} working sets</span>
      </div>
      <div>
        <span>Top weight</span>
        <strong>
          {evidence.maximum_weight === null
            ? '—'
            : `${formatNumber(evidence.maximum_weight)} ${weightUnit}`}
        </strong>
      </div>
      <div>
        <span>Average reps</span>
        <strong>{formatNumber(evidence.average_reps)}</strong>
      </div>
      <div>
        <span>Average RPE</span>
        <strong>{evidence.average_rpe === null ? 'Not recorded' : formatNumber(evidence.average_rpe)}</strong>
      </div>
    </div>
  );
}

function ApprovalPanel({
  recommendation,
  locations,
  applying,
  onApply,
}: {
  recommendation: ProgressionRecommendation & {
    recommendation_type: ApplicableRecommendationType;
  };
  locations: RoutineExerciseLocation[];
  applying: boolean;
  onApply: (input: ApplyProgressionChangeInput) => Promise<boolean>;
}) {
  const [selectedId, setSelectedId] = useState(locations[0]?.id ?? '');
  const selected = locations.find((location) => location.id === selectedId) ?? locations[0] ?? null;
  const [proposedWeight, setProposedWeight] = useState('');
  const [proposedRepsMin, setProposedRepsMin] = useState('');
  const [proposedRepsMax, setProposedRepsMax] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    const loadStep = recommendation.weight_unit === 'lb' ? 5 : 2.5;
    const latestWeight = recommendation.latest_weight ?? selected.targetWeight;
    const nextWeight = latestWeight === null ? null : Math.round((latestWeight + loadStep) * 100) / 100;

    setProposedWeight(
      recommendation.recommendation_type === 'increase_load'
        ? nextWeight?.toString() ?? ''
        : selected.targetWeight?.toString() ?? '',
    );
    setProposedRepsMin(
      recommendation.recommendation_type === 'increase_reps'
        ? String((selected.targetRepsMin ?? recommendation.target_reps_min ?? 0) + 1)
        : String(selected.targetRepsMin ?? ''),
    );
    setProposedRepsMax(
      recommendation.recommendation_type === 'increase_reps'
        ? String((selected.targetRepsMax ?? recommendation.target_reps_max ?? 0) + 1)
        : String(selected.targetRepsMax ?? ''),
    );
    setError(null);
  }, [recommendation, selected]);

  if (!selected) {
    return (
      <div className="progression-approval progression-approval--unavailable">
        <strong>No matching saved routine target</strong>
        <p>
          The analyzed repetition range or weight unit no longer matches an active routine. Refresh the plans or
          edit the target in Routine Builder before applying this suggestion.
        </p>
      </div>
    );
  }

  async function submit() {
    const target = selected;
    if (!target) {
      setError('Select a saved routine target before applying this change.');
      return;
    }

    setError(null);
    const parsedWeight = proposedWeight.trim() === '' ? null : Number(proposedWeight);
    const parsedMinimum = Number(proposedRepsMin);
    const parsedMaximum = Number(proposedRepsMax);

    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) {
      setError('Enter a valid non-negative target weight.');
      return;
    }
    if (!Number.isInteger(parsedMinimum) || !Number.isInteger(parsedMaximum) || parsedMinimum < 1) {
      setError('Enter valid whole-number repetition targets.');
      return;
    }
    if (parsedMaximum < parsedMinimum) {
      setError('Maximum repetitions cannot be lower than minimum repetitions.');
      return;
    }
    if (
      recommendation.recommendation_type === 'increase_load' &&
      (parsedWeight === null ||
        recommendation.latest_weight === null ||
        parsedWeight <= recommendation.latest_weight)
    ) {
      setError('The approved load must be higher than the latest comparable weight.');
      return;
    }

    const proposedUnit =
      recommendation.recommendation_type === 'increase_load'
        ? recommendation.weight_unit
        : target.weightUnit;
    const confirmed = window.confirm(
      `Apply this change to ${target.routineName} — ${target.dayName}? Historical workouts will not change.`,
    );
    if (!confirmed) return;

    const success = await onApply({
      routineExerciseId: target.id,
      recommendationType: recommendation.recommendation_type,
      recommendationWeightUnit: recommendation.weight_unit,
      expectedTargetWeight: target.targetWeight,
      expectedWeightUnit: target.weightUnit,
      expectedRepsMin: target.targetRepsMin,
      expectedRepsMax: target.targetRepsMax,
      proposedTargetWeight: parsedWeight,
      proposedWeightUnit: proposedUnit,
      proposedRepsMin: parsedMinimum,
      proposedRepsMax: parsedMaximum,
    });

    if (!success) setError('The change was not applied. Review the message above and recalculate if needed.');
  }

  const proposedWeightValue = proposedWeight.trim() === '' ? null : Number(proposedWeight);
  const proposedMinimumValue = proposedRepsMin.trim() === '' ? null : Number(proposedRepsMin);
  const proposedMaximumValue = proposedRepsMax.trim() === '' ? null : Number(proposedRepsMax);

  return (
    <details className="progression-approval">
      <summary>Review and approve a routine change</summary>
      <div className="progression-approval-body">
        <label className="field progression-location-select">
          <span>Routine target</span>
          <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
            {locations.map((location) => (
              <option value={location.id} key={location.id}>
                {location.routineName} — {location.dayName}
              </option>
            ))}
          </select>
        </label>

        <div className="progression-change-compare">
          <article className="progression-change-column">
            <span>Current</span>
            <strong>
              {formatRoutineTarget(
                selected.targetWeight,
                selected.weightUnit,
                selected.targetRepsMin,
                selected.targetRepsMax,
              )}
            </strong>
          </article>
          <article className="progression-change-column progression-change-column--proposed">
            <span>Proposed</span>
            <strong>
              {formatRoutineTarget(
                Number.isFinite(proposedWeightValue) ? proposedWeightValue : null,
                recommendation.recommendation_type === 'increase_load'
                  ? recommendation.weight_unit
                  : selected.weightUnit,
                Number.isFinite(proposedMinimumValue) ? proposedMinimumValue : null,
                Number.isFinite(proposedMaximumValue) ? proposedMaximumValue : null,
              )}
            </strong>
          </article>
        </div>

        <div className="progression-approval-fields">
          <label className="field">
            <span>Target weight ({recommendation.recommendation_type === 'increase_load' ? recommendation.weight_unit : selected.weightUnit})</span>
            <input
              type="number"
              min={0}
              step="0.5"
              inputMode="decimal"
              value={proposedWeight}
              disabled={recommendation.recommendation_type === 'increase_reps'}
              placeholder="No preset load"
              onChange={(event) => setProposedWeight(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Reps min</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={proposedRepsMin}
              disabled={recommendation.recommendation_type === 'increase_load'}
              onChange={(event) => setProposedRepsMin(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Reps max</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={proposedRepsMax}
              disabled={recommendation.recommendation_type === 'increase_load'}
              onChange={(event) => setProposedRepsMax(event.target.value)}
            />
          </label>
        </div>

        <p className="progression-approval-note">
          Only this saved routine target and future workouts will change. Completed workout history remains intact.
        </p>
        {error ? <p className="builder-message builder-message--error" role="alert">{error}</p> : null}
        <div className="progression-change-actions">
          <button className="primary-button" type="button" disabled={applying} onClick={() => void submit()}>
            {applying ? 'Applying…' : 'Approve and apply'}
          </button>
        </div>
      </div>
    </details>
  );
}

function RecommendationCard({
  recommendation,
  locations,
  applying,
  onApply,
}: {
  recommendation: ProgressionRecommendation;
  locations: RoutineExerciseLocation[];
  applying: boolean;
  onApply: (input: ApplyProgressionChangeInput) => Promise<boolean>;
}) {
  return (
    <article className={`progression-card progression-card--${recommendation.recommendation_type}`}>
      <header className="progression-card-header">
        <div>
          <p>{recommendation.primary_muscle_group}</p>
          <h3>{recommendation.exercise_name}</h3>
        </div>
        <div className="progression-card-badges">
          <span className="progression-type-chip">
            {recommendationLabel(recommendation.recommendation_type)}
          </span>
          <span className={`confidence-chip confidence-chip--${recommendation.confidence}`}>
            {recommendation.confidence} confidence
          </span>
        </div>
      </header>

      <div className="progression-action">
        <span>Suggested next step</span>
        <strong>{recommendation.action_label}</strong>
        <p>{recommendation.rationale}</p>
      </div>

      <div className="progression-metrics">
        <div>
          <span>Latest weight</span>
          <strong>
            {recommendation.latest_weight === null
              ? '—'
              : `${formatNumber(recommendation.latest_weight)} ${recommendation.weight_unit}`}
          </strong>
        </div>
        <div>
          <span>Average reps</span>
          <strong>{formatNumber(recommendation.latest_average_reps)}</strong>
        </div>
        <div>
          <span>Average RPE</span>
          <strong>
            {recommendation.latest_average_rpe === null
              ? 'Not recorded'
              : formatNumber(recommendation.latest_average_rpe)}
          </strong>
        </div>
        <div>
          <span>Programmed range</span>
          <strong>{formatTargetRange(recommendation)} reps</strong>
        </div>
      </div>

      <details className="progression-evidence">
        <summary>
          Evidence from {recommendation.sessions_analyzed} comparable session
          {recommendation.sessions_analyzed === 1 ? '' : 's'}
        </summary>
        <div className="progression-evidence-list">
          {recommendation.evidence.map((evidence) => (
            <EvidenceRow
              key={evidence.session_id}
              evidence={evidence}
              weightUnit={recommendation.weight_unit}
            />
          ))}
        </div>
      </details>

      {isApplicable(recommendation) ? (
        <ApprovalPanel
          recommendation={recommendation}
          locations={locations}
          applying={applying}
          onApply={onApply}
        />
      ) : null}

      <footer>
        {isApplicable(recommendation)
          ? 'Nothing changes until you review and approve an exact routine target.'
          : 'Guidance only. No routine, target, repetition or load was changed.'}
      </footer>
    </article>
  );
}

function ChangeHistory({
  changes,
  undoingChangeId,
  onUndo,
}: {
  changes: ProgressionChange[];
  undoingChangeId: string | null;
  onUndo: (change: ProgressionChange) => Promise<void>;
}) {
  return (
    <section className="progression-history" aria-labelledby="progression-history-heading">
      <div className="history-panel-heading">
        <div>
          <p className="eyebrow">Audited changes</p>
          <h3 id="progression-history-heading">Approval history</h3>
        </div>
        <span>{changes.length} recorded</span>
      </div>

      {changes.length === 0 ? (
        <div className="progression-filter-empty">
          <p>No recommendations have been applied. Approved changes and undo status will appear here.</p>
        </div>
      ) : (
        <div className="progression-history-list">
          {changes.map((change) => (
            <article className="progression-history-card" key={change.id}>
              <header>
                <div>
                  <p>{change.routine_name_snapshot} · {change.day_name_snapshot}</p>
                  <h4>{change.exercise_name_snapshot}</h4>
                </div>
                <span className={`progression-change-status progression-change-status--${change.status}`}>
                  {change.status}
                </span>
              </header>
              <div className="progression-change-compare">
                <div className="progression-change-column">
                  <span>Before</span>
                  <strong>
                    {formatRoutineTarget(
                      change.before_target_weight,
                      change.before_weight_unit,
                      change.before_reps_min,
                      change.before_reps_max,
                    )}
                  </strong>
                </div>
                <div className="progression-change-column progression-change-column--proposed">
                  <span>After</span>
                  <strong>
                    {formatRoutineTarget(
                      change.after_target_weight,
                      change.after_weight_unit,
                      change.after_reps_min,
                      change.after_reps_max,
                    )}
                  </strong>
                </div>
              </div>
              <footer>
                <span>
                  Applied {formatDateTime(change.applied_at)}
                  {change.undone_at ? ` · Undone ${formatDateTime(change.undone_at)}` : ''}
                </span>
                {change.status === 'applied' && change.routine_exercise_id ? (
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={undoingChangeId === change.id}
                    onClick={() => void onUndo(change)}
                  >
                    {undoingChangeId === change.id ? 'Undoing…' : 'Undo change'}
                  </button>
                ) : null}
                {change.status === 'applied' && !change.routine_exercise_id ? (
                  <span>The original routine target no longer exists.</span>
                ) : null}
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function ProgressionDashboard() {
  const { user } = useAuth();
  const progression = useProgressionRecommendations();
  const routines = useRoutines(user?.id);
  const changeState = useProgressionChanges(user?.id);
  const [filter, setFilter] = useState<ProgressionFilter>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const locationsByExercise = useMemo(() => {
    const grouped: Record<string, RoutineExerciseLocation[]> = {};
    routines.routines
      .filter((routine) => routine.is_active)
      .forEach((routine) => {
        routine.days.forEach((day) => {
          day.exercises.forEach((exercise) => {
            grouped[exercise.exercise_id] = [
              ...(grouped[exercise.exercise_id] ?? []),
              {
                id: exercise.id,
                exerciseId: exercise.exercise_id,
                routineName: routine.name,
                dayName: day.name,
                targetWeight: exercise.target_weight,
                weightUnit: exercise.weight_unit,
                targetRepsMin: exercise.target_reps_min,
                targetRepsMax: exercise.target_reps_max,
              },
            ];
          });
        });
      });
    return grouped;
  }, [routines.routines]);

  const counts = useMemo(() => {
    const result: Record<ProgressionRecommendationType, number> = {
      increase_load: 0,
      increase_reps: 0,
      review_recovery: 0,
      hold: 0,
      insufficient_data: 0,
    };
    progression.recommendations.forEach((recommendation) => {
      result[recommendation.recommendation_type] += 1;
    });
    return result;
  }, [progression.recommendations]);

  const visibleRecommendations = useMemo(
    () =>
      filter === 'all'
        ? progression.recommendations
        : progression.recommendations.filter(
            (recommendation) => recommendation.recommendation_type === filter,
          ),
    [filter, progression.recommendations],
  );

  function matchingLocations(recommendation: ProgressionRecommendation): RoutineExerciseLocation[] {
    return (locationsByExercise[recommendation.exercise_id] ?? []).filter(
      (location) =>
        location.weightUnit === recommendation.weight_unit &&
        location.targetRepsMin === recommendation.target_reps_min &&
        location.targetRepsMax === recommendation.target_reps_max,
    );
  }

  async function applyChange(
    recommendation: ProgressionRecommendation,
    input: ApplyProgressionChangeInput,
  ): Promise<boolean> {
    setMessage(null);
    setLocalError(null);
    const result = await changeState.apply(recommendation.exercise_id, input);
    if (!result.ok) {
      setLocalError(result.error);
      return false;
    }

    await routines.refresh();
    progression.refresh();
    changeState.refresh();
    setMessage('Progression approved and applied to the saved routine. Future workouts will use the new target.');
    return true;
  }

  async function undoChange(change: ProgressionChange): Promise<void> {
    const confirmed = window.confirm(
      `Undo the approved change for ${change.exercise_name_snapshot}? This restores the recorded before values only if the target has not been edited since.`,
    );
    if (!confirmed) return;

    setMessage(null);
    setLocalError(null);
    const result = await changeState.undo(change.id);
    if (!result.ok) {
      setLocalError(result.error);
      return;
    }

    await routines.refresh();
    progression.refresh();
    changeState.refresh();
    setMessage('Progression change undone. The previous routine target has been restored.');
  }

  const loading =
    progression.status === 'loading' ||
    routines.status === 'loading' ||
    changeState.status === 'loading';

  if (loading) {
    return (
      <section className="progression-state-card" aria-live="polite" aria-busy="true">
        <div className="loading-mark" aria-hidden="true">P</div>
        <p>Comparing sessions and loading approved changes…</p>
      </section>
    );
  }

  return (
    <section className="progression-dashboard" aria-labelledby="progression-heading">
      <div className="section-heading progression-heading">
        <div>
          <p className="eyebrow">Explainable progression</p>
          <h2 id="progression-heading">What should change next?</h2>
          <p>
            Review the evidence, select the exact saved routine target, compare before and after, then approve
            the change yourself.
          </p>
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            progression.refresh();
            void routines.refresh();
            changeState.refresh();
          }}
        >
          Recalculate
        </button>
      </div>

      <aside className="progression-safety-note">
        <strong>You remain in control.</strong>
        <span>
          Recommendations never edit a routine automatically. Every applied change is revalidated in Supabase,
          recorded with before-and-after values and can be undone when no later edit would be overwritten.
        </span>
      </aside>

      {message ? <p className="builder-message builder-message--success">{message}</p> : null}
      {localError || progression.error || routines.error || changeState.error ? (
        <p className="builder-message builder-message--error" role="alert">
          {localError ?? progression.error ?? routines.error ?? changeState.error}
        </p>
      ) : null}

      <div className="progression-overview-grid">
        <article><span>Load opportunities</span><strong>{counts.increase_load}</strong></article>
        <article><span>Rep opportunities</span><strong>{counts.increase_reps}</strong></article>
        <article><span>Review first</span><strong>{counts.review_recovery}</strong></article>
        <article><span>Applied changes</span><strong>{changeState.changes.filter((change) => change.status === 'applied').length}</strong></article>
      </div>

      {progression.recommendations.length === 0 ? (
        <section className="progression-empty" aria-labelledby="progression-empty-heading">
          <p className="eyebrow">Evidence before advice</p>
          <h2 id="progression-empty-heading">No comparable training history yet</h2>
          <p>
            Complete working sets in at least two sessions using a programmed repetition range. BioTrack will
            then compare performance and require your approval before changing any saved target.
          </p>
        </section>
      ) : (
        <>
          <div className="progression-filter-row" role="tablist" aria-label="Progression guidance filters">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={filter === item.value}
                className={filter === item.value ? 'progression-filter progression-filter--active' : 'progression-filter'}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {visibleRecommendations.length === 0 ? (
            <div className="progression-filter-empty">
              <p>No exercises currently match this filter.</p>
            </div>
          ) : (
            <div className="progression-card-grid">
              {visibleRecommendations.map((recommendation) => (
                <RecommendationCard
                  key={`${recommendation.exercise_id}:${recommendation.weight_unit}`}
                  recommendation={recommendation}
                  locations={matchingLocations(recommendation)}
                  applying={changeState.applyingExerciseId === recommendation.exercise_id}
                  onApply={(input) => applyChange(recommendation, input)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ChangeHistory
        changes={changeState.changes}
        undoingChangeId={changeState.undoingChangeId}
        onUndo={undoChange}
      />
    </section>
  );
}
