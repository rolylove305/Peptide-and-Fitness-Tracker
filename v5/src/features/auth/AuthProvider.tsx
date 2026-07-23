import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/client';

export type AuthStatus =
  | 'checking'
  | 'signed-out'
  | 'signed-in'
  | 'password-recovery'
  | 'misconfigured';
export type SignUpResult = 'signed-in' | 'confirmation-required';

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  error: string | null;
  clearError: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>;
  requestPasswordReset: (email: string, redirectTo: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const recoveryStorageKey = 'biotrack-password-recovery';

function readRecoveryFlag(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return window.sessionStorage.getItem(recoveryStorageKey) === '1';
  } catch {
    return false;
  }
}

function writeRecoveryFlag(active: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    if (active) window.sessionStorage.setItem(recoveryStorageKey, '1');
    else window.sessionStorage.removeItem(recoveryStorageKey);
  } catch {
    // Auth remains usable even when browser storage is unavailable.
  }
}

function currentAuthRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const url = new URL(window.location.href);
  url.hash = '';
  url.search = '';
  return url.toString();
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'checking' : 'misconfigured');
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recoveryStarted = useRef(readRecoveryFlag());

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
      if (!data.session) {
        recoveryStarted.current = false;
        writeRecoveryFlag(false);
        setStatus('signed-out');
        return;
      }

      setStatus(recoveryStarted.current ? 'password-recovery' : 'signed-in');
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) return;

      setSession(nextSession);

      if (event === 'PASSWORD_RECOVERY') {
        recoveryStarted.current = true;
        writeRecoveryFlag(true);
        setStatus('password-recovery');
        return;
      }

      if (event === 'SIGNED_OUT' || !nextSession) {
        recoveryStarted.current = false;
        writeRecoveryFlag(false);
        setStatus('signed-out');
        return;
      }

      setStatus(recoveryStarted.current ? 'password-recovery' : 'signed-in');
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

        recoveryStarted.current = false;
        writeRecoveryFlag(false);
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

        recoveryStarted.current = false;
        writeRecoveryFlag(false);
        setError(null);
        const emailRedirectTo = currentAuthRedirectUrl();
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            ...(emailRedirectTo ? { emailRedirectTo } : {}),
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
      requestPasswordReset: async (email, redirectTo) => {
        if (!supabase) {
          const configurationError = new Error('Supabase environment variables are not configured.');
          setError(configurationError.message);
          throw configurationError;
        }

        setError(null);
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          { redirectTo },
        );

        if (resetError) {
          setError(resetError.message);
          throw resetError;
        }
      },
      updatePassword: async (password) => {
        if (!supabase) {
          const configurationError = new Error('Supabase environment variables are not configured.');
          setError(configurationError.message);
          throw configurationError;
        }

        setError(null);
        const { error: updateError } = await supabase.auth.updateUser({ password });

        if (updateError) {
          setError(updateError.message);
          throw updateError;
        }

        recoveryStarted.current = false;
        writeRecoveryFlag(false);
        setStatus('signed-in');
      },
      signOut: async () => {
        if (!supabase) return;

        setError(null);
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {
          setError(signOutError.message);
          throw signOutError;
        }

        recoveryStarted.current = false;
        writeRecoveryFlag(false);
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
