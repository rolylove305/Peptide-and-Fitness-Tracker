import { createContext, useContext, type PropsWithChildren } from 'react';
import { usePreviousPerformance } from './hooks/usePreviousPerformance';

type PreviousPerformanceContextValue = ReturnType<typeof usePreviousPerformance>;

const PreviousPerformanceContext = createContext<PreviousPerformanceContextValue | null>(null);

export function PreviousPerformanceProvider({
  exerciseIds,
  children,
}: PropsWithChildren<{ exerciseIds: string[] }>) {
  const value = usePreviousPerformance(exerciseIds);
  return (
    <PreviousPerformanceContext.Provider value={value}>
      {children}
    </PreviousPerformanceContext.Provider>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

export function PreviousPerformance({ exerciseId }: { exerciseId: string }) {
  const context = useContext(PreviousPerformanceContext);
  if (!context || context.status === 'idle') return null;

  if (context.status === 'loading') {
    return (
      <div className="previous-performance" aria-live="polite">
        <p>Loading previous performance…</p>
      </div>
    );
  }

  const performance = context.byExerciseId[exerciseId];
  if (!performance) {
    return (
      <div className="previous-performance">
        <p>No previous working sets yet</p>
      </div>
    );
  }

  return (
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
  );
}
