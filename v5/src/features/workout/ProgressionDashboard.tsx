import { useMemo, useState } from 'react';
import { useProgressionRecommendations } from './hooks/useProgressionRecommendations';
import type {
  ProgressionEvidenceSession,
  ProgressionRecommendation,
  ProgressionRecommendationType,
} from './repositories/progressionRepository';

type ProgressionFilter = 'all' | ProgressionRecommendationType;

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

function RecommendationCard({ recommendation }: { recommendation: ProgressionRecommendation }) {
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

      <footer>
        Guidance only. No routine, target, repetition or load was changed.
      </footer>
    </article>
  );
}

export function ProgressionDashboard() {
  const progression = useProgressionRecommendations();
  const [filter, setFilter] = useState<ProgressionFilter>('all');

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

  if (progression.status === 'loading') {
    return (
      <section className="progression-state-card" aria-live="polite" aria-busy="true">
        <div className="loading-mark" aria-hidden="true">P</div>
        <p>Comparing your recent training sessions…</p>
      </section>
    );
  }

  if (progression.status === 'error') {
    return (
      <section className="progression-state-card" role="alert">
        <h2>Progression guidance unavailable</h2>
        <p>{progression.error}</p>
        <button className="secondary-button" type="button" onClick={progression.refresh}>
          Try again
        </button>
      </section>
    );
  }

  if (progression.status === 'empty') {
    return (
      <section className="progression-empty" aria-labelledby="progression-empty-heading">
        <p className="eyebrow">Evidence before advice</p>
        <h2 id="progression-empty-heading">No comparable training history yet</h2>
        <p>
          Complete working sets in at least two sessions using a programmed repetition range. BioTrack will
          then compare your performance without changing your routine automatically.
        </p>
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
            BioTrack compares up to three recent sessions per exercise and shows the exact evidence behind
            every suggestion.
          </p>
        </div>
        <button className="text-button" type="button" onClick={progression.refresh}>
          Recalculate
        </button>
      </div>

      <aside className="progression-safety-note">
        <strong>You remain in control.</strong>
        <span>
          These are training suggestions, not automatic edits. BioTrack will never change a routine, target,
          repetition or load without a separate approval step.
        </span>
      </aside>

      <div className="progression-overview-grid">
        <article><span>Load opportunities</span><strong>{counts.increase_load}</strong></article>
        <article><span>Rep opportunities</span><strong>{counts.increase_reps}</strong></article>
        <article><span>Review first</span><strong>{counts.review_recovery}</strong></article>
        <article><span>Hold or gather data</span><strong>{counts.hold + counts.insufficient_data}</strong></article>
      </div>

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
            />
          ))}
        </div>
      )}
    </section>
  );
}
