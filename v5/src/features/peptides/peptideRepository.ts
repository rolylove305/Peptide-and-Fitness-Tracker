import { supabase } from '../../lib/supabase/client';
import type {
  PeptideAdministration,
  PeptideProtocol,
  TableInsert,
  TableUpdate,
} from '../../types/database';

export type RepositoryResult<T> =
  { ok: true; data: T } | { ok: false; error: string };

export type PeptideProtocolDraft = Omit<
  TableInsert<'peptide_protocols'>,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>;

function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    if (message) return message;
  }
  return fallback;
}

function unavailable<T>(): RepositoryResult<T> {
  return { ok: false, error: 'Supabase is not configured for BioTrack AI V5.' };
}

export async function loadPeptideTracker(userId: string): Promise<
  RepositoryResult<{
    protocols: PeptideProtocol[];
    administrations: PeptideAdministration[];
  }>
> {
  if (!supabase) return unavailable();

  try {
    const [protocolResult, administrationResult] = await Promise.all([
      supabase
        .from('peptide_protocols')
        .select('*')
        .eq('user_id', userId)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('peptide_administrations')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false })
        .limit(100),
    ]);

    if (protocolResult.error) throw protocolResult.error;
    if (administrationResult.error) throw administrationResult.error;

    return {
      ok: true,
      data: {
        protocols: protocolResult.data ?? [],
        administrations: administrationResult.data ?? [],
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: messageFrom(
        error,
        'BioTrack could not load your peptide records.',
      ),
    };
  }
}

export async function createPeptideProtocol(
  userId: string,
  draft: PeptideProtocolDraft,
): Promise<RepositoryResult<PeptideProtocol>> {
  if (!supabase) return unavailable();

  try {
    const { data, error } = await supabase
      .from('peptide_protocols')
      .insert({ ...draft, user_id: userId })
      .select('*')
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: messageFrom(
        error,
        'BioTrack could not save this peptide schedule.',
      ),
    };
  }
}

export async function updatePeptideProtocol(
  userId: string,
  protocolId: string,
  update: TableUpdate<'peptide_protocols'>,
): Promise<RepositoryResult<PeptideProtocol>> {
  if (!supabase) return unavailable();

  try {
    const { data, error } = await supabase
      .from('peptide_protocols')
      .update(update)
      .eq('id', protocolId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: messageFrom(
        error,
        'BioTrack could not update this peptide schedule.',
      ),
    };
  }
}

export async function recordPeptideAdministration(
  userId: string,
  protocol: PeptideProtocol,
  status: PeptideAdministration['status'],
): Promise<RepositoryResult<PeptideAdministration>> {
  if (!supabase) return unavailable();

  try {
    const payload: TableInsert<'peptide_administrations'> = {
      user_id: userId,
      protocol_id: protocol.id,
      peptide_name_snapshot: protocol.peptide_name,
      dose_amount_snapshot: protocol.dose_amount,
      dose_unit_snapshot: protocol.dose_unit,
      status,
      recorded_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('peptide_administrations')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: messageFrom(error, 'BioTrack could not record this dose.'),
    };
  }
}

export async function deletePeptideAdministration(
  userId: string,
  administrationId: string,
): Promise<RepositoryResult<null>> {
  if (!supabase) return unavailable();

  try {
    const { error } = await supabase
      .from('peptide_administrations')
      .delete()
      .eq('id', administrationId)
      .eq('user_id', userId);

    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    return {
      ok: false,
      error: messageFrom(error, 'BioTrack could not remove this dose record.'),
    };
  }
}
