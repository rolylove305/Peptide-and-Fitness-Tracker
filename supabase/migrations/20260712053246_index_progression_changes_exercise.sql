begin;

create index workout_progression_changes_exercise_idx
on public.workout_progression_changes(exercise_id, applied_at desc);

commit;
