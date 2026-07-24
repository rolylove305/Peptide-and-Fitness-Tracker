import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

export const supabaseConfiguration = {
  isConfigured: Boolean(supabaseUrl && supabasePublishableKey),
  projectUrl: supabaseUrl,
} as const;

export const supabase: SupabaseClient<Database> | null =
  supabaseConfiguration.isConfigured
    ? createClient<Database>(supabaseUrl, supabasePublishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
