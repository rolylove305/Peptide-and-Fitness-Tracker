begin;

create table public.exercise_media_assets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercise_library(id) on delete cascade,
  media_kind text not null check (media_kind in ('image', 'gif', 'video')),
  media_role text not null check (media_role in ('hero', 'thumbnail', 'start', 'finish', 'loop', 'muscle_map', 'mistake')),
  url text not null check (url ~ '^https://'),
  poster_url text check (poster_url is null or poster_url ~ '^https://'),
  alt_text text not null check (char_length(btrim(alt_text)) between 5 and 240),
  width integer check (width is null or width between 1 and 8192),
  height integer check (height is null or height between 1 and 8192),
  duration_ms integer check (duration_ms is null or duration_ms between 1 and 600000),
  sort_order integer not null default 0 check (sort_order between 0 and 100),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  rights_status text not null default 'owned' check (rights_status in ('owned', 'licensed', 'generated')),
  license_reference text,
  content_hash text check (content_hash is null or char_length(content_hash) <= 128),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rights_status <> 'licensed' or nullif(btrim(license_reference), '') is not null)
);

create table public.exercise_technique_guides (
  exercise_id uuid primary key references public.exercise_library(id) on delete cascade,
  start_position text,
  finish_position text,
  setup_steps text[] not null default '{}',
  execution_steps text[] not null default '{}',
  coaching_cues text[] not null default '{}',
  common_mistakes text[] not null default '{}',
  safety_notes text[] not null default '{}',
  breathing text,
  tempo_guidance text,
  muscle_highlights jsonb not null default '[]'::jsonb check (jsonb_typeof(muscle_highlights) = 'array'),
  content_source text not null default 'editorial' check (content_source in ('editorial', 'imported', 'ai_assisted')),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  version integer not null default 1 check (version between 1 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index exercise_media_assets_exercise_idx
  on public.exercise_media_assets(exercise_id, media_role, sort_order)
  where is_active;

create unique index exercise_media_assets_primary_role_idx
  on public.exercise_media_assets(exercise_id, media_role)
  where is_active and is_primary;

create index exercise_technique_guides_status_idx
  on public.exercise_technique_guides(status, updated_at desc)
  where is_active;

create trigger exercise_media_assets_set_updated_at
before update on public.exercise_media_assets
for each row execute function public.biotrack_set_updated_at();

create trigger exercise_technique_guides_set_updated_at
before update on public.exercise_technique_guides
for each row execute function public.biotrack_set_updated_at();

alter table public.exercise_media_assets enable row level security;
alter table public.exercise_technique_guides enable row level security;

revoke all on public.exercise_media_assets from anon;
revoke all on public.exercise_technique_guides from anon;

grant select on public.exercise_media_assets to authenticated;
grant select on public.exercise_technique_guides to authenticated;

grant all on public.exercise_media_assets to service_role;
grant all on public.exercise_technique_guides to service_role;

create policy "Authenticated users can read active exercise media"
on public.exercise_media_assets
for select
to authenticated
using (is_active);

create policy "Authenticated users can read published technique guides"
on public.exercise_technique_guides
for select
to authenticated
using (is_active and status = 'published');

comment on table public.exercise_media_assets is
  'Rights-aware professional image, GIF and short-video assets used by the BioTrack Exercise Media Engine.';

comment on table public.exercise_technique_guides is
  'Versioned editorial technique guidance for exercise setup, execution, coaching cues, mistakes and muscle highlights.';

insert into public.exercise_technique_guides (
  exercise_id,
  execution_steps,
  coaching_cues,
  common_mistakes,
  content_source,
  status
)
select
  e.id,
  array[v.direction],
  array[v.cue],
  array[v.avoid],
  'editorial',
  'published'
from (
  values
    ('goblet-squat', 'Lower under control, then stand tall.', 'Keep the weight close, brace the trunk and drive the floor away.', 'Do not let the knees collapse inward or the heels lift.'),
    ('walking-lunge', 'Step, lower and push through the front leg.', 'Take a stable step and lower both knees while keeping the front foot planted.', 'Do not slam the back knee or lose balance through the front foot.'),
    ('incline-dumbbell-press', 'Lower to a comfortable depth, then press smoothly.', 'Keep the shoulder blades supported and press the dumbbells over the upper chest.', 'Do not flare the elbows straight out or bounce at the bottom.'),
    ('push-up', 'Lower the chest under control, then fully press away.', 'Maintain one straight line from head to heels and press the floor away.', 'Do not let the hips sag or the shoulders shrug toward the ears.'),
    ('lat-pulldown', 'Reach overhead, then pull elbows down.', 'Set the shoulders down and pull the bar toward the upper chest.', 'Do not swing backward or pull the bar behind the neck.'),
    ('seated-cable-row', 'Reach forward with control, then row to the torso.', 'Stay tall and pull the handle toward the lower ribs with the elbows close.', 'Do not round the back or turn the movement into a body swing.'),
    ('single-arm-dumbbell-row', 'Let the arm lengthen, then row without rotating.', 'Keep the torso stable and pull the elbow toward the hip.', 'Do not twist the trunk or shrug the working shoulder.'),
    ('romanian-deadlift', 'Hinge until the hamstrings load, then stand by driving the hips forward.', 'Push the hips back while keeping the load close to the legs.', 'Do not turn it into a squat or round the lower back.'),
    ('glute-bridge', 'Lift the hips until the trunk and thighs align.', 'Brace the ribs down and squeeze the glutes to lift the hips.', 'Do not overarch the lower back at the top.'),
    ('barbell-hip-thrust', 'Lower the hips under control, then drive upward.', 'Keep the chin tucked and finish with the glutes, not the lower back.', 'Do not hyperextend at the top or let the knees collapse inward.'),
    ('dead-bug', 'Extend slowly, return and alternate sides.', 'Press the lower back gently into the floor while extending opposite limbs.', 'Do not let the ribs flare or the lower back lift.'),
    ('leg-press', 'Lower the platform with control, then press through the feet.', 'Keep the whole foot planted and lower until the pelvis remains stable.', 'Do not lock the knees hard or let the lower back roll off the pad.'),
    ('seated-leg-curl', 'Straighten under control, then curl through the hamstrings.', 'Keep the hips against the pad and curl the heels back smoothly.', 'Do not lift the hips or use momentum.'),
    ('leg-extension', 'Lift the pad smoothly, pause and lower with control.', 'Keep the hips down and extend the knees without swinging.', 'Do not slam into lockout or use a load that changes your posture.'),
    ('dumbbell-lateral-raise', 'Raise out to the sides, then lower slowly.', 'Lead with the elbows and raise only to a comfortable shoulder height.', 'Do not shrug or swing the dumbbells upward.'),
    ('standing-calf-raise', 'Lower the heels fully, then rise as high as control allows.', 'Rise through the balls of the feet and pause at the top.', 'Do not bounce or roll the ankles outward.'),
    ('cable-chest-fly', 'Open with control, then sweep the arms forward.', 'Keep a soft elbow bend and bring the hands together in a wide arc.', 'Do not turn the movement into a press or overstretch the shoulders.'),
    ('face-pull', 'Reach forward, then pull toward the face.', 'Pull toward eye level and separate the hands as the elbows move back.', 'Do not lean backward or shrug the shoulders.'),
    ('triceps-pushdown', 'Control the return, then press the handle down.', 'Pin the upper arms beside the torso and straighten only at the elbows.', 'Do not rock the body or let the elbows drift forward.'),
    ('overhead-triceps-extension', 'Bend the elbows under control, then fully extend.', 'Keep the upper arms steady and extend through the elbows.', 'Do not flare the ribs or move the shoulders excessively.'),
    ('hammer-curl', 'Lower fully, then curl with steady elbows.', 'Keep the palms facing inward and curl without moving the upper arms.', 'Do not swing the torso or let the elbows travel forward.'),
    ('barbell-curl', 'Curl without swinging, then lower slowly.', 'Stand tall and curl the bar while keeping the elbows close to the body.', 'Do not lean backward or shorten the lowering phase.'),
    ('cable-crunch', 'Round through the trunk, pause and return under control.', 'Bring the ribs toward the pelvis while keeping the hips mostly still.', 'Do not pull only with the arms or sit the hips backward.')
) as v(slug, direction, cue, avoid)
join public.exercise_library e on e.slug = v.slug
on conflict (exercise_id) do update
set
  execution_steps = excluded.execution_steps,
  coaching_cues = excluded.coaching_cues,
  common_mistakes = excluded.common_mistakes,
  content_source = excluded.content_source,
  status = excluded.status,
  version = public.exercise_technique_guides.version + 1,
  is_active = true,
  updated_at = now();

commit;
