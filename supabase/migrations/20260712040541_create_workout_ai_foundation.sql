begin;

create table public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  primary_muscle_group text not null check (char_length(btrim(primary_muscle_group)) between 2 and 60),
  secondary_muscle_groups text[] not null default '{}',
  equipment text[] not null default '{}',
  instructions text[] not null default '{}',
  media_url text,
  media_type text check (media_type is null or media_type in ('image', 'gif', 'video')),
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text,
  goal text,
  difficulty text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  source text not null default 'user' check (source in ('user', 'ai', 'template')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_routine_days (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.workout_routines(id) on delete cascade,
  day_order integer not null check (day_order between 1 and 31),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  focus text,
  focus_muscle_groups text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (routine_id, day_order)
);

create table public.workout_routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_day_id uuid not null references public.workout_routine_days(id) on delete cascade,
  exercise_id uuid not null references public.exercise_library(id) on delete restrict,
  exercise_order integer not null check (exercise_order between 1 and 100),
  target_sets integer not null default 3 check (target_sets between 1 and 20),
  target_reps_min integer check (target_reps_min is null or target_reps_min between 1 and 1000),
  target_reps_max integer check (target_reps_max is null or target_reps_max between 1 and 1000),
  target_rest_seconds integer not null default 90 check (target_rest_seconds between 0 and 3600),
  tempo text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (routine_day_id, exercise_order),
  check (target_reps_min is null or target_reps_max is null or target_reps_max >= target_reps_min)
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_day_id uuid references public.workout_routine_days(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  status text not null default 'in_progress' check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  body_weight numeric(8,2) check (body_weight is null or body_weight >= 0),
  weight_unit text not null default 'lb' check (weight_unit in ('lb', 'kg')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or completed_at >= started_at),
  check (status <> 'completed' or completed_at is not null)
);

create table public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercise_library(id) on delete restrict,
  exercise_order integer not null check (exercise_order between 1 and 100),
  exercise_name_snapshot text not null check (char_length(btrim(exercise_name_snapshot)) between 2 and 120),
  primary_muscle_group_snapshot text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, exercise_order)
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references public.workout_session_exercises(id) on delete cascade,
  set_number integer not null check (set_number between 1 and 100),
  weight numeric(10,2) check (weight is null or weight >= 0),
  weight_unit text not null default 'lb' check (weight_unit in ('lb', 'kg')),
  reps integer check (reps is null or reps between 0 and 10000),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 86400),
  distance numeric(12,3) check (distance is null or distance >= 0),
  distance_unit text check (distance_unit is null or distance_unit in ('mi', 'km', 'm', 'yd', 'ft')),
  rpe numeric(3,1) check (rpe is null or rpe between 1 and 10),
  is_warmup boolean not null default false,
  is_completed boolean not null default false,
  rest_seconds_actual integer check (rest_seconds_actual is null or rest_seconds_actual between 0 and 7200),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_exercise_id, set_number)
);

create index exercise_library_primary_muscle_idx on public.exercise_library(primary_muscle_group) where is_active;
create index exercise_library_secondary_muscles_gin on public.exercise_library using gin(secondary_muscle_groups);
create index exercise_library_equipment_gin on public.exercise_library using gin(equipment);
create index workout_routines_user_active_idx on public.workout_routines(user_id, is_active, updated_at desc);
create index workout_routine_days_routine_idx on public.workout_routine_days(routine_id, day_order);
create index workout_routine_exercises_day_idx on public.workout_routine_exercises(routine_day_id, exercise_order);
create index workout_routine_exercises_exercise_idx on public.workout_routine_exercises(exercise_id);
create index workout_sessions_user_started_idx on public.workout_sessions(user_id, started_at desc);
create index workout_sessions_user_open_idx on public.workout_sessions(user_id, status, started_at desc) where status in ('planned', 'in_progress');
create index workout_sessions_routine_day_idx on public.workout_sessions(routine_day_id);
create index workout_session_exercises_session_idx on public.workout_session_exercises(session_id, exercise_order);
create index workout_session_exercises_exercise_idx on public.workout_session_exercises(exercise_id);
create index workout_sets_session_exercise_idx on public.workout_sets(session_exercise_id, set_number);
create index workout_sets_completed_idx on public.workout_sets(completed_at desc) where is_completed;

