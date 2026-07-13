import { useEffect, useState } from 'react';
import type {
  ActiveWorkoutExercise,
  ActiveWorkoutSession,
  WorkoutSessionDetailsInput,
} from './repositories/activeWorkoutRepository';

type SessionDetailsEditorProps = {
  session: ActiveWorkoutSession;
  saving: boolean;
  onSave: (input: WorkoutSessionDetailsInput) => Promise<boolean>;
};

export function SessionDetailsEditor({ session, saving, onSave }: SessionDetailsEditorProps) {
  const [bodyWeight, setBodyWeight] = useState(session.body_weight?.toString() ?? '');
  const [notes, setNotes] = useState(session.notes ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBodyWeight(session.body_weight?.toString() ?? '');
    setNotes(session.notes ?? '');
  }, [session.body_weight, session.id, session.notes]);

  async function submit() {
    setError(null);
    setMessage(null);
    const parsedWeight = bodyWeight.trim() === '' ? null : Number(bodyWeight);
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight < 0 || parsedWeight > 2000)) {
      setError('Enter a valid body weight or leave it blank.');
      return;
    }

    const saved = await onSave({
      bodyWeight: parsedWeight,
      weightUnit: session.weight_unit,
      notes: notes.trim() || null,
    });
    if (saved) setMessage('Workout details saved.');
  }

  return (
    <details className="live-workout-details">
      <summary>
        <span>
          <strong>Workout details</strong>
          <small>Body weight and notes for this session</small>
        </span>
        <span aria-hidden="true">＋</span>
      </summary>
      <div className="live-workout-details-body">
        <div className="live-workout-details-grid">
          <label>
            <span>Body weight ({session.weight_unit})</span>
            <input
              type="number"
              min={0}
              max={2000}
              step="0.1"
              inputMode="decimal"
              value={bodyWeight}
              placeholder="Optional"
              onChange={(event) => setBodyWeight(event.target.value)}
            />
          </label>
          <div className="live-workout-unit-note">
            <span>Workout unit</span>
            <strong>{session.weight_unit}</strong>
            <small>Change this in Profile before starting a new session.</small>
          </div>
        </div>
        <label>
          <span>Session notes</span>
          <textarea
            rows={3}
            maxLength={1200}
            value={notes}
            placeholder="Energy, equipment changes, how the workout felt…"
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <div className="live-workout-details-actions">
          <button className="secondary-button" type="button" disabled={saving} onClick={() => void submit()}>
            {saving ? 'Saving…' : 'Save workout details'}
          </button>
          {message ? <span className="flex-save-message">{message}</span> : null}
        </div>
        {error ? <p className="builder-message builder-message--error" role="alert">{error}</p> : null}
      </div>
    </details>
  );
}

type ExerciseNotesEditorProps = {
  exercise: ActiveWorkoutExercise;
  saving: boolean;
  onSave: (notes: string | null) => Promise<boolean>;
};

export function ExerciseNotesEditor({ exercise, saving, onSave }: ExerciseNotesEditorProps) {
  const [notes, setNotes] = useState(exercise.notes ?? '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNotes(exercise.notes ?? '');
    setSaved(false);
  }, [exercise.id, exercise.notes]);

  async function submit() {
    setSaved(false);
    const success = await onSave(notes.trim() || null);
    if (success) setSaved(true);
  }

  return (
    <details className="live-exercise-notes" defaultOpen={Boolean(exercise.notes)}>
      <summary>
        <span>{exercise.notes ? 'Exercise note saved' : 'Add exercise note'}</span>
        <span aria-hidden="true">＋</span>
      </summary>
      <div>
        <textarea
          rows={2}
          maxLength={600}
          value={notes}
          placeholder="Seat position, grip, machine number, technique cue…"
          onChange={(event) => {
            setNotes(event.target.value);
            setSaved(false);
          }}
        />
        <div className="live-exercise-note-actions">
          <button type="button" disabled={saving} onClick={() => void submit()}>
            {saving ? 'Saving…' : 'Save note'}
          </button>
          {saved ? <span className="flex-save-message">Saved</span> : null}
        </div>
      </div>
    </details>
  );
}
