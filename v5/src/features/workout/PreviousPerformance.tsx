import { createContext, useContext, type PropsWithChildren } from 'react';
import { usePreviousPerformance } from './hooks/usePreviousPerformance';
import { useProgressionRecommendations } from './hooks/useProgressionRecommendations';
import type { ProgressionRecommendation } from './repositories/progressionRepository';

type PreviousPerformanceContextValue = {
  previous: ReturnType<typeof usePreviousPerformance>;
  progression: ReturnType<typeof useProgressionRecommendations>;
};

const PreviousPerformanceContext =
  createContext<PreviousPerformanceContextValue | null>(null);

export function PreviousPerformanceProvider({
  exerciseIds,
  children,
}: PropsWithChildren<{ exerciseIds: string[] }>) {
  const previous = usePreviousPerformance(exerciseIds);
  const progression = useProgressionRecommendations(exerciseIds);

  return (
    <PreviousPerformanceContext.Provider value={{ previous, progression }}>
      {children}
    </PreviousPerformanceContext.Provider>
  );
}

export function usePreviousPerformanceForExercise(exerciseId: string) {
  const context = useContext(PreviousPerformanceContext);

  return {
    status: context?.previous.status ?? 'idle',
    performance: context?.previous.byExerciseId[exerciseId] ?? null,
  } as const;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(
    value,
  );
}

function CompactProgression({
  recommendation,
}: {
  recommendation: ProgressionRecommendation;
}) {
  return (
    <aside
      className={`compact-progression compact-progression--${recommendation.recommendation_type}`}
    >
      <header>
        <span>Progression guidance</span>
        <span
          className={`confidence-chip confidence-chip--${recommendation.confidence}`}
        >
          {recommendation.confidence}
        </span>
      </header>
      <strong>{recommendation.action_label}</strong>
      <p>{recommendation.rationale}</p>
      <small>No target, repetition, load or routine was changed.</small>
    </aside>
  );
}

export function PreviousPerformance({ exerciseId }: { exerciseId: string }) {
  const context = useContext(PreviousPerformanceContext);
  if (!context || context.previous.status === 'idle') return null;

  if (context.previous.status === 'loading') {
    return (
      <div className="previous-performance" aria-live="polite">
        <p>Loading previous performance…</p>
      </div>
    );
  }

  const performance = context.previous.byExerciseId[exerciseId];
  if (!performance) {
    return (
      <div className="previous-performance">
        <p>No previous working sets yet</p>
      </div>
    );
  }

  const recommendations = context.progression.byExerciseId[exerciseId] ?? [];
  const recommendation =
    recommendations.find(
      (item) => item.weight_unit === performance.weight_unit,
    ) ??
    recommendations[0] ??
    null;

  return (
    <>
      <div className="previous-performance">
        <p>Last time · {formatDate(performance.performed_at)}</p>
        <div className="previous-performance-sets">
          {performance.sets.map((set) => (
            <span key={set.set_number}>
              {set.weight === null
                ? `${set.reps ?? 0} reps`
                : `${formatNumber(set.weight)} ${performance.weight_unit} × ${set.reps ?? 0}`}
            </span>
          ))}
        </div>
      </div>
      {recommendation ? (
        <CompactProgression recommendation={recommendation} />
      ) : null}
    </>
  );
}
