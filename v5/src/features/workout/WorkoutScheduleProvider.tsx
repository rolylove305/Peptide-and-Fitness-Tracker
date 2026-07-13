import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthProvider';
import {
  parseWorkoutSchedule,
  workoutScheduleMetadataKey,
  type WorkoutSchedule,
  type WorkoutScheduleDraft,
} from './workoutSchedule';

type WorkoutScheduleContextValue = {
  schedule: WorkoutSchedule | null;
  saving: boolean;
  error: string | null;
  saveSchedule: (draft: WorkoutScheduleDraft) => Promise<boolean>;
  clearError: () => void;
};

const WorkoutScheduleContext = createContext<WorkoutScheduleContextValue | undefined>(undefined);

function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    if (message) return message;
  }
  return 'BioTrack could not save your weekly workout schedule.';
}

export function WorkoutScheduleProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<WorkoutSchedule | null>(() =>
    parseWorkoutSchedule(user?.user_metadata?.[workoutScheduleMetadataKey]),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSchedule(parseWorkoutSchedule(user?.user_metadata?.[workoutScheduleMetadataKey]));
  }, [user]);

  const value = useMemo<WorkoutScheduleContextValue>(
    () => ({
      schedule,
      saving,
      error,
      clearError: () => setError(null),
      saveSchedule: async (draft) => {
        if (!supabase || !user) {
          setError('A signed-in BioTrack account is required to save a workout schedule.');
          return false;
        }

        const nextSchedule: WorkoutSchedule = {
          version: 1,
          assignments: draft.assignments,
          updatedAt: new Date().toISOString(),
        };

        setSaving(true);
        setError(null);
        try {
          const { data: currentUserData, error: currentUserError } = await supabase.auth.getUser();
          if (currentUserError) throw currentUserError;
          const currentMetadata = currentUserData.user?.user_metadata ?? user.user_metadata;
          const { data, error: updateError } = await supabase.auth.updateUser({
            data: {
              ...currentMetadata,
              [workoutScheduleMetadataKey]: nextSchedule,
            },
          });
          if (updateError) throw updateError;

          const savedSchedule = parseWorkoutSchedule(
            data.user.user_metadata?.[workoutScheduleMetadataKey],
          );
          if (!savedSchedule) throw new Error('The saved workout schedule could not be verified.');
          setSchedule(savedSchedule);
          return true;
        } catch (caughtError) {
          setError(messageFrom(caughtError));
          return false;
        } finally {
          setSaving(false);
        }
      },
    }),
    [error, saving, schedule, user],
  );

  return (
    <WorkoutScheduleContext.Provider value={value}>
      {children}
    </WorkoutScheduleContext.Provider>
  );
}

export function useWorkoutSchedule(): WorkoutScheduleContextValue {
  const context = useContext(WorkoutScheduleContext);
  if (!context) {
    throw new Error('useWorkoutSchedule must be used inside WorkoutScheduleProvider.');
  }
  return context;
}
