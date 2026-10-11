begin;

alter table public.workout_routine_exercises
  add column target_weight numeric(10,2)
    check (target_weight is null or target_weight >= 0),
  add column weight_unit text not null default 'lb'
    check (weight_unit in ('lb', 'kg'));

alter table public.workout_session_exercises
  add column target_weight_snapshot numeric(10,2)
    check (target_weight_snapshot is null or target_weight_snapshot >= 0),
  add column weight_unit_snapshot text not null default 'lb'
    check (weight_unit_snapshot in ('lb', 'kg'));

create table public.workout_progression_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_exercise_id uuid references public.workout_routine_exercises(id) on delete set null,
  exercise_id uuid not null references public.exercise_library(id) on delete restrict,
  exercise_name_snapshot text not null check (char_length(btrim(exercise_name_snapshot)) between 2 and 120),
  routine_name_snapshot text not null check (char_length(btrim(routine_name_snapshot)) between 2 and 120),
  day_name_snapshot text not null check (char_length(btrim(day_name_snapshot)) between 2 and 120),
  recommendation_type text not null check (recommendation_type in ('increase_load', 'increase_reps')),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  recommendation_snapshot jsonb not null,
  before_target_weight numeric(10,2) check (before_target_weight is null or before_target_weight >= 0),
  before_weight_unit text not null check (before_weight_unit in ('lb', 'kg')),
  before_reps_min integer check (before_reps_min is null or before_reps_min between 1 and 1000),
  before_reps_max integer check (before_reps_max is null or before_reps_max between 1 and 1000),
  after_target_weight numeric(10,2) check (after_target_weight is null or after_target_weight >= 0),
  after_weight_unit text not null check (after_weight_unit in ('lb', 'kg')),
  after_reps_min integer check (after_reps_min is null or after_reps_min between 1 and 1000),
  after_reps_max integer check (after_reps_max is null or after_reps_max between 1 and 1000),
  status text not null default 'applied' check (status in ('applied', 'undone')),
  applied_at timestamptz not null default now(),
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (before_reps_min is null or before_reps_max is null or before_reps_max >= before_reps_min),
  check (after_reps_min is null or after_reps_max is null or after_reps_max >= after_reps_min),
  check ((status = 'applied' and undone_at is null) or (status = 'undone' and undone_at is not null))
);

create index workout_progression_changes_user_applied_idx
  on public.workout_progression_changes(user_id, applied_at desc);
create index workout_progression_changes_routine_exercise_idx
  on public.workout_progression_changes(routine_exercise_id, applied_at desc);

create trigger workout_progression_changes_set_updated_at
before update on public.workout_progression_changes
for each row execute function public.biotrack_set_updated_at();

alter table public.workout_progression_changes enable row level security;
revoke all on public.workout_progression_changes from public;
revoke all on public.workout_progression_changes from anon;
grant select, insert, update on public.workout_progression_changes to authenticated;
grant all on public.workout_progression_changes to service_role;

