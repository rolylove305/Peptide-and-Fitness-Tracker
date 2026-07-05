-- Applied to Supabase project gfuazkuohrragkthtumz on 2026-07-05.
-- Purpose: make workout sync user-private and make daily logs safe to update.

alter table public.workout_plan
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.workout_plan enable row level security;

drop policy if exists "Users manage own workout_plan" on public.workout_plan;
create policy "Users manage own workout_plan"
on public.workout_plan
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.user_profiles
  add column if not exists onboarding_complete boolean default false;

create unique index if not exists user_profiles_user_id_unique on public.user_profiles(user_id);
create unique index if not exists workout_plan_user_day_unique on public.workout_plan(user_id, day_name);
create unique index if not exists daily_logs_user_date_item_unique on public.daily_logs(user_id, log_date, item_name);
create index if not exists workout_plan_user_id_idx on public.workout_plan(user_id);
create index if not exists peptide_items_user_id_idx on public.peptide_items(user_id);
create index if not exists daily_logs_user_id_log_date_idx on public.daily_logs(user_id, log_date);
create index if not exists progress_logs_user_id_log_date_idx on public.progress_logs(user_id, log_date);
create index if not exists vial_inventory_user_id_idx on public.vial_inventory(user_id);