create or replace function public.biotrack_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger exercise_library_set_updated_at before update on public.exercise_library
for each row execute function public.biotrack_set_updated_at();
create trigger workout_routines_set_updated_at before update on public.workout_routines
for each row execute function public.biotrack_set_updated_at();
create trigger workout_routine_days_set_updated_at before update on public.workout_routine_days
for each row execute function public.biotrack_set_updated_at();
create trigger workout_routine_exercises_set_updated_at before update on public.workout_routine_exercises
for each row execute function public.biotrack_set_updated_at();
create trigger workout_sessions_set_updated_at before update on public.workout_sessions
for each row execute function public.biotrack_set_updated_at();
create trigger workout_session_exercises_set_updated_at before update on public.workout_session_exercises
for each row execute function public.biotrack_set_updated_at();
create trigger workout_sets_set_updated_at before update on public.workout_sets
for each row execute function public.biotrack_set_updated_at();

alter table public.exercise_library enable row level security;
alter table public.workout_routines enable row level security;
alter table public.workout_routine_days enable row level security;
alter table public.workout_routine_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_sets enable row level security;

revoke all on public.exercise_library from anon;
revoke all on public.workout_routines from anon;
revoke all on public.workout_routine_days from anon;
revoke all on public.workout_routine_exercises from anon;
revoke all on public.workout_sessions from anon;
revoke all on public.workout_session_exercises from anon;
revoke all on public.workout_sets from anon;

grant select on public.exercise_library to authenticated;
grant select, insert, update, delete on public.workout_routines to authenticated;
grant select, insert, update, delete on public.workout_routine_days to authenticated;
grant select, insert, update, delete on public.workout_routine_exercises to authenticated;
grant select, insert, update, delete on public.workout_sessions to authenticated;
grant select, insert, update, delete on public.workout_session_exercises to authenticated;
grant select, insert, update, delete on public.workout_sets to authenticated;

grant all on public.exercise_library to service_role;
grant all on public.workout_routines to service_role;
grant all on public.workout_routine_days to service_role;
grant all on public.workout_routine_exercises to service_role;
grant all on public.workout_sessions to service_role;
grant all on public.workout_session_exercises to service_role;
grant all on public.workout_sets to service_role;

create policy "Authenticated users can read exercise library"
on public.exercise_library for select
to authenticated
using (true);

create policy "Users can read own workout routines"
on public.workout_routines for select
to authenticated
using ((select auth.uid()) = user_id);
create policy "Users can create own workout routines"
on public.workout_routines for insert
to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users can update own workout routines"
on public.workout_routines for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "Users can delete own workout routines"
on public.workout_routines for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own routine days"
on public.workout_routine_days for select
to authenticated
using (exists (
  select 1 from public.workout_routines r
  where r.id = routine_id and r.user_id = (select auth.uid())
));
create policy "Users can create own routine days"
on public.workout_routine_days for insert
to authenticated
with check (exists (
  select 1 from public.workout_routines r
  where r.id = routine_id and r.user_id = (select auth.uid())
));
create policy "Users can update own routine days"
on public.workout_routine_days for update
to authenticated
using (exists (
  select 1 from public.workout_routines r
  where r.id = routine_id and r.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.workout_routines r
  where r.id = routine_id and r.user_id = (select auth.uid())
));
create policy "Users can delete own routine days"
on public.workout_routine_days for delete
to authenticated
using (exists (
  select 1 from public.workout_routines r
  where r.id = routine_id and r.user_id = (select auth.uid())
));

create policy "Users can read own routine exercises"
on public.workout_routine_exercises for select
to authenticated
using (exists (
  select 1
  from public.workout_routine_days d
  join public.workout_routines r on r.id = d.routine_id
  where d.id = routine_day_id and r.user_id = (select auth.uid())
));
create policy "Users can create own routine exercises"
on public.workout_routine_exercises for insert
to authenticated
with check (exists (
  select 1
  from public.workout_routine_days d
  join public.workout_routines r on r.id = d.routine_id
  where d.id = routine_day_id and r.user_id = (select auth.uid())
));
create policy "Users can update own routine exercises"
on public.workout_routine_exercises for update
to authenticated
using (exists (
  select 1
  from public.workout_routine_days d
  join public.workout_routines r on r.id = d.routine_id
  where d.id = routine_day_id and r.user_id = (select auth.uid())
))
with check (exists (
  select 1
  from public.workout_routine_days d
  join public.workout_routines r on r.id = d.routine_id
  where d.id = routine_day_id and r.user_id = (select auth.uid())
));
create policy "Users can delete own routine exercises"
on public.workout_routine_exercises for delete
to authenticated
using (exists (
  select 1
  from public.workout_routine_days d
  join public.workout_routines r on r.id = d.routine_id
  where d.id = routine_day_id and r.user_id = (select auth.uid())
));

