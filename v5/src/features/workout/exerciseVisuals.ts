import type { Exercise } from '../../types/database';
import {
  hasRenderableExerciseMedia,
  selectExerciseMediaAsset,
  type ExerciseMediaAsset,
  type ExerciseMediaBundle,
  type ExerciseMediaRole,
} from './exerciseMedia';
import {
  getStarterExerciseMedia,
  type StarterExerciseMediaImage,
  type StarterExerciseMediaRole,
} from './starterExerciseMediaCatalog';

export type ExerciseVisualSource = 'remote' | 'starter' | 'legacy';

export type ExerciseVisual = {
  source: ExerciseVisualSource;
  kind: 'image' | 'gif' | 'video';
  url: string;
  posterUrl: string | null;
  alt: string;
  width: number | null;
  height: number | null;
};

export type ExerciseVisualSet = {
  primary: ExerciseVisual | null;
  start: ExerciseVisual | null;
  finish: ExerciseVisual | null;
};

const expandedPrimaryRoles: readonly ExerciseMediaRole[] = ['loop', 'hero', 'start', 'finish', 'thumbnail'];
const previewPrimaryRoles: readonly ExerciseMediaRole[] = ['thumbnail', 'loop', 'hero', 'start', 'finish'];

function fromRemoteAsset(asset: ExerciseMediaAsset): ExerciseVisual {
  return {
    source: 'remote',
    kind: asset.media_kind,
    url: asset.url,
    posterUrl: asset.poster_url,
    alt: asset.alt_text,
    width: asset.width,
    height: asset.height,
  };
}

function fromStarterImage(image: StarterExerciseMediaImage): ExerciseVisual {
  return {
    source: 'starter',
    kind: 'image',
    url: image.url,
    posterUrl: null,
    alt: image.alt,
    width: image.width,
    height: image.height,
  };
}

function fromLegacyMedia(exercise: Exercise): ExerciseVisual | null {
  if (!exercise.media_url) return null;

  return {
    source: 'legacy',
    kind: exercise.media_type === 'video' ? 'video' : 'image',
    url: exercise.media_url,
    posterUrl: null,
    alt: `${exercise.name} demonstration`,
    width: null,
    height: null,
  };
}

function resolveRole(
  exercise: Exercise,
  bundle: ExerciseMediaBundle | null | undefined,
  remoteRoles: readonly ExerciseMediaRole[],
  starterRole: StarterExerciseMediaRole,
): ExerciseVisual | null {
  const remoteAsset = selectExerciseMediaAsset(bundle, remoteRoles);
  if (remoteAsset && remoteRoles.includes(remoteAsset.media_role)) {
    return fromRemoteAsset(remoteAsset);
  }

  const starterEntry = getStarterExerciseMedia(exercise.slug);
  if (starterEntry) return fromStarterImage(starterEntry.images[starterRole]);

  return null;
}

export function resolveExerciseVisuals(
  exercise: Exercise,
  bundle: ExerciseMediaBundle | null | undefined,
  options: { expanded?: boolean } = {},
): ExerciseVisualSet {
  const primaryRoles = options.expanded ? expandedPrimaryRoles : previewPrimaryRoles;

  const remotePrimary = selectExerciseMediaAsset(bundle, primaryRoles);
  const starterEntry = getStarterExerciseMedia(exercise.slug);
  const primary =
    (remotePrimary ? fromRemoteAsset(remotePrimary) : null) ??
    (starterEntry ? fromStarterImage(starterEntry.images.hero) : null) ??
    fromLegacyMedia(exercise);

  return {
    primary,
    start: resolveRole(exercise, bundle, ['start'], 'start'),
    finish: resolveRole(exercise, bundle, ['finish'], 'finish'),
  };
}

export function hasExerciseVisual(
  exercise: Exercise,
  bundle: ExerciseMediaBundle | null | undefined,
): boolean {
  return (
    hasRenderableExerciseMedia(bundle) ||
    getStarterExerciseMedia(exercise.slug) !== null ||
    Boolean(exercise.media_url)
  );
}
