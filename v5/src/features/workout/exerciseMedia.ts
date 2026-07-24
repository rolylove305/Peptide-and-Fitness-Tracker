import type { Json } from '../../types/database';

export const exerciseMediaKinds = ['image', 'gif', 'video'] as const;
export const exerciseMediaRoles = [
  'hero',
  'thumbnail',
  'start',
  'finish',
  'loop',
  'muscle_map',
  'mistake',
] as const;
export const exerciseMediaRightsStatuses = [
  'owned',
  'licensed',
  'generated',
] as const;
export const exerciseTechniqueStatuses = [
  'draft',
  'published',
  'retired',
] as const;
export const exerciseTechniqueSources = [
  'editorial',
  'imported',
  'ai_assisted',
] as const;

export type ExerciseMediaKind = (typeof exerciseMediaKinds)[number];
export type ExerciseMediaRole = (typeof exerciseMediaRoles)[number];
export type ExerciseMediaRightsStatus =
  (typeof exerciseMediaRightsStatuses)[number];
export type ExerciseTechniqueStatus =
  (typeof exerciseTechniqueStatuses)[number];
export type ExerciseTechniqueSource = (typeof exerciseTechniqueSources)[number];

export type ExerciseMediaAsset = {
  id: string;
  exercise_id: string;
  media_kind: ExerciseMediaKind;
  media_role: ExerciseMediaRole;
  url: string;
  poster_url: string | null;
  alt_text: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  sort_order: number;
  is_primary: boolean;
  is_active: boolean;
  rights_status: ExerciseMediaRightsStatus;
  license_reference: string | null;
  content_hash: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type ExerciseTechniqueGuide = {
  exercise_id: string;
  start_position: string | null;
  finish_position: string | null;
  setup_steps: string[];
  execution_steps: string[];
  coaching_cues: string[];
  common_mistakes: string[];
  safety_notes: string[];
  breathing: string | null;
  tempo_guidance: string | null;
  muscle_highlights: Json;
  content_source: ExerciseTechniqueSource;
  status: ExerciseTechniqueStatus;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ExerciseMediaBundle = {
  exerciseId: string;
  assets: ExerciseMediaAsset[];
  guide: ExerciseTechniqueGuide | null;
};

export type ExerciseMediaLibrary = ReadonlyMap<string, ExerciseMediaBundle>;

export function selectExerciseMediaAsset(
  bundle: ExerciseMediaBundle | null | undefined,
  preferredRoles: readonly ExerciseMediaRole[],
): ExerciseMediaAsset | null {
  if (!bundle) return null;

  const activeAssets = bundle.assets
    .filter((asset) => asset.is_active)
    .sort((left, right) => {
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;
      return (
        left.sort_order - right.sort_order ||
        left.created_at.localeCompare(right.created_at)
      );
    });

  for (const role of preferredRoles) {
    const match = activeAssets.find((asset) => asset.media_role === role);
    if (match) return match;
  }

  return activeAssets[0] ?? null;
}

export function hasRenderableExerciseMedia(
  bundle: ExerciseMediaBundle | null | undefined,
): boolean {
  return Boolean(
    bundle?.assets.some((asset) => asset.is_active && asset.url.length > 0),
  );
}

export function getTechniqueSummary(
  bundle: ExerciseMediaBundle | null | undefined,
): string | null {
  const guide = bundle?.guide;
  if (!guide) return null;

  return (
    guide.execution_steps[0] ??
    guide.coaching_cues[0] ??
    guide.setup_steps[0] ??
    guide.start_position ??
    null
  );
}

export function getMuscleHighlightLabels(value: Json): string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (typeof item === 'string' && item.trim()) return [item.trim()];
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];

    const label = item.name ?? item.label ?? item.muscle;
    return typeof label === 'string' && label.trim() ? [label.trim()] : [];
  });
}
