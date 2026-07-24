-- This file is a repository record only. Apply through the Supabase connector before advancing V5.

create table if not exists public.client_error_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  error_kind text not null check (char_length(error_kind) between 1 and 64),
  message text not null check (char_length(message) between 1 and 500),
  component_stack text,
  route text not null default '/',
  build_id text,
  online boolean not null default true,
  user_agent text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.client_error_events enable row level security;

create policy "Users can insert their own client errors"
on public.client_error_events
for insert
to authenticated
with check (user_id = auth.uid());

create index if not exists client_error_events_user_created_idx
on public.client_error_events (user_id, created_at desc);

create index if not exists client_error_events_created_idx
on public.client_error_events (created_at desc);

comment on table public.client_error_events is
  'Minimal authenticated client diagnostics. Contains no workout values, notes, health data, or credentials.';
