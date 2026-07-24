import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  defaultWorkoutProfileDraft,
  equipmentOptions,
  experienceOptions,
  focusAreaOptions,
  goalOptions,
  labelForExperience,
  labelForGoal,
  movementPreferenceOptions,
  type MovementPreference,
  type TrainingEquipment,
  type TrainingFocusArea,
  type WorkoutProfile,
  type WorkoutProfileDraft,
} from './workoutProfile';
import { useWorkoutProfile } from './WorkoutProfileProvider';

const onboardingDismissKey = 'biotrack-workout-profile-dismissed';

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(onboardingDismissKey) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.sessionStorage.setItem(onboardingDismissKey, '1');
  } catch {
    // The profile can still be completed when session storage is unavailable.
  }
}

function draftFromProfile(profile: WorkoutProfile | null): WorkoutProfileDraft {
  if (!profile) return defaultWorkoutProfileDraft();
  return {
    goal: profile.goal,
    experience: profile.experience,
    daysPerWeek: profile.daysPerWeek,
    sessionMinutes: profile.sessionMinutes,
    weightUnit: profile.weightUnit,
    equipment: [...profile.equipment],
    focusAreas: [...profile.focusAreas],
    movementPreferences: [...profile.movementPreferences],
  };
}

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function ProfileForm({
  initialProfile,
  saving,
  error,
  onboarding,
  onSave,
  onCancel,
}: {
  initialProfile: WorkoutProfile | null;
  saving: boolean;
  error: string | null;
  onboarding: boolean;
  onSave: (draft: WorkoutProfileDraft) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<WorkoutProfileDraft>(() =>
    draftFromProfile(initialProfile),
  );
  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const totalSteps = onboarding ? 3 : 1;

  useEffect(() => {
    setDraft(draftFromProfile(initialProfile));
  }, [initialProfile]);

  const progressStyle = useMemo(
    () =>
      ({
        '--profile-progress': `${((step + 1) / totalSteps) * 100}%`,
      }) as CSSProperties,
    [step, totalSteps],
  );

  function validateCurrentStep(): boolean {
    if (step === 1 && (draft.daysPerWeek < 1 || draft.daysPerWeek > 7)) {
      setLocalError('Choose between one and seven training days per week.');
      return false;
    }
    if (step === 2 && draft.equipment.length === 0) {
      setLocalError('Select at least one equipment option.');
      return false;
    }
    if (step === 2 && draft.focusAreas.length === 0) {
      setLocalError('Select at least one training focus.');
      return false;
    }
    setLocalError(null);
    return true;
  }

  async function submit() {
    if (!validateCurrentStep()) return;
    const saved = await onSave(draft);
    if (saved) setLocalError(null);
  }

  const showStep = (target: number) => !onboarding || step === target;

  return (
    <div
      className={
        onboarding
          ? 'workout-profile-form workout-profile-form--onboarding'
          : 'workout-profile-form'
      }
    >
      {onboarding ? (
        <div className="profile-step-progress" style={progressStyle}>
          <div>
            <span>
              Step {step + 1} of {totalSteps}
            </span>
            <strong>
              {step === 0
                ? 'Your objective'
                : step === 1
                  ? 'Your schedule'
                  : 'Your training setup'}
            </strong>
          </div>
          <div className="profile-progress-track">
            <span />
          </div>
        </div>
      ) : null}

      {showStep(0) ? (
        <section
          className="profile-form-section"
          aria-labelledby="profile-goal-heading"
        >
          <div className="profile-form-heading">
            <p className="eyebrow">Training direction</p>
            <h3 id="profile-goal-heading">What should BioTrack prioritize?</h3>
            <p>
              Your goal and experience influence plan ranking and future
              recommendations.
            </p>
          </div>
          <div className="profile-choice-grid profile-choice-grid--goals">
            {goalOptions.map((option) => (
              <button
                type="button"
                className={
                  draft.goal === option.value
                    ? 'profile-choice profile-choice--selected'
                    : 'profile-choice'
                }
                aria-pressed={draft.goal === option.value}
                onClick={() =>
                  setDraft((current) => ({ ...current, goal: option.value }))
                }
                key={option.value}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
          <div className="profile-choice-grid profile-choice-grid--experience">
            {experienceOptions.map((option) => (
              <button
                type="button"
                className={
                  draft.experience === option.value
                    ? 'profile-choice profile-choice--selected'
                    : 'profile-choice'
                }
                aria-pressed={draft.experience === option.value}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    experience: option.value,
                  }))
                }
                key={option.value}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {showStep(1) ? (
        <section
          className="profile-form-section"
          aria-labelledby="profile-schedule-heading"
        >
          <div className="profile-form-heading">
            <p className="eyebrow">Realistic schedule</p>
            <h3 id="profile-schedule-heading">
              Build around the time you actually have
            </h3>
            <p>
              BioTrack will favor plans closest to this schedule rather than the
              most aggressive plan.
            </p>
          </div>
          <div className="profile-number-grid">
            <label className="field">
              <span>Training days per week</span>
              <select
                value={draft.daysPerWeek}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    daysPerWeek: Number(event.target.value),
                  }))
                }
              >
                {[2, 3, 4, 5, 6].map((days) => (
                  <option value={days} key={days}>
                    {days} days
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Preferred session length</span>
              <select
                value={draft.sessionMinutes}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sessionMinutes: Number(event.target.value),
                  }))
                }
              >
                {[30, 45, 60, 75, 90].map((minutes) => (
                  <option value={minutes} key={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Default weight unit</span>
              <select
                value={draft.weightUnit}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    weightUnit: event.target.value as 'lb' | 'kg',
                  }))
                }
              >
                <option value="lb">Pounds (lb)</option>
                <option value="kg">Kilograms (kg)</option>
              </select>
            </label>
          </div>
        </section>
      ) : null}

      {showStep(2) ? (
        <section
          className="profile-form-section"
          aria-labelledby="profile-setup-heading"
        >
          <div className="profile-form-heading">
            <p className="eyebrow">Available setup</p>
            <h3 id="profile-setup-heading">What should the plan work with?</h3>
            <p>
              Choose broad preferences only. Do not enter diagnoses or private
              medical information here.
            </p>
          </div>

          <fieldset className="profile-chip-fieldset">
            <legend>Equipment available</legend>
            <div className="profile-chip-grid">
              {equipmentOptions.map((option) => (
                <button
                  type="button"
                  className={
                    draft.equipment.includes(option.value)
                      ? 'profile-chip profile-chip--selected'
                      : 'profile-chip'
                  }
                  aria-pressed={draft.equipment.includes(option.value)}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      equipment: toggleValue<TrainingEquipment>(
                        current.equipment,
                        option.value,
                      ),
                    }))
                  }
                  key={option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="profile-chip-fieldset">
            <legend>Areas to emphasize</legend>
            <div className="profile-chip-grid">
              {focusAreaOptions.map((option) => (
                <button
                  type="button"
                  className={
                    draft.focusAreas.includes(option.value)
                      ? 'profile-chip profile-chip--selected'
                      : 'profile-chip'
                  }
                  aria-pressed={draft.focusAreas.includes(option.value)}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      focusAreas: toggleValue<TrainingFocusArea>(
                        current.focusAreas,
                        option.value,
                      ),
                    }))
                  }
                  key={option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="profile-chip-fieldset">
            <legend>Movement preferences</legend>
            <div className="profile-chip-grid">
              {movementPreferenceOptions.map((option) => (
                <button
                  type="button"
                  className={
                    draft.movementPreferences.includes(option.value)
                      ? 'profile-chip profile-chip--selected'
                      : 'profile-chip'
                  }
                  aria-pressed={draft.movementPreferences.includes(
                    option.value,
                  )}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      movementPreferences: toggleValue<MovementPreference>(
                        current.movementPreferences,
                        option.value,
                      ),
                    }))
                  }
                  key={option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </section>
      ) : null}

      {localError || error ? (
        <p className="builder-message builder-message--error" role="alert">
          {localError ?? error}
        </p>
      ) : null}

      <div className="profile-form-actions">
        {onboarding && step > 0 ? (
          <button
            className="secondary-button"
            type="button"
            onClick={() => setStep((current) => current - 1)}
          >
            Back
          </button>
        ) : null}
        {onboarding && step < totalSteps - 1 ? (
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              if (validateCurrentStep()) setStep((current) => current + 1);
            }}
          >
            Continue
          </button>
        ) : (
          <button
            className="primary-button"
            type="button"
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving
              ? 'Saving profile…'
              : initialProfile
                ? 'Save profile changes'
                : 'Complete setup'}
          </button>
        )}
        {onboarding && onCancel ? (
          <button className="text-button" type="button" onClick={onCancel}>
            Do this later
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function WorkoutProfilePanel() {
  const { profile, saving, error, saveProfile } = useWorkoutProfile();
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  async function save(draft: WorkoutProfileDraft): Promise<boolean> {
    setSavedMessage(null);
    const success = await saveProfile(draft);
    if (success)
      setSavedMessage(
        'Your training profile is saved and will sync with this BioTrack account.',
      );
    return success;
  }

  return (
    <section
      className="workout-profile-page"
      aria-labelledby="workout-profile-heading"
    >
      <header className="workout-profile-page-header">
        <div>
          <p className="eyebrow">Personalization</p>
          <h2 id="workout-profile-heading">Your training profile</h2>
          <p>
            BioTrack uses these preferences to rank plans and make future
            Workout AI guidance more relevant.
          </p>
        </div>
        {profile ? (
          <div className="profile-summary-badge">
            <span>{labelForGoal(profile.goal)}</span>
            <strong>
              {profile.daysPerWeek} days · {profile.sessionMinutes} min ·{' '}
              {labelForExperience(profile.experience)}
            </strong>
          </div>
        ) : null}
      </header>

      {savedMessage ? (
        <p className="builder-message builder-message--success" role="status">
          {savedMessage}
        </p>
      ) : null}
      <ProfileForm
        initialProfile={profile}
        saving={saving}
        error={error}
        onboarding={false}
        onSave={save}
      />

      <aside className="profile-privacy-note">
        <strong>Stored with your BioTrack account</strong>
        <p>
          This version stores non-sensitive training preferences in your
          Supabase account metadata. Medical conditions and detailed injury
          notes are intentionally excluded.
        </p>
      </aside>
    </section>
  );
}

export function WorkoutProfileOnboarding() {
  const { profile, saving, error, saveProfile } = useWorkoutProfile();
  const [open, setOpen] = useState(() => !profile && !readDismissed());

  useEffect(() => {
    if (profile) setOpen(false);
  }, [profile]);

  if (!open || profile) return null;

  function dismiss() {
    writeDismissed();
    setOpen(false);
  }

  async function save(draft: WorkoutProfileDraft): Promise<boolean> {
    const success = await saveProfile(draft);
    if (success) setOpen(false);
    return success;
  }

  return (
    <div className="workout-profile-backdrop" role="presentation">
      <section
        className="workout-profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-onboarding-heading"
      >
        <header className="profile-onboarding-header">
          <div className="profile-ai-mark" aria-hidden="true">
            AI
          </div>
          <div>
            <p className="eyebrow">Workout AI setup</p>
            <h2 id="profile-onboarding-heading">
              Make BioTrack fit your real life
            </h2>
            <p>
              Answer a few training questions. You remain in control and can
              edit everything later.
            </p>
          </div>
          <button
            className="workout-completion-close"
            type="button"
            aria-label="Close setup"
            onClick={dismiss}
          >
            ×
          </button>
        </header>
        <ProfileForm
          initialProfile={null}
          saving={saving}
          error={error}
          onboarding
          onSave={save}
          onCancel={dismiss}
        />
      </section>
    </div>
  );
}