create policy "Users can read own progression changes"
on public.workout_progression_changes for select
to authenticated
using ((select auth.uid()) = user_id);
create policy "Users can create own progression changes"
on public.workout_progression_changes for insert
to authenticated
with check ((select auth.uid()) = user_id);
create policy "Users can update own progression changes"
on public.workout_progression_changes for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.save_workout_routine_tree(p_routine jsonb, p_routine_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_routine_id uuid;
  v_name text := btrim(coalesce(p_routine ->> 'name', ''));
  v_description text := nullif(btrim(coalesce(p_routine ->> 'description', '')), '');
  v_goal text := nullif(btrim(coalesce(p_routine ->> 'goal', '')), '');
  v_difficulty text := coalesce(nullif(p_routine ->> 'difficulty', ''), 'beginner');
  v_day jsonb;
  v_day_id uuid;
  v_day_order integer;
  v_exercise jsonb;
  v_exercise_order integer;
  v_weight_unit text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Routine name must contain between 2 and 120 characters.' using errcode = '22023';
  end if;
  if v_difficulty not in ('beginner', 'intermediate', 'advanced') then
    raise exception 'Invalid routine difficulty.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_routine -> 'days', '[]'::jsonb)) <> 'array' then
    raise exception 'Routine days must be an array.' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_routine -> 'days', '[]'::jsonb)) < 1 then
    raise exception 'Add at least one workout day.' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_routine -> 'days', '[]'::jsonb)) > 31 then
    raise exception 'A routine cannot contain more than 31 days.' using errcode = '22023';
  end if;

  if p_routine_id is null then
    insert into public.workout_routines(user_id, name, description, goal, difficulty, source, is_active)
    values(v_user_id, v_name, v_description, v_goal, v_difficulty, 'user', true)
    returning id into v_routine_id;
  else
    select id into v_routine_id
    from public.workout_routines
    where id = p_routine_id and user_id = v_user_id;

    if v_routine_id is null then
      raise exception 'Routine not found or access denied.' using errcode = '42501';
    end if;

    update public.workout_routines
    set name = v_name,
        description = v_description,
        goal = v_goal,
        difficulty = v_difficulty,
        source = 'user'
    where id = v_routine_id and user_id = v_user_id;

    delete from public.workout_routine_days where routine_id = v_routine_id;
  end if;

  for v_day, v_day_order in
    select item.value, item.ordinality::integer
    from jsonb_array_elements(p_routine -> 'days') with ordinality as item(value, ordinality)
  loop
    if char_length(btrim(coalesce(v_day ->> 'name', ''))) < 2 then
      raise exception 'Every workout day needs a name.' using errcode = '22023';
    end if;
    if jsonb_typeof(coalesce(v_day -> 'exercises', '[]'::jsonb)) <> 'array' then
      raise exception 'Day exercises must be an array.' using errcode = '22023';
    end if;

    insert into public.workout_routine_days(routine_id, day_order, name, focus, focus_muscle_groups)
    values(
      v_routine_id,
      v_day_order,
      btrim(v_day ->> 'name'),
      nullif(btrim(coalesce(v_day ->> 'focus', '')), ''),
      coalesce(
        array(select jsonb_array_elements_text(coalesce(v_day -> 'focus_muscle_groups', '[]'::jsonb))),
        '{}'::text[]
      )
    )
    returning id into v_day_id;

    for v_exercise, v_exercise_order in
      select item.value, item.ordinality::integer
      from jsonb_array_elements(coalesce(v_day -> 'exercises', '[]'::jsonb)) with ordinality as item(value, ordinality)
    loop
      v_weight_unit := coalesce(nullif(v_exercise ->> 'weight_unit', ''), 'lb');
      if v_weight_unit not in ('lb', 'kg') then
        raise exception 'Invalid exercise weight unit.' using errcode = '22023';
      end if;

      insert into public.workout_routine_exercises(
        routine_day_id,
        exercise_id,
        exercise_order,
        target_sets,
        target_reps_min,
        target_reps_max,
        target_rest_seconds,
        target_weight,
        weight_unit,
        tempo,
        notes
      )
      values(
        v_day_id,
        (v_exercise ->> 'exercise_id')::uuid,
        v_exercise_order,
        coalesce((v_exercise ->> 'target_sets')::integer, 3),
        nullif(v_exercise ->> 'target_reps_min', '')::integer,
        nullif(v_exercise ->> 'target_reps_max', '')::integer,
        coalesce((v_exercise ->> 'target_rest_seconds')::integer, 90),
        nullif(v_exercise ->> 'target_weight', '')::numeric,
        v_weight_unit,
        nullif(btrim(coalesce(v_exercise ->> 'tempo', '')), ''),
        nullif(btrim(coalesce(v_exercise ->> 'notes', '')), '')
      );
    end loop;
  end loop;
  return v_routine_id;
end;
$$;

