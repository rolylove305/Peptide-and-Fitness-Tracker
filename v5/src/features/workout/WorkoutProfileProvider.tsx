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
  parseWorkoutProfile,
  workoutProfileMetadataKey,
  type WorkoutProfile,
  type WorkoutProfileDraft,
} from './workoutProfile';
import { emitWorkoutProfileCompleted } from './workoutProfileEvents';

type WorkoutProfileContextValue = {
  profile: WorkoutProfile | null;
  saving: boolean;
  error: string | null;
  saveProfile: (draft: WorkoutProfileDraft) => Promise<boolean>;
  clearError: () => void;
};

const WorkoutProfileContext = createContext<WorkoutProfileContextValue | undefined>(undefined);

function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    if (message) return message;
  }
  return 'BioTrack could not save your training profile.';
}

export function WorkoutProfileProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<WorkoutProfile | null>(() =>
    parseWorkoutProfile(user?.user_metadata?.[workoutProfileMetadataKey]),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfile(parseWorkoutProfile(user?.user_metadata?.[workoutProfileMetadataKey]));
  }, [user]);

  const value = useMemo<WorkoutProfileContextValue>(
    () => ({
      profile,
      saving,
      error,
      clearError: () => setError(null),
      saveProfile: async (draft) => {
        if (!supabase || !user) {
          setError('A signed-in BioTrack account is required to save this profile.');
          return false;
        }

        const now = new Date().toISOString();
        const nextProfile: WorkoutProfile = {
          version: 1,
          ...draft,
          completedAt: profile?.completedAt ?? now,
          updatedAt: now,
        };
        const isFirstProfile = profile === null;

        setSaving(true);
        setError(null);
        try {
          const { data, error: updateError } = await supabase.auth.updateUser({
            data: {
              ...user.user_metadata,
              [workoutProfileMetadataKey]: nextProfile,
            },
          });
          if (updateError) throw updateError;

          const savedProfile = parseWorkoutProfile(
            data.user.user_metadata?.[workoutProfileMetadataKey],
          );
          if (!savedProfile) throw new Error('The saved profile could not be verified.');
          setProfile(savedProfile);
          if (isFirstProfile) emitWorkoutProfileCompleted(savedProfile);
          return true;
        } catch (caughtError) {
          setError(messageFrom(caughtError));
          return false;
        } finally {
          setSaving(false);
        }
      },
    }),
    [error, profile, saving, user],
  );

  return (
    <WorkoutProfileContext.Provider value={value}>
      {children}
    </WorkoutProfileContext.Provider>
  );
}

export function useWorkoutProfile(): WorkoutProfileContextValue {
  const context = useContext(WorkoutProfileContext);
  if (!context) {
    throw new Error('useWorkoutProfile must be used inside WorkoutProfileProvider.');
  }
  return context;
}
