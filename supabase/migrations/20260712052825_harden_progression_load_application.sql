begin;

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
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
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
       or p_proposed_target_weight <= greatest(
         v_recommendation.latest_weight,
         coalesce(v_current_target_weight, v_recommendation.latest_weight)
       ) then
      raise exception 'The proposed target weight must be higher than both the latest comparable weight and the current saved target.' using errcode = '22023';
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

comment on function public.apply_workout_progression_change(
  uuid, text, text, numeric, text, integer, integer, numeric, text, integer, integer
) is 'Revalidates progression, requires the proposed load to exceed both recent performance and the current saved target, applies an approved change, and records before and after values.';

commit;
