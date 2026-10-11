begin;

create index if not exists workout_sessions_user_completed_idx
  on public.workout_sessions(user_id, completed_at desc)
  where status = 'completed';

create or replace function public.get_workout_progression_recommendations(
  p_exercise_ids uuid[] default null,
  p_session_limit integer default 3
)
returns table (
  exercise_id uuid,
  exercise_name text,
  primary_muscle_group text,
  weight_unit text,
  recommendation_type text,
  confidence text,
  sessions_analyzed integer,
  latest_performed_at timestamptz,
  latest_weight numeric,
  latest_average_reps numeric,
  latest_average_rpe numeric,
  target_reps_min integer,
  target_reps_max integer,
  action_label text,
  rationale text,
  evidence jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with parameters as (
    select greatest(2, least(coalesce(p_session_limit, 3), 6))::integer as session_limit
  ),
  session_metrics as (
    select
      s.id as session_id,
      s.completed_at,
      se.exercise_id,
      se.exercise_name_snapshot as exercise_name,
      coalesce(nullif(btrim(se.primary_muscle_group_snapshot), ''), 'Other') as primary_muscle_group,
      ws.weight_unit,
      se.target_reps_min_snapshot as target_reps_min,
      se.target_reps_max_snapshot as target_reps_max,
      count(ws.id)::integer as completed_set_count,
      avg(ws.reps)::numeric(10,2) as average_reps,
      min(ws.reps)::integer as minimum_reps,
      max(ws.reps)::integer as maximum_reps,
      max(ws.weight)::numeric(10,2) as maximum_weight,
      avg(ws.rpe) filter (where ws.rpe is not null)::numeric(4,2) as average_rpe,
      count(ws.rpe)::integer as rpe_set_count
    from public.workout_sessions s
    join public.workout_session_exercises se on se.session_id = s.id
    join public.workout_sets ws on ws.session_exercise_id = se.id
    where s.user_id = (select auth.uid())
      and s.status = 'completed'
      and ws.is_completed = true
      and ws.is_warmup = false
      and ws.reps is not null
      and (
        p_exercise_ids is null
        or cardinality(p_exercise_ids) = 0
        or se.exercise_id = any(p_exercise_ids)
      )
    group by
      s.id,
      s.completed_at,
      se.exercise_id,
      se.exercise_name_snapshot,
      se.primary_muscle_group_snapshot,
      ws.weight_unit,
      se.target_reps_min_snapshot,
      se.target_reps_max_snapshot
  ),
  ranked_sessions as (
    select
      session_metrics.*,
      row_number() over (
        partition by exercise_id, weight_unit
        order by completed_at desc, session_id desc
      ) as recency_rank
    from session_metrics
  ),
  recent_sessions as (
    select ranked_sessions.*
    from ranked_sessions
    cross join parameters
    where recency_rank <= parameters.session_limit
  ),
  aggregated_evidence as (
    select
      recent_sessions.exercise_id,
      recent_sessions.weight_unit,
      (array_agg(exercise_name order by recency_rank))[1] as exercise_name,
      (array_agg(primary_muscle_group order by recency_rank))[1] as primary_muscle_group,
      count(*)::integer as sessions_analyzed,
      (array_agg(completed_at order by recency_rank))[1] as latest_performed_at,
      (array_agg(target_reps_min order by recency_rank))[1] as target_reps_min,
      (array_agg(target_reps_max order by recency_rank))[1] as target_reps_max,
      (array_agg(completed_set_count order by recency_rank))[1] as latest_completed_set_count,
      (array_agg(average_reps order by recency_rank))[1] as latest_average_reps,
      (array_agg(minimum_reps order by recency_rank))[1] as latest_minimum_reps,
      (array_agg(maximum_weight order by recency_rank))[1] as latest_weight,
      (array_agg(average_rpe order by recency_rank))[1] as latest_average_rpe,
      count(*) filter (
        where recency_rank <= 2
          and target_reps_max is not null
          and minimum_reps >= target_reps_max
      )::integer as top_range_last_two,
      count(*) filter (where average_rpe is not null)::integer as rpe_sessions,
      count(distinct maximum_weight)::integer as distinct_recent_weights,
      (max(average_reps) - min(average_reps))::numeric(10,2) as recent_rep_spread,
      jsonb_agg(
        jsonb_build_object(
          'session_id', session_id,
          'performed_at', completed_at,
          'completed_set_count', completed_set_count,
          'average_reps', average_reps,
          'minimum_reps', minimum_reps,
          'maximum_reps', maximum_reps,
          'maximum_weight', maximum_weight,
          'average_rpe', average_rpe,
          'rpe_set_count', rpe_set_count,
          'target_reps_min', target_reps_min,
          'target_reps_max', target_reps_max
        )
        order by recency_rank
      ) as evidence
    from recent_sessions
    group by recent_sessions.exercise_id, recent_sessions.weight_unit
  ),
  classified as (
    select
      aggregated_evidence.*,
      case
        when sessions_analyzed < 2
          or target_reps_min is null
          or target_reps_max is null
          or latest_completed_set_count < 2
          then 'insufficient_data'
        when latest_minimum_reps < target_reps_min
          or latest_average_rpe >= 9.5
          then 'review_recovery'
        when top_range_last_two = 2
          and (latest_average_rpe is null or latest_average_rpe <= 8.5)
          then 'increase_load'
        when latest_minimum_reps >= target_reps_min
          and latest_average_reps < target_reps_max
          and (latest_average_rpe is null or latest_average_rpe <= 8.5)
          then 'increase_reps'
        when sessions_analyzed >= 3
          and distinct_recent_weights = 1
          and recent_rep_spread <= 0.5
          then 'hold'
        else 'hold'
      end as recommendation_type,
      case
        when sessions_analyzed < 2 then 'low'
        when sessions_analyzed >= 3 and rpe_sessions >= 2 then 'high'
        else 'medium'
      end as confidence
    from aggregated_evidence
  )
  select
    classified.exercise_id,
    classified.exercise_name,
    classified.primary_muscle_group,
    classified.weight_unit,
    classified.recommendation_type,
    classified.confidence,
    classified.sessions_analyzed,
    classified.latest_performed_at,
    classified.latest_weight,
    classified.latest_average_reps,
    classified.latest_average_rpe,
    classified.target_reps_min,
    classified.target_reps_max,
    case classified.recommendation_type
      when 'increase_load' then 'Consider the smallest available load increase'
      when 'increase_reps' then 'Add 1 repetition to one or more working sets'
      when 'review_recovery' then 'Hold the load and review recovery, form and effort'
      when 'hold' then 'Repeat the current plan'
      else 'Complete more comparable sessions'
    end as action_label,
    case classified.recommendation_type
      when 'increase_load' then
        'Every working set reached the top of the programmed rep range in each of the last two comparable sessions. BioTrack is suggesting a small progression, not applying one.'
      when 'increase_reps' then
        'The latest working sets stayed inside the programmed rep range with room before the top. A small repetition increase can provide the next measurable step.'
      when 'review_recovery' then
        'The latest session fell below the programmed rep range or was recorded at very high effort. BioTrack is holding progression rather than guessing at a cause.'
      when 'hold' then
        'The available sessions do not yet show a clear reason to change the programmed load or repetitions.'
      else
        'BioTrack needs at least two comparable completed sessions with a programmed rep range before suggesting progression.'
    end as rationale,
    classified.evidence
  from classified
  order by classified.latest_performed_at desc, classified.exercise_name;
$$;

revoke all on function public.get_workout_progression_recommendations(uuid[], integer) from public;
revoke all on function public.get_workout_progression_recommendations(uuid[], integer) from anon;
grant execute on function public.get_workout_progression_recommendations(uuid[], integer) to authenticated;
grant execute on function public.get_workout_progression_recommendations(uuid[], integer) to service_role;

comment on function public.get_workout_progression_recommendations(uuid[], integer)
is 'Returns deterministic, explainable workout progression guidance from recent completed working sets owned by the authenticated user. It never modifies routines or workout data.';

commit;
