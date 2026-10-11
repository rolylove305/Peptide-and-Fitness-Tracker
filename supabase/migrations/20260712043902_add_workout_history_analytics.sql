begin;

create or replace view public.workout_session_summaries
with (security_invoker = true)
as
select
  s.id,
  s.user_id,
  s.routine_day_id,
  s.name,
  s.started_at,
  s.completed_at,
  greatest(0, coalesce(extract(epoch from (s.completed_at - s.started_at))::bigint, 0)) as duration_seconds,
  count(distinct se.id)::integer as exercise_count,
  (count(ws.id) filter (where ws.is_completed = true))::integer as completed_set_count,
  (count(ws.id) filter (where ws.is_completed = true and ws.is_warmup = false))::integer as working_set_count,
  coalesce(sum(ws.reps) filter (where ws.is_completed = true and ws.is_warmup = false), 0)::bigint as total_reps,
  coalesce(
    sum(ws.weight * ws.reps) filter (
      where ws.is_completed = true
        and ws.is_warmup = false
        and ws.weight is not null
        and ws.reps is not null
        and ws.weight_unit = s.weight_unit
    ),
    0
  )::numeric(14,2) as total_volume,
  s.weight_unit
from public.workout_sessions s
left join public.workout_session_exercises se on se.session_id = s.id
left join public.workout_sets ws on ws.session_exercise_id = se.id
where s.status = 'completed'
group by
  s.id,
  s.user_id,
  s.routine_day_id,
  s.name,
  s.started_at,
  s.completed_at,
  s.weight_unit;

create or replace view public.workout_exercise_records
with (security_invoker = true)
as
select
  s.user_id,
  se.exercise_id,
  (array_agg(se.exercise_name_snapshot order by s.completed_at desc, s.id desc))[1] as exercise_name,
  (array_agg(coalesce(se.primary_muscle_group_snapshot, 'Other') order by s.completed_at desc, s.id desc))[1] as primary_muscle_group,
  ws.weight_unit,
  count(distinct s.id)::integer as session_count,
  count(ws.id)::integer as completed_set_count,
  coalesce(sum(ws.reps), 0)::bigint as total_reps,
  max(ws.weight) as heaviest_weight,
  max(ws.reps) as highest_reps,
  max(ws.weight * ws.reps)::numeric(14,2) as best_set_volume,
  max(s.completed_at) as last_performed_at
from public.workout_sessions s
join public.workout_session_exercises se on se.session_id = s.id
join public.workout_sets ws on ws.session_exercise_id = se.id
where s.status = 'completed'
  and ws.is_completed = true
  and ws.is_warmup = false
group by s.user_id, se.exercise_id, ws.weight_unit;

create or replace view public.workout_muscle_volume_daily
with (security_invoker = true)
as
select
  s.user_id,
  (s.completed_at at time zone 'UTC')::date as workout_date,
  coalesce(nullif(btrim(se.primary_muscle_group_snapshot), ''), 'Other') as muscle_group,
  ws.weight_unit,
  count(ws.id)::integer as completed_set_count,
  coalesce(sum(ws.reps), 0)::bigint as total_reps,
  coalesce(
    sum(ws.weight * ws.reps) filter (
      where ws.weight is not null and ws.reps is not null
    ),
    0
  )::numeric(14,2) as total_volume
from public.workout_sessions s
join public.workout_session_exercises se on se.session_id = s.id
join public.workout_sets ws on ws.session_exercise_id = se.id
where s.status = 'completed'
  and ws.is_completed = true
  and ws.is_warmup = false
group by
  s.user_id,
  (s.completed_at at time zone 'UTC')::date,
  coalesce(nullif(btrim(se.primary_muscle_group_snapshot), ''), 'Other'),
  ws.weight_unit;

create or replace function public.get_previous_exercise_performance(p_exercise_ids uuid[])
returns table (
  exercise_id uuid,
  session_id uuid,
  performed_at timestamptz,
  weight_unit text,
  sets jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with latest_sessions as (
    select distinct on (se.exercise_id)
      se.exercise_id,
      se.session_id,
      s.completed_at
    from public.workout_session_exercises se
    join public.workout_sessions s on s.id = se.session_id
    join public.workout_sets ws on ws.session_exercise_id = se.id
    where s.user_id = (select auth.uid())
      and s.status = 'completed'
      and ws.is_completed = true
      and ws.is_warmup = false
      and se.exercise_id = any(coalesce(p_exercise_ids, '{}'::uuid[]))
    order by se.exercise_id, s.completed_at desc, s.id desc
  )
  select
    ls.exercise_id,
    ls.session_id,
    ls.completed_at as performed_at,
    coalesce((array_agg(ws.weight_unit order by ws.set_number))[1], 'lb') as weight_unit,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'set_number', ws.set_number,
          'weight', ws.weight,
          'reps', ws.reps,
          'rpe', ws.rpe
        )
        order by ws.set_number
      ) filter (where ws.id is not null),
      '[]'::jsonb
    ) as sets
  from latest_sessions ls
  join public.workout_session_exercises se
    on se.session_id = ls.session_id
   and se.exercise_id = ls.exercise_id
  left join public.workout_sets ws
    on ws.session_exercise_id = se.id
   and ws.is_completed = true
   and ws.is_warmup = false
  group by ls.exercise_id, ls.session_id, ls.completed_at;
$$;

revoke all on public.workout_session_summaries from public;
revoke all on public.workout_session_summaries from anon;
grant select on public.workout_session_summaries to authenticated;
grant select on public.workout_session_summaries to service_role;

revoke all on public.workout_exercise_records from public;
revoke all on public.workout_exercise_records from anon;
grant select on public.workout_exercise_records to authenticated;
grant select on public.workout_exercise_records to service_role;

revoke all on public.workout_muscle_volume_daily from public;
revoke all on public.workout_muscle_volume_daily from anon;
grant select on public.workout_muscle_volume_daily to authenticated;
grant select on public.workout_muscle_volume_daily to service_role;

revoke all on function public.get_previous_exercise_performance(uuid[]) from public;
revoke all on function public.get_previous_exercise_performance(uuid[]) from anon;
grant execute on function public.get_previous_exercise_performance(uuid[]) to authenticated;
grant execute on function public.get_previous_exercise_performance(uuid[]) to service_role;

comment on view public.workout_session_summaries
is 'RLS-aware summaries for completed workout sessions.';
comment on view public.workout_exercise_records
is 'RLS-aware all-time exercise records grouped by user, exercise, and weight unit.';
comment on view public.workout_muscle_volume_daily
is 'RLS-aware daily training volume grouped by muscle and weight unit.';
comment on function public.get_previous_exercise_performance(uuid[])
is 'Returns the latest completed working sets for each requested exercise owned by the authenticated user.';

commit;