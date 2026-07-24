import { useEffect, useMemo, useState } from 'react';
import type { Exercise } from '../../types/database';
import { useExerciseMedia } from './ExerciseMediaProvider';
import {
  getMuscleHighlightLabels,
  type ExerciseTechniqueGuide,
} from './exerciseMedia';
import { resolveExerciseVisuals, type ExerciseVisual } from './exerciseVisuals';

type ExerciseTechniqueMediaProps = {
  exercise: Exercise;
  expanded?: boolean;
};

type ResolvedExerciseTechniqueMediaProps = {
  exercise: Exercise;
  expanded: boolean;
};

type VisualSurfaceProps = {
  visual: ExerciseVisual;
  expanded: boolean;
  phaseLabel?: string;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

function ExerciseMediaPlaceholder({
  exercise,
  expanded,
}: ResolvedExerciseTechniqueMediaProps) {
  return (
    <div
      className={
        expanded
          ? 'exercise-media-engine__placeholder exercise-media-engine__placeholder--expanded'
          : 'exercise-media-engine__placeholder'
      }
      aria-label={`${exercise.name} professional demonstration is being prepared`}
    >
      <span aria-hidden="true">
        {exercise.primary_muscle_group.slice(0, 1).toUpperCase()}
      </span>
      <div>
        <strong>Technique guide</strong>
        <small>Professional movement media coming soon</small>
      </div>
    </div>
  );
}

function VisualSurface({ visual, expanded, phaseLabel }: VisualSurfaceProps) {
  const [failed, setFailed] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    setFailed(false);
  }, [visual.url]);

  if (failed) {
    return (
      <div className="exercise-media-engine__asset-fallback" role="status">
        <span>Media unavailable</span>
        <small>The technique instructions remain available below.</small>
      </div>
    );
  }

  return (
    <figure className="exercise-media-engine__asset">
      {phaseLabel ? <figcaption>{phaseLabel}</figcaption> : null}
      {visual.kind === 'video' ? (
        <video
          src={visual.url}
          poster={visual.posterUrl ?? undefined}
          controls={expanded}
          autoPlay={!expanded && !prefersReducedMotion}
          muted
          loop={!expanded}
          playsInline
          preload={expanded ? 'metadata' : 'none'}
          aria-label={visual.alt}
          onError={() => setFailed(true)}
        />
      ) : (
        <img
          src={visual.url}
          alt={visual.alt}
          loading={expanded ? 'eager' : 'lazy'}
          decoding="async"
          width={visual.width ?? undefined}
          height={visual.height ?? undefined}
          onError={() => setFailed(true)}
        />
      )}
    </figure>
  );
}

export function ExerciseTechniqueMedia({
  exercise,
  expanded = false,
}: ExerciseTechniqueMediaProps) {
  const bundle = useExerciseMedia(exercise.id);
  const visuals = resolveExerciseVisuals(exercise, bundle, { expanded });

  const showPositionPair = Boolean(
    expanded &&
    visuals.start &&
    visuals.finish &&
    visuals.start.url !== visuals.finish.url,
  );

  if (showPositionPair && visuals.start && visuals.finish) {
    return (
      <div className="exercise-media-engine exercise-media-engine--expanded exercise-media-engine--pair">
        <VisualSurface
          visual={visuals.start}
          expanded
          phaseLabel="Start position"
        />
        <VisualSurface
          visual={visuals.finish}
          expanded
          phaseLabel="Finish position"
        />
      </div>
    );
  }

  if (visuals.primary) {
    return (
      <div
        className={
          expanded
            ? 'exercise-media-engine exercise-media-engine--expanded'
            : 'exercise-media-engine'
        }
      >
        <VisualSurface visual={visuals.primary} expanded={expanded} />
      </div>
    );
  }

  return (
    <div
      className={
        expanded
          ? 'exercise-media-engine exercise-media-engine--expanded'
          : 'exercise-media-engine'
      }
    >
      <ExerciseMediaPlaceholder exercise={exercise} expanded={expanded} />
    </div>
  );
}

