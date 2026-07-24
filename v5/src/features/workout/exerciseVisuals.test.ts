import { describe, expect, it } from 'vitest';
import type { Exercise } from '../../types/database';
import type { ExerciseMediaAsset, ExerciseMediaBundle } from './exerciseMedia';
import { resolveExerciseVisuals } from './exerciseVisuals';
import { professionalExerciseMediaSlugs } from './professionalExerciseMediaCatalog';

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'exercise-1',
    name: 'Goblet Squat',
    slug: 'goblet-squat',
    media_url: null,
    media_type: 'image',
    ...overrides,
  } as Exercise;
}

function remoteAsset(
  role: ExerciseMediaAsset['media_role'],
  url: string,
): ExerciseMediaAsset {
  return {
    id: `remote-${role}`,
    exercise_id: 'exercise-1',
    media_kind: 'image',
    media_role: role,
    url,
    poster_url: null,
    alt_text: `Remote ${role}`,
    width: 1200,
    height: 675,
    duration_ms: null,
    sort_order: 0,
    is_primary: role === 'hero',
    is_active: true,
    rights_status: 'owned',
    license_reference: null,
    content_hash: null,
    metadata: {},
    created_at: '2026-07-23T00:00:00.000Z',
    updated_at: '2026-07-23T00:00:00.000Z',
  };
}

function bundle(assets: ExerciseMediaAsset[]): ExerciseMediaBundle {
  return {
    exerciseId: 'exercise-1',
    assets,
    guide: null,
  };
}

describe('professional exercise visuals', () => {
  it('covers all 35 active starter exercises without duplicate slugs', () => {
    expect(professionalExerciseMediaSlugs).toHaveLength(35);
    expect(new Set(professionalExerciseMediaSlugs)).toHaveLength(35);
  });

  it('uses the professional composite before the starter illustrations', () => {
    const visuals = resolveExerciseVisuals(exercise(), null, {
      expanded: true,
    });

    expect(visuals.primary).toMatchObject({
      source: 'professional',
      kind: 'image',
      width: 800,
      height: 450,
    });
    expect(visuals.primary?.url).toContain(
      '/exercise-media/professional/goblet-squat/hero.jpg',
    );
    expect(visuals.start).toBeNull();
    expect(visuals.finish).toBeNull();
  });

  it('keeps active remote media ahead of the professional fallback', () => {
    const visuals = resolveExerciseVisuals(
      exercise(),
      bundle([
        remoteAsset('hero', 'https://media.example/hero.jpg'),
        remoteAsset('start', 'https://media.example/start.jpg'),
        remoteAsset('finish', 'https://media.example/finish.jpg'),
      ]),
      { expanded: true },
    );

    expect(visuals.primary?.url).toBe('https://media.example/hero.jpg');
    expect(visuals.start?.url).toBe('https://media.example/start.jpg');
    expect(visuals.finish?.url).toBe('https://media.example/finish.jpg');
  });
});