create or replace function public.start_workout_session_from_day(p_routine_day_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_session_exercise_id uuid;
  v_day_name text;
  v_routine_name text;
  v_exercise record;
  v_set_number integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select d.name, r.name into v_day_name, v_routine_name
  from public.workout_routine_days d
  join public.workout_routines r on r.id = d.routine_id
  where d.id = p_routine_day_id
    and r.user_id = v_user_id
    and r.is_active = true;

  if v_day_name is null then
    raise exception 'Workout day not found or access denied.' using errcode = '42501';
  end if;
  if exists(
    select 1 from public.workout_sessions s
    where s.user_id = v_user_id and s.status = 'in_progress'
  ) then
    raise exception 'You already have an active workout.' using errcode = '23505';
  end if;
  if not exists(
    select 1 from public.workout_routine_exercises re
    where re.routine_day_id = p_routine_day_id
  ) then
    raise exception 'This workout day has no exercises.' using errcode = '22023';
  end if;

  insert into public.workout_sessions(user_id, routine_day_id, name, status, started_at)
  values(v_user_id, p_routine_day_id, v_routine_name || ' — ' || v_day_name, 'in_progress', now())
  returning id into v_session_id;

  for v_exercise in
    select
      re.exercise_id,
      re.exercise_order,
      re.target_sets,
      re.target_reps_min,
      re.target_reps_max,
      re.target_rest_seconds,
      re.target_weight,
      re.weight_unit,
      re.notes,
      el.name as exercise_name,
      el.primary_muscle_group
    from public.workout_routine_exercises re
    join public.exercise_library el on el.id = re.exercise_id
    where re.routine_day_id = p_routine_day_id
    order by re.exercise_order
  loop
    insert into public.workout_session_exercises(
      session_id,
      exercise_id,
      exercise_order,
      exercise_name_snapshot,
      primary_muscle_group_snapshot,
      target_sets_snapshot,
      target_reps_min_snapshot,
      target_reps_max_snapshot,
      target_rest_seconds_snapshot,
      target_weight_snapshot,
      weight_unit_snapshot,
      notes
    )
    values(
      v_session_id,
      v_exercise.exercise_id,
      v_exercise.exercise_order,
      v_exercise.exercise_name,
      v_exercise.primary_muscle_group,
      v_exercise.target_sets,
      v_exercise.target_reps_min,
      v_exercise.target_reps_max,
      v_exercise.target_rest_seconds,
      v_exercise.target_weight,
      v_exercise.weight_unit,
      v_exercise.notes
    )
    returning id into v_session_exercise_id;

    for v_set_number in 1..v_exercise.target_sets loop
      insert into public.workout_sets(
        session_exercise_id,
        set_number,
        weight,
        weight_unit,
        is_completed,
        is_warmup
      )
      values(
        v_session_exercise_id,
        v_set_number,
        v_exercise.target_weight,
        v_exercise.weight_unit,
        false,
        false
      );
    end loop;
  end loop;
  return v_session_id;
end;
$$;

create or replace function public.apply_workout_progression_change(
  p_routine_exercise_id uuid,
  p_expected_recommendation_type text,
  p_expected_recommendation_weight_unit text,
  p_expected_target_weight numeric,
  p_expected_weight_unit text,
  p_expected_reps_min integer,
  p_expected_reps_max integer,
  p_proposed_target_weight numeric,
  p_proposed_weight_unit text,
  p_proposed_reps_min integer,
  p_proposed_reps_max integer
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_exercise_id uuid;
  v_exercise_name text;
  v_routine_name text;
  v_day_name text;
  v_current_target_weight numeric;
  v_current_weight_unit text;
  v_current_reps_min integer;
  v_current_reps_max integer;
  v_recommendation record;
  v_change_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_expected_recommendation_type not in ('increase_load', 'increase_reps') then
    raise exception 'Only load or repetition progression can be applied.' using errcode = '22023';
  end if;
  if p_expected_recommendation_weight_unit not in ('lb', 'kg')
     or p_expected_weight_unit not in ('lb', 'kg')
     or p_proposed_weight_unit not in ('lb', 'kg') then
    raise exception 'Invalid weight unit.' using errcode = '22023';
  end if;

  select
    re.exercise_id,
    el.name,
    r.name,
    d.name,
    re.target_weight,
    re.weight_unit,
    re.target_reps_min,
    re.target_reps_max
  into
    v_exercise_id,
    v_exercise_name,
    v_routine_name,
    v_day_name,
    v_current_target_weight,
    v_current_weight_unit,
    v_current_reps_min,
    v_current_reps_max
  from public.workout_routine_exercises re
  join public.workout_routine_days d on d.id = re.routine_day_id
  join public.workout_routines r on r.id = d.routine_id
  join public.exercise_library el on el.id = re.exercise_id
  where re.id = p_routine_exercise_id
    and r.user_id = v_user_id
    and r.is_active = true
  for update of re;

  if not found then
    raise exception 'Routine exercise not found or access denied.' using errcode = '42501';
  end if;

  if v_current_target_weight is distinct from p_expected_target_weight
     or v_current_weight_unit is distinct from p_expected_weight_unit
     or v_current_reps_min is distinct from p_expected_reps_min
     or v_current_reps_max is distinct from p_expected_reps_max then
    raise exception 'This routine target changed after the preview. Recalculate before applying.' using errcode = '40001';
  end if;

  select guidance.* into v_recommendation
  from public.get_workout_progression_recommendations(array[v_exercise_id], 3) guidance
  where guidance.weight_unit = p_expected_recommendation_weight_unit
  limit 1;

  if not found or v_recommendation.recommendation_type <> p_expected_recommendation_type then
    raise exception 'This recommendation is no longer current. Recalculate before applying.' using errcode = '40001';
  end if;
  if v_current_reps_min is distinct from v_recommendation.target_reps_min
     or v_current_reps_max is distinct from v_recommendation.target_reps_max then
    raise exception 'The programmed repetition range no longer matches the analyzed sessions.' using errcode = '40001';
  end if;
  if p_proposed_reps_min is null
     or p_proposed_reps_max is null
     or p_proposed_reps_min < 1
     or p_proposed_reps_max < p_proposed_reps_min
     or p_proposed_reps_max > 1000 then
    raise exception 'Invalid proposed repetition range.' using errcode = '22023';
  end if;

  if p_expected_recommendation_type = 'increase_load' then
    if v_recommendation.latest_weight is null
       or p_proposed_target_weight is null
       or p_proposed_target_weight <= v_recommendation.latest_weight then
      raise exception 'The proposed target weight must be higher than the latest comparable weight.' using errcode = '22023';
    end if;
    if p_proposed_weight_unit <> v_recommendation.weight_unit then
      raise exception 'The proposed weight unit must match the analyzed sessions.' using errcode = '22023';
    end if;
    if p_proposed_reps_min is distinct from v_current_reps_min
       or p_proposed_reps_max is distinct from v_current_reps_max then
      raise exception 'A load progression cannot also change the repetition range.' using errcode = '22023';
    end if;
  else
    if p_proposed_target_weight is distinct from v_current_target_weight
       or p_proposed_weight_unit is distinct from v_current_weight_unit then
      raise exception 'A repetition progression cannot also change the target weight.' using errcode = '22023';
    end if;
    if p_proposed_reps_min < coalesce(v_current_reps_min, p_proposed_reps_min)
       or p_proposed_reps_max < coalesce(v_current_reps_max, p_proposed_reps_max)
       or (
         p_proposed_reps_min is not distinct from v_current_reps_min
         and p_proposed_reps_max is not distinct from v_current_reps_max
       ) then
      raise exception 'The proposed repetition range must move upward without lowering an existing target.' using errcode = '22023';
    end if;
  end if;

  update public.workout_routine_exercises
  set target_weight = p_proposed_target_weight,
      weight_unit = p_proposed_weight_unit,
      target_reps_min = p_proposed_reps_min,
      target_reps_max = p_proposed_reps_max
  where id = p_routine_exercise_id;

  insert into public.workout_progression_changes(
    user_id,
    routine_exercise_id,
    exercise_id,
    exercise_name_snapshot,
    routine_name_snapshot,
    day_name_snapshot,
    recommendation_type,
    confidence,
    recommendation_snapshot,
    before_target_weight,
    before_weight_unit,
    before_reps_min,
    before_reps_max,
    after_target_weight,
    after_weight_unit,
    after_reps_min,
    after_reps_max,
    status,
    applied_at
  )
  values(
    v_user_id,
    p_routine_exercise_id,
    v_exercise_id,
    v_exercise_name,
    v_routine_name,
    v_day_name,
    v_recommendation.recommendation_type,
    v_recommendation.confidence,
    to_jsonb(v_recommendation),
    v_current_target_weight,
    v_current_weight_unit,
    v_current_reps_min,
    v_current_reps_max,
    p_proposed_target_weight,
    p_proposed_weight_unit,
    p_proposed_reps_min,
    p_proposed_reps_max,
    'applied',
    now()
  )
  returning id into v_change_id;

  return v_change_id;
end;
$$;

create or replace function public.undo_workout_progression_change(p_change_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_change record;
  v_current_target_weight numeric;
  v_current_weight_unit text;
  v_current_reps_min integer;
  v_current_reps_max integer;
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select * into v_change
  from public.workout_progression_changes
  where id = p_change_id
    and user_id = v_user_id
    and status = 'applied'
  for update;

  if not found then
    raise exception 'Applied progression change not found or access denied.' using errcode = '42501';
  end if;
  if v_change.routine_exercise_id is null then
    raise exception 'The original routine exercise no longer exists, so this change cannot be undone.' using errcode = '22023';
  end if;

  select
    re.target_weight,
    re.weight_unit,
    re.target_reps_min,
    re.target_reps_max
  into
    v_current_target_weight,
    v_current_weight_unit,
    v_current_reps_min,
    v_current_reps_max
  from public.workout_routine_exercises re
  join public.workout_routine_days d on d.id = re.routine_day_id
  join public.workout_routines r on r.id = d.routine_id
  where re.id = v_change.routine_exercise_id
    and r.user_id = v_user_id
  for update of re;

  if not found then
    raise exception 'The original routine exercise no longer exists or access was denied.' using errcode = '42501';
  end if;
  if v_current_target_weight is distinct from v_change.after_target_weight
     or v_current_weight_unit is distinct from v_change.after_weight_unit
     or v_current_reps_min is distinct from v_change.after_reps_min
     or v_current_reps_max is distinct from v_change.after_reps_max then
    raise exception 'This routine target changed after the progression was applied. Undo was stopped to protect the newer edit.' using errcode = '40001';
  end if;

  update public.workout_routine_exercises
  set target_weight = v_change.before_target_weight,
      weight_unit = v_change.before_weight_unit,
      target_reps_min = v_change.before_reps_min,
      target_reps_max = v_change.before_reps_max
  where id = v_change.routine_exercise_id;

  update public.workout_progression_changes
  set status = 'undone',
      undone_at = now()
  where id = p_change_id
    and user_id = v_user_id
    and status = 'applied';
end;
$$;

revoke all on function public.apply_workout_progression_change(
  uuid, text, text, numeric, text, integer, integer, numeric, text, integer, integer
) from public;
revoke all on function public.apply_workout_progression_change(
  uuid, text, text, numeric, text, integer, integer, numeric, text, integer, integer
) from anon;
grant execute on function public.apply_workout_progression_change(
  uuid, text, text, numeric, text, integer, integer, numeric, text, integer, integer
) to authenticated;
grant execute on function public.apply_workout_progression_change(
  uuid, text, text, numeric, text, integer, integer, numeric, text, integer, integer
) to service_role;

revoke all on function public.undo_workout_progression_change(uuid) from public;
revoke all on function public.undo_workout_progression_change(uuid) from anon;
grant execute on function public.undo_workout_progression_change(uuid) to authenticated;
grant execute on function public.undo_workout_progression_change(uuid) to service_role;

comment on function public.apply_workout_progression_change(
  uuid, text, text, numeric, text, integer, integer, numeric, text, integer, integer
) is 'Revalidates a current progression recommendation, applies an explicitly approved routine target change, and records before and after values.';
comment on function public.undo_workout_progression_change(uuid)
is 'Safely restores the before values for an owned applied progression change only when the routine target has not changed afterward.';
comment on table public.workout_progression_changes
is 'User-owned change history for explicitly approved Workout AI progression updates. Historical workout sessions remain unchanged.';

commit;
