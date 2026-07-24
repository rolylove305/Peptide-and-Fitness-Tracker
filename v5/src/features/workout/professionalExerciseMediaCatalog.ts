import { starterExerciseMediaSlugs } from './starterExerciseMediaCatalog';

export type ProfessionalExerciseMediaImage = {
  url: string;
  width: number;
  height: number;
};

const mediaBasePath = `${import.meta.env.BASE_URL}exercise-media/professional`;
const supportedSlugs = new Set(starterExerciseMediaSlugs);

export const professionalExerciseMediaSlugs: readonly string[] = [
  ...starterExerciseMediaSlugs,
];

export function getProfessionalExerciseMedia(
  slug: string,
): ProfessionalExerciseMediaImage | null {
  if (!supportedSlugs.has(slug)) return null;

  return {
    url: `${mediaBasePath}/${slug}/hero.jpg`,
    width: 800,
    height: 450,
  };
}
