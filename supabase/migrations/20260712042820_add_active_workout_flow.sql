begin;

alter table public.workout_session_exercises
  add column target_sets_snapshot integer not null default 3
    check (target_sets_snapshot between 1 and 20),
  add column target_reps_min_snapshot integer
    check (target_reps_min_snapshot is null or target_reps_min_snapshot between 1 and 1000),
  add column target_reps_max_snapshot integer
    check (target_reps_max_snapshot is null or target_reps_max_snapshot between 1 and 1000),
  add column target_rest_seconds_snapshot integer not null default 90
    check (target_rest_seconds_snapshot between 0 and 3600),
  add constraint workout_session_exercises_snapshot_reps_check
    check (
      target_reps_min_snapshot is null
      or target_reps_max_snapshot is null
      or target_reps_max_snapshot >= target_reps_min_snapshot
    );

create unique index workout_sessions_one_active_per_user_idx
  on public.workout_sessions(user_id)
  where status = 'in_progress';

create or replace function public.start_workout_session_from_day(p_routine_day_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
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

  select d.name, r.name
    into v_day_name, v_routine_name
    from public.workout_routine_days d
    join public.workout_routines r on r.id = d.routine_id
   where d.id = p_routine_day_id
     and r.user_id = v_user_id
     and r.is_active = true;

  if v_day_name is null then
    raise exception 'Workout day not found or access denied.' using errcode = '42501';
  end if;

  if exists (
    select 1
      from public.workout_sessions s
     where s.user_id = v_user_id
       and s.status = 'in_progress'
  ) then
    raise exception 'You already have an active workout.' using errcode = '23505';
  end if;

  if not exists (
    select 1
      from public.workout_routine_exercises re
     where re.routine_day_id = p_routine_day_id
  ) then
    raise exception 'This workout day has no exercises.' using errcode = '22023';
  end if;

  insert into public.workout_sessions (
    user_id,
    routine_day_id,
    name,
    status,
    started_at
  )
  values (
    v_user_id,
    p_routine_day_id,
    v_routine_name || ' — ' || v_day_name,
    'in_progress',
    now()
  )
  returning id into v_session_id;

  for v_exercise in
    select
      re.exercise_id,
      re.exercise_order,
      re.target_sets,
      re.target_reps_min,
      re.target_reps_max,
      re.target_rest_seconds,
      re.notes,
      el.name as exercise_name,
      el.primary_muscle_group
    from public.workout_routine_exercises re
    join public.exercise_library el on el.id = re.exercise_id
    where re.routine_day_id = p_routine_day_id
    order by re.exercise_order
  loop
    insert into public.workout_session_exercises (
      session_id,
      exercise_id,
      exercise_order,
      exercise_name_snapshot,
      primary_muscle_group_snapshot,
      target_sets_snapshot,
      target_reps_min_snapshot,
      target_reps_max_snapshot,
      target_rest_seconds_snapshot,
      notes
    )
    values (
      v_session_id,
      v_exercise.exercise_id,
      v_exercise.exercise_order,
      v_exercise.exercise_name,
      v_exercise.primary_muscle_group,
      v_exercise.target_sets,
      v_exercise.target_reps_min,
      v_exercise.target_reps_max,
      v_exercise.target_rest_seconds,
      v_exercise.notes
    )
    returning id into v_session_exercise_id;

    for v_set_number in 1..v_exercise.target_sets loop
      insert into public.workout_sets (
        session_exercise_id,
        set_number,
        weight_unit,
        is_completed,
        is_warmup
      )
      values (
        v_session_exercise_id,
        v_set_number,
        'lb',
        false,
        false
      );
    end loop;
  end loop;

  return v_session_id;
end;
$$;

create or replace function public.complete_workout_session(p_session_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.workout_sessions s
     where s.id = p_session_id
       and s.user_id = v_user_id
       and s.status = 'in_progress'
  ) then
    raise exception 'Active workout not found or access denied.' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.workout_sets ws
      join public.workout_session_exercises se on se.id = ws.session_exercise_id
     where se.session_id = p_session_id
       and ws.is_completed = true
  ) then
    raise exception 'Complete at least one set before finishing the workout.' using errcode = '22023';
  end if;

  update public.workout_sessions
     set status = 'completed',
         completed_at = now()
   where id = p_session_id
     and user_id = v_user_id
     and status = 'in_progress';
end;
$$;

create or replace function public.cancel_workout_session(p_session_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  update public.workout_sessions
     set status = 'cancelled',
         completed_at = now()
   where id = p_session_id
     and user_id = v_user_id
     and status = 'in_progress';

  if not found then
    raise exception 'Active workout not found or access denied.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.start_workout_session_from_day(uuid) from public;
revoke all on function public.start_workout_session_from_day(uuid) from anon;
grant execute on function public.start_workout_session_from_day(uuid) to authenticated;
grant execute on function public.start_workout_session_from_day(uuid) to service_role;

revoke all on function public.complete_workout_session(uuid) from public;
revoke all on function public.complete_workout_session(uuid) from anon;
grant execute on function public.complete_workout_session(uuid) to authenticated;
grant execute on function public.complete_workout_session(uuid) to service_role;

revoke all on function public.cancel_workout_session(uuid) from public;
revoke all on function public.cancel_workout_session(uuid) from anon;
grant execute on function public.cancel_workout_session(uuid) to authenticated;
grant execute on function public.cancel_workout_session(uuid) to service_role;

comment on function public.start_workout_session_from_day(uuid)
is 'Creates an in-progress workout session with exercise and set snapshots from an owned routine day.';
comment on function public.complete_workout_session(uuid)
is 'Completes an owned active workout after at least one set has been completed.';
comment on function public.cancel_workout_session(uuid)
is 'Cancels an owned active workout session.';

commit;