function TechniqueList({
  items,
  fallback,
}: {
  items: string[];
  fallback?: string;
}) {
  const visibleItems = items.filter((item) => item.trim().length > 0);

  if (visibleItems.length === 0 && fallback) {
    return <p className="exercise-technique-empty">{fallback}</p>;
  }

  return (
    <ul className="exercise-technique-list">
      {visibleItems.map((item, index) => (
        <li key={`${item}-${index}`}>
          <span aria-hidden="true">{index + 1}</span>
          <p>{item}</p>
        </li>
      ))}
    </ul>
  );
}

function buildTechniqueSteps(
  guide: ExerciseTechniqueGuide | null,
  exercise: Exercise,
): string[] {
  if (!guide) return exercise.instructions;

  const steps = [...guide.setup_steps, ...guide.execution_steps];
  return steps.length > 0 ? steps : exercise.instructions;
}

export function ExerciseTechniqueSheet({
  exercise,
  onClose,
}: {
  exercise: Exercise;
  onClose: () => void;
}) {
  const bundle = useExerciseMedia(exercise.id);
  const guide = bundle?.guide ?? null;
  const techniqueSteps = useMemo(
    () => buildTechniqueSteps(guide, exercise),
    [exercise, guide],
  );
  const muscleHighlights = useMemo(
    () => getMuscleHighlightLabels(guide?.muscle_highlights ?? []),
    [guide?.muscle_highlights],
  );

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
      className="active-technique-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="active-technique-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="active-technique-title"
      >
        <header>
          <div>
            <p>{exercise.primary_muscle_group}</p>
            <h2 id="active-technique-title">{exercise.name}</h2>
          </div>
          <button
            type="button"
            aria-label="Close technique guide"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="active-technique-scroll">
          <ExerciseTechniqueMedia exercise={exercise} expanded />

          <section className="exercise-technique-section">
            <span className="overview-kicker">Step by step</span>
            <h3>Setup and execution</h3>
            <TechniqueList
              items={techniqueSteps}
              fallback="Detailed editorial instructions are being prepared for this exercise."
            />
          </section>

          {guide?.start_position || guide?.finish_position ? (
            <section className="exercise-technique-section exercise-technique-positions">
              <span className="overview-kicker">Positions</span>
              <div>
                {guide.start_position ? (
                  <article>
                    <strong>Start</strong>
                    <p>{guide.start_position}</p>
                  </article>
                ) : null}
                {guide.finish_position ? (
                  <article>
                    <strong>Finish</strong>
                    <p>{guide.finish_position}</p>
                  </article>
                ) : null}
              </div>
            </section>
          ) : null}

          {guide?.coaching_cues.length ? (
            <section className="exercise-technique-section exercise-technique-section--positive">
              <span className="overview-kicker">Coach cues</span>
              <h3>What to focus on</h3>
              <TechniqueList items={guide.coaching_cues} />
            </section>
          ) : null}

          {guide?.common_mistakes.length ? (
            <section className="exercise-technique-section exercise-technique-section--warning">
              <span className="overview-kicker">Common mistakes</span>
              <h3>What to avoid</h3>
              <TechniqueList items={guide.common_mistakes} />
            </section>
          ) : null}

          {guide?.safety_notes.length ? (
            <section className="exercise-technique-section exercise-technique-section--safety">
              <span className="overview-kicker">Safety</span>
              <TechniqueList items={guide.safety_notes} />
            </section>
          ) : null}

          {guide?.breathing ||
          guide?.tempo_guidance ||
          muscleHighlights.length > 0 ? (
            <aside className="exercise-technique-details">
              {guide?.breathing ? (
                <div>
                  <strong>Breathing</strong>
                  <p>{guide.breathing}</p>
                </div>
              ) : null}
              {guide?.tempo_guidance ? (
                <div>
                  <strong>Tempo</strong>
                  <p>{guide.tempo_guidance}</p>
                </div>
              ) : null}
              {muscleHighlights.length > 0 ? (
                <div>
                  <strong>Muscles highlighted</strong>
                  <p>{muscleHighlights.join(' · ')}</p>
                </div>
              ) : null}
            </aside>
          ) : (
            <aside>
              <strong>Technique reminder</strong>
              <p>
                Use a controlled range of motion and stop if you feel sharp
                pain.
              </p>
            </aside>
          )}
        </div>
      </section>
    </div>
  );
}
