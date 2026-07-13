alter table public.workout_sets
  add column if not exists is_skipped boolean not null default false;

alter table public.workout_sets
  drop constraint if exists workout_sets_completion_skip_state_check;

alter table public.workout_sets
  add constraint workout_sets_completion_skip_state_check
  check (not (is_completed and is_skipped));

comment on column public.workout_sets.is_skipped is
  'Marks a programmed workout set as intentionally omitted for the current session without counting it as completed training volume.';
