import { useEffect, useMemo, useState } from 'react';
import type { Exercise } from '../../types/database';
import { useExerciseMedia } from './ExerciseMediaProvider';
import {
  getMuscleHighlightLabels,
  selectExerciseMediaAsset,
  type ExerciseMediaAsset,
  type ExerciseTechniqueGuide,
} from './exerciseMedia';

type ExerciseTechniqueMediaProps = {
  exercise: Exercise;
  expanded?: boolean;
};

type AssetSurfaceProps = {
  asset: ExerciseMediaAsset;
  expanded: boolean;
  phaseLabel?: string;
};

function ExerciseMediaPlaceholder({ exercise, expanded }: ExerciseTechniqueMediaProps) {
  return (
    <div
      className={expanded
        ? 'exercise-media-engine__placeholder exercise-media-engine__placeholder--expanded'
        : 'exercise-media-engine__placeholder'}
      aria-label={`${exercise.name} professional demonstration is being prepared`}
    >
      <span aria-hidden="true">{exercise.primary_muscle_group.slice(0, 1).toUpperCase()}</span>
      <div>
        <strong>Technique guide</strong>
        <small>Professional movement media coming soon</small>
      </div>
    </div>
  );
}

function AssetSurface({ asset, expanded, phaseLabel }: AssetSurfaceProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [asset.id, asset.url]);

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
      {asset.media_kind === 'video' ? (
        <video
          src={asset.url}
          poster={asset.poster_url ?? undefined}
          controls={expanded}
          autoPlay={!expanded}
          muted={!expanded}
          loop={!expanded}
          playsInline
          preload={expanded ? 'metadata' : 'none'}
          aria-label={asset.alt_text}
          onError={() => setFailed(true)}
        />
      ) : (
        <img
          src={asset.url}
          alt={asset.alt_text}
          loading={expanded ? 'eager' : 'lazy'}
          decoding="async"
          width={asset.width ?? undefined}
          height={asset.height ?? undefined}
          onError={() => setFailed(true)}
        />
      )}
    </figure>
  );
}

function LegacyExerciseMedia({ exercise, expanded }: ExerciseTechniqueMediaProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [exercise.id, exercise.media_url]);

  if (!exercise.media_url || failed) {
    return <ExerciseMediaPlaceholder exercise={exercise} expanded={expanded} />;
  }

  if (exercise.media_type === 'video') {
    return (
      <video
        className="exercise-media-engine__legacy"
        src={exercise.media_url}
        controls={expanded}
        autoPlay={!expanded}
        muted={!expanded}
        loop={!expanded}
        playsInline
        preload={expanded ? 'metadata' : 'none'}
        aria-label={`${exercise.name} demonstration`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <img
      className="exercise-media-engine__legacy"
      src={exercise.media_url}
      alt={`${exercise.name} demonstration`}
      loading={expanded ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function ExerciseTechniqueMedia({ exercise, expanded = false }: ExerciseTechniqueMediaProps) {
  const bundle = useExerciseMedia(exercise.id);
  const startAsset = selectExerciseMediaAsset(bundle, ['start']);
  const finishAsset = selectExerciseMediaAsset(bundle, ['finish']);
  const primaryAsset = selectExerciseMediaAsset(
    bundle,
    expanded
      ? ['loop', 'hero', 'start', 'finish', 'thumbnail']
      : ['thumbnail', 'loop', 'hero', 'start', 'finish'],
  );

  const showPositionPair = Boolean(
    expanded &&
    startAsset &&
    finishAsset &&
    startAsset.id !== finishAsset.id,
  );

  if (showPositionPair && startAsset && finishAsset) {
    return (
      <div className="exercise-media-engine exercise-media-engine--expanded exercise-media-engine--pair">
        <AssetSurface asset={startAsset} expanded phaseLabel="Start position" />
        <AssetSurface asset={finishAsset} expanded phaseLabel="Finish position" />
      </div>
    );
  }

  if (primaryAsset) {
    return (
      <div className={expanded ? 'exercise-media-engine exercise-media-engine--expanded' : 'exercise-media-engine'}>
        <AssetSurface asset={primaryAsset} expanded={expanded} />
      </div>
    );
  }

  if (exercise.media_url) {
    return (
      <div className={expanded ? 'exercise-media-engine exercise-media-engine--expanded' : 'exercise-media-engine'}>
        <LegacyExerciseMedia exercise={exercise} expanded={expanded} />
      </div>
    );
  }

  return (
    <div className={expanded ? 'exercise-media-engine exercise-media-engine--expanded' : 'exercise-media-engine'}>
      <ExerciseMediaPlaceholder exercise={exercise} expanded={expanded} />
    </div>
  );
}

function TechniqueList({ items, fallback }: { items: string[]; fallback?: string }) {
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

function buildTechniqueSteps(guide: ExerciseTechniqueGuide | null, exercise: Exercise): string[] {
  if (!guide) return exercise.instructions;

  const steps = [...guide.setup_steps, ...guide.execution_steps];
  return steps.length > 0 ? steps : exercise.instructions;
}

export function ExerciseTechniqueSheet({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const bundle = useExerciseMedia(exercise.id);
  const guide = bundle?.guide ?? null;
  const techniqueSteps = useMemo(() => buildTechniqueSteps(guide, exercise), [exercise, guide]);
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
          <button type="button" aria-label="Close technique guide" onClick={onClose}>×</button>
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
                {guide.start_position ? <article><strong>Start</strong><p>{guide.start_position}</p></article> : null}
                {guide.finish_position ? <article><strong>Finish</strong><p>{guide.finish_position}</p></article> : null}
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

          {guide?.breathing || guide?.tempo_guidance || muscleHighlights.length > 0 ? (
            <aside className="exercise-technique-details">
              {guide.breathing ? <div><strong>Breathing</strong><p>{guide.breathing}</p></div> : null}
              {guide.tempo_guidance ? <div><strong>Tempo</strong><p>{guide.tempo_guidance}</p></div> : null}
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
              <p>Use a controlled range of motion and stop if you feel sharp pain.</p>
            </aside>
          )}
        </div>
      </section>
    </div>
  );
}
