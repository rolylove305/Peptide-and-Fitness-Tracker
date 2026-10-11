begin;

create or replace function public.save_workout_routine_tree(
  p_routine jsonb,
  p_routine_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
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
    insert into public.workout_routines (
      user_id,
      name,
      description,
      goal,
      difficulty,
      source,
      is_active
    )
    values (
      v_user_id,
      v_name,
      v_description,
      v_goal,
      v_difficulty,
      'user',
      true
    )
    returning id into v_routine_id;
  else
    select id
      into v_routine_id
      from public.workout_routines
     where id = p_routine_id
       and user_id = v_user_id;

    if v_routine_id is null then
      raise exception 'Routine not found or access denied.' using errcode = '42501';
    end if;

    update public.workout_routines
       set name = v_name,
           description = v_description,
           goal = v_goal,
           difficulty = v_difficulty,
           source = 'user'
     where id = v_routine_id
       and user_id = v_user_id;

    delete from public.workout_routine_days
     where routine_id = v_routine_id;
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

    insert into public.workout_routine_days (
      routine_id,
      day_order,
      name,
      focus,
      focus_muscle_groups
    )
    values (
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
      insert into public.workout_routine_exercises (
        routine_day_id,
        exercise_id,
        exercise_order,
        target_sets,
        target_reps_min,
        target_reps_max,
        target_rest_seconds,
        tempo,
        notes
      )
      values (
        v_day_id,
        (v_exercise ->> 'exercise_id')::uuid,
        v_exercise_order,
        coalesce((v_exercise ->> 'target_sets')::integer, 3),
        nullif(v_exercise ->> 'target_reps_min', '')::integer,
        nullif(v_exercise ->> 'target_reps_max', '')::integer,
        coalesce((v_exercise ->> 'target_rest_seconds')::integer, 90),
        nullif(btrim(coalesce(v_exercise ->> 'tempo', '')), ''),
        nullif(btrim(coalesce(v_exercise ->> 'notes', '')), '')
      );
    end loop;
  end loop;

  return v_routine_id;
end;
$$;

revoke all on function public.save_workout_routine_tree(jsonb, uuid) from public;
revoke all on function public.save_workout_routine_tree(jsonb, uuid) from anon;
grant execute on function public.save_workout_routine_tree(jsonb, uuid) to authenticated;
grant execute on function public.save_workout_routine_tree(jsonb, uuid) to service_role;

comment on function public.save_workout_routine_tree(jsonb, uuid)
is 'Atomically creates or replaces a user-owned Workout AI routine tree.';

commit;
