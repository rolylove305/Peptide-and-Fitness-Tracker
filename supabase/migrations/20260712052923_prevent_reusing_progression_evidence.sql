begin;

create unique index workout_progression_changes_active_evidence_idx
on public.workout_progression_changes (
  routine_exercise_id,
  recommendation_type,
  ((recommendation_snapshot ->> 'latest_performed_at'))
)
where status = 'applied'
  and routine_exercise_id is not null;

comment on index public.workout_progression_changes_active_evidence_idx
is 'Prevents the same routine target from applying the same active progression evidence more than once.';

commit;
