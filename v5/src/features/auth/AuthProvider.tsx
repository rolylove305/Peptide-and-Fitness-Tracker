import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/client';

export type AuthStatus = 'checking' | 'signed-out' | 'signed-in' | 'misconfigured';
export type SignUpResult = 'signed-in' | 'confirmation-required';

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  error: string | null;
  clearError: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function messageFrom(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'checking' : 'misconfigured');
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setStatus('misconfigured');
      return;
    }

    const client = supabase;
    let cancelled = false;

    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (cancelled) return;

      if (sessionError) {
        setError(sessionError.message);
        setSession(null);
        setStatus('signed-out');
        return;
      }

      setSession(data.session);
      setStatus(data.session ? 'signed-in' : 'signed-out');
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      setStatus(nextSession ? 'signed-in' : 'signed-out');
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      error,
      clearError: () => setError(null),
      signIn: async (email, password) => {
        if (!supabase) {
          const configurationError = new Error('Supabase environment variables are not configured.');
          setError(configurationError.message);
          throw configurationError;
        }

        setError(null);
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (signInError) {
          setError(signInError.message);
          throw signInError;
        }
      },
      signUp: async (name, email, password) => {
        if (!supabase) {
          const configurationError = new Error('Supabase environment variables are not configured.');
          setError(configurationError.message);
          throw configurationError;
        }

        setError(null);
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: name.trim(),
            },
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          throw signUpError;
        }

        return data.session ? 'signed-in' : 'confirmation-required';
      },
      signOut: async () => {
        if (!supabase) return;

        setError(null);
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          setError(signOutError.message);
          throw signOutError;
        }
      },
    }),
    [error, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
