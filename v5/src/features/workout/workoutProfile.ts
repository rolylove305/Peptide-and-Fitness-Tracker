export type TrainingGoal =
  'fat_loss' | 'muscle_gain' | 'strength' | 'general_fitness' | 'consistency';

export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';
export type TrainingEquipment =
  'full_gym' | 'machines' | 'dumbbells' | 'bands' | 'bodyweight';
export type TrainingFocusArea =
  | 'full_body'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'quads'
  | 'glutes'
  | 'hamstrings'
  | 'core';
export type MovementPreference =
  | 'low_impact'
  | 'machine_first'
  | 'minimal_floor_work'
  | 'short_sessions'
  | 'extra_warmup';

export type WorkoutProfile = {
  version: 1;
  goal: TrainingGoal;
  experience: TrainingExperience;
  daysPerWeek: number;
  sessionMinutes: number;
  weightUnit: 'lb' | 'kg';
  equipment: TrainingEquipment[];
  focusAreas: TrainingFocusArea[];
  movementPreferences: MovementPreference[];
  completedAt: string;
  updatedAt: string;
};

export type WorkoutProfileDraft = Omit<
  WorkoutProfile,
  'version' | 'completedAt' | 'updatedAt'
>;

export const workoutProfileMetadataKey = 'workout_profile_v1';

export const goalOptions: Array<{
  value: TrainingGoal;
  label: string;
  description: string;
}> = [
  {
    value: 'fat_loss',
    label: 'Lose body fat',
    description:
      'Preserve strength and build a repeatable calorie-burning routine.',
  },
  {
    value: 'muscle_gain',
    label: 'Build muscle',
    description:
      'Prioritize weekly volume, controlled progression and recovery.',
  },
  {
    value: 'strength',
    label: 'Get stronger',
    description:
      'Focus on repeatable performance and gradual load progression.',
  },
  {
    value: 'general_fitness',
    label: 'Improve overall fitness',
    description: 'Build balanced strength, mobility and work capacity.',
  },
  {
    value: 'consistency',
    label: 'Build consistency',
    description: 'Create a realistic schedule that survives busy weeks.',
  },
];

export const experienceOptions: Array<{
  value: TrainingExperience;
  label: string;
  description: string;
}> = [
  {
    value: 'beginner',
    label: 'Beginner',
    description:
      'New, returning after a long break or still building movement confidence.',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description:
      'Training consistently and comfortable with common gym exercises.',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Several years of structured training and reliable technique.',
  },
];

export const equipmentOptions: Array<{
  value: TrainingEquipment;
  label: string;
}> = [
  { value: 'full_gym', label: 'Full gym' },
  { value: 'machines', label: 'Machines' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'bands', label: 'Resistance bands' },
  { value: 'bodyweight', label: 'Bodyweight' },
];

export const focusAreaOptions: Array<{
  value: TrainingFocusArea;
  label: string;
}> = [
  { value: 'full_body', label: 'Balanced full body' },
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'quads', label: 'Quadriceps' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'core', label: 'Core' },
];

export const movementPreferenceOptions: Array<{
  value: MovementPreference;
  label: string;
}> = [
  { value: 'low_impact', label: 'Prefer low-impact movements' },
  { value: 'machine_first', label: 'Prefer machines first' },
  { value: 'minimal_floor_work', label: 'Minimize floor exercises' },
  { value: 'short_sessions', label: 'Keep sessions very efficient' },
  { value: 'extra_warmup', label: 'Include extra warm-up time' },
];

export function defaultWorkoutProfileDraft(): WorkoutProfileDraft {
  return {
    goal: 'general_fitness',
    experience: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: 45,
    weightUnit: 'lb',
    equipment: ['full_gym'],
    focusAreas: ['full_body'],
    movementPreferences: [],
  };
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function oneOf<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return typeof value === 'string' && options.includes(value as T);
}

export function parseWorkoutProfile(value: unknown): WorkoutProfile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const goals: TrainingGoal[] = [
    'fat_loss',
    'muscle_gain',
    'strength',
    'general_fitness',
    'consistency',
  ];
  const experiences: TrainingExperience[] = [
    'beginner',
    'intermediate',
    'advanced',
  ];
  const equipmentValues = equipmentOptions.map((item) => item.value);
  const focusValues = focusAreaOptions.map((item) => item.value);
  const preferenceValues = movementPreferenceOptions.map((item) => item.value);

  if (
    candidate.version !== 1 ||
    !oneOf(candidate.goal, goals) ||
    !oneOf(candidate.experience, experiences) ||
    typeof candidate.daysPerWeek !== 'number' ||
    candidate.daysPerWeek < 1 ||
    candidate.daysPerWeek > 7 ||
    typeof candidate.sessionMinutes !== 'number' ||
    candidate.sessionMinutes < 15 ||
    candidate.sessionMinutes > 180 ||
    !oneOf(candidate.weightUnit, ['lb', 'kg'] as const) ||
    !isStringArray(candidate.equipment) ||
    !candidate.equipment.every((item) =>
      equipmentValues.includes(item as TrainingEquipment),
    ) ||
    !isStringArray(candidate.focusAreas) ||
    !candidate.focusAreas.every((item) =>
      focusValues.includes(item as TrainingFocusArea),
    ) ||
    !isStringArray(candidate.movementPreferences) ||
    !candidate.movementPreferences.every((item) =>
      preferenceValues.includes(item as MovementPreference),
    ) ||
    typeof candidate.completedAt !== 'string' ||
    typeof candidate.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    version: 1,
    goal: candidate.goal,
    experience: candidate.experience,
    daysPerWeek: Math.round(candidate.daysPerWeek),
    sessionMinutes: Math.round(candidate.sessionMinutes),
    weightUnit: candidate.weightUnit,
    equipment: candidate.equipment as TrainingEquipment[],
    focusAreas: candidate.focusAreas as TrainingFocusArea[],
    movementPreferences: candidate.movementPreferences as MovementPreference[],
    completedAt: candidate.completedAt,
    updatedAt: candidate.updatedAt,
  };
}

export function labelForGoal(goal: TrainingGoal): string {
  return goalOptions.find((item) => item.value === goal)?.label ?? goal;
}

export function labelForExperience(experience: TrainingExperience): string {
  return (
    experienceOptions.find((item) => item.value === experience)?.label ??
    experience
  );
}
