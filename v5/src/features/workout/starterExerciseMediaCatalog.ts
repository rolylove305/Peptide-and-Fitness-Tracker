import phaseTwoExerciseMediaManifest from './phase2ExerciseMediaManifest.json';

export const starterExerciseMediaRoles = ['hero', 'start', 'finish'] as const;

export type StarterExerciseMediaRole = (typeof starterExerciseMediaRoles)[number];

export type StarterExerciseMediaImage = {
  url: string;
  alt: string;
  width: number;
  height: number;
};

export type StarterExerciseMediaEntry = {
  slug: string;
  images: Record<StarterExerciseMediaRole, StarterExerciseMediaImage>;
};

type PhaseTwoExerciseMediaManifestEntry = {
  slug: string;
  alts: Record<StarterExerciseMediaRole, string>;
};

const mediaBasePath = `${import.meta.env.BASE_URL}exercise-media`;

function starterEntry(
  slug: string,
  alts: Record<StarterExerciseMediaRole, string>,
  source: 'individual' | 'generated' = 'individual',
): StarterExerciseMediaEntry {
  const images = {} as Record<StarterExerciseMediaRole, StarterExerciseMediaImage>;
  for (const role of starterExerciseMediaRoles) {
    const relativePath =
      source === 'generated'
        ? `generated/${slug}/${role}.svg`
        : `${slug}/${role}.svg`;

    images[role] = {
      url: `${mediaBasePath}/${relativePath}`,
      alt: alts[role],
      width: 800,
      height: 450,
    };
  }
  return { slug, images };
}

const phaseTwoEntries = (
  phaseTwoExerciseMediaManifest as readonly PhaseTwoExerciseMediaManifestEntry[]
).map((entry) => starterEntry(entry.slug, entry.alts, 'generated'));

const entries: readonly StarterExerciseMediaEntry[] = [
  starterEntry('goblet-squat', {
    hero: 'Athlete silhouette performing a goblet squat while holding a kettlebell at the chest',
    start: 'Goblet squat start position: standing tall with the kettlebell held at chest height',
    finish: 'Goblet squat finish position: hips lowered until the thighs are parallel to the floor',
  }),
  starterEntry('push-up', {
    hero: 'Athlete silhouette performing a push-up in a straight-body plank over the floor',
    start: 'Push-up start position: high plank with arms extended and body in a straight line',
    finish: 'Push-up finish position: chest lowered close to the floor with elbows bent',
  }),
  starterEntry('incline-dumbbell-press', {
    hero: 'Athlete silhouette pressing dumbbells upward while lying on an incline bench',
    start: 'Incline dumbbell press start position: dumbbells held at shoulder level on the incline bench',
    finish: 'Incline dumbbell press finish position: arms extended with the dumbbells pressed overhead',
  }),
  starterEntry('lat-pulldown', {
    hero: 'Athlete silhouette pulling a cable bar downward on a lat pulldown machine',
    start: 'Lat pulldown start position: seated with arms extended overhead gripping the bar',
    finish: 'Lat pulldown finish position: bar pulled down to the upper chest with elbows driven back',
  }),
  starterEntry('seated-cable-row', {
    hero: 'Athlete silhouette rowing a cable handle toward the torso on a seated row station',
    start: 'Seated cable row start position: arms extended toward the low pulley with an upright torso',
    finish: 'Seated cable row finish position: handle pulled to the torso with the elbow drawn behind the body',
  }),
  starterEntry('romanian-deadlift', {
    hero: 'Athlete silhouette hinging at the hips while holding a loaded barbell',
    start: 'Romanian deadlift start position: standing upright with the barbell in front of the hips',
    finish: 'Romanian deadlift finish position: hips pushed back with the barbell lowered to mid-shin',
  }),
  starterEntry('leg-press', {
    hero: 'Athlete silhouette pressing the platform of a 45-degree leg press machine',
    start: 'Leg press start position: seated with knees bent and feet flat on the platform',
    finish: 'Leg press finish position: legs extended pushing the platform away from the body',
  }),
  starterEntry('dumbbell-lateral-raise', {
    hero: 'Athlete silhouette raising a pair of dumbbells out to the sides at mid height',
    start: 'Dumbbell lateral raise start position: standing with the dumbbells at the sides of the body',
    finish: 'Dumbbell lateral raise finish position: arms raised out to shoulder height',
  }),
  ...phaseTwoEntries,
];

const entriesBySlug: ReadonlyMap<string, StarterExerciseMediaEntry> = new Map(
  entries.map((entry) => [entry.slug, entry]),
);

export const starterExerciseMediaSlugs: readonly string[] = entries.map((entry) => entry.slug);

export function getStarterExerciseMedia(slug: string): StarterExerciseMediaEntry | null {
  return entriesBySlug.get(slug) ?? null;
}