create policy "Users can read own workout sessions"
on public.workout_sessions for select
to authenticated
using ((select auth.uid()) = user_id);
create policy "Users can create own workout sessions"
on public.workout_sessions for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    routine_day_id is null
    or exists (
      select 1
      from public.workout_routine_days d
      join public.workout_routines r on r.id = d.routine_id
      where d.id = routine_day_id and r.user_id = (select auth.uid())
    )
  )
);
create policy "Users can update own workout sessions"
on public.workout_sessions for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    routine_day_id is null
    or exists (
      select 1
      from public.workout_routine_days d
      join public.workout_routines r on r.id = d.routine_id
      where d.id = routine_day_id and r.user_id = (select auth.uid())
    )
  )
);
create policy "Users can delete own workout sessions"
on public.workout_sessions for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own session exercises"
on public.workout_session_exercises for select
to authenticated
using (exists (
  select 1 from public.workout_sessions s
  where s.id = session_id and s.user_id = (select auth.uid())
));
create policy "Users can create own session exercises"
on public.workout_session_exercises for insert
to authenticated
with check (exists (
  select 1 from public.workout_sessions s
  where s.id = session_id and s.user_id = (select auth.uid())
));
create policy "Users can update own session exercises"
on public.workout_session_exercises for update
to authenticated
using (exists (
  select 1 from public.workout_sessions s
  where s.id = session_id and s.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.workout_sessions s
  where s.id = session_id and s.user_id = (select auth.uid())
));
create policy "Users can delete own session exercises"
on public.workout_session_exercises for delete
to authenticated
using (exists (
  select 1 from public.workout_sessions s
  where s.id = session_id and s.user_id = (select auth.uid())
));

create policy "Users can read own workout sets"
on public.workout_sets for select
to authenticated
using (exists (
  select 1
  from public.workout_session_exercises se
  join public.workout_sessions s on s.id = se.session_id
  where se.id = session_exercise_id and s.user_id = (select auth.uid())
));
create policy "Users can create own workout sets"
on public.workout_sets for insert
to authenticated
with check (exists (
  select 1
  from public.workout_session_exercises se
  join public.workout_sessions s on s.id = se.session_id
  where se.id = session_exercise_id and s.user_id = (select auth.uid())
));
create policy "Users can update own workout sets"
on public.workout_sets for update
to authenticated
using (exists (
  select 1
  from public.workout_session_exercises se
  join public.workout_sessions s on s.id = se.session_id
  where se.id = session_exercise_id and s.user_id = (select auth.uid())
))
with check (exists (
  select 1
  from public.workout_session_exercises se
  join public.workout_sessions s on s.id = se.session_id
  where se.id = session_exercise_id and s.user_id = (select auth.uid())
));
create policy "Users can delete own workout sets"
on public.workout_sets for delete
to authenticated
using (exists (
  select 1
  from public.workout_session_exercises se
  join public.workout_sessions s on s.id = se.session_id
  where se.id = session_exercise_id and s.user_id = (select auth.uid())
));

comment on table public.exercise_library is 'Canonical exercise definitions shared by authenticated BioTrack users.';
comment on table public.workout_routines is 'User-owned workout routine headers.';
comment on table public.workout_routine_days is 'Ordered training days within a workout routine.';
comment on table public.workout_routine_exercises is 'Ordered exercise prescriptions within a routine day.';
comment on table public.workout_sessions is 'Actual planned, active, completed, or cancelled workout sessions.';
comment on table public.workout_session_exercises is 'Exercise snapshots recorded within an actual workout session.';
comment on table public.workout_sets is 'Set-level workout performance history for progressive overload and analytics.';

commit;
