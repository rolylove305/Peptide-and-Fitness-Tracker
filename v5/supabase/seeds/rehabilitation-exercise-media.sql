-- Apply after the rehabilitation JPEGs are available in the production deployment.
-- Add media only to exercises that do not already have an active image.
insert into public.exercise_media_assets (
  exercise_id, media_kind, media_role, url, alt_text,
  width, height, is_primary, rights_status, metadata
)
select e.id, 'image', 'hero',
  'https://app.biotrackai.online/exercise-media/rehabilitation/' || e.slug || '/hero.jpg',
  e.name || ' demonstration: starting position and controlled movement',
  800, 450, true, 'generated',
  jsonb_build_object('asset_pack', 'rehabilitation-2026-10', 'generator', 'imagegen')
from public.exercise_library e
join (values
  ('shoulder-pendulum'),
  ('cross-body-shoulder-stretch'),
  ('scapular-setting'),
  ('wall-slide'),
  ('band-external-rotation'),
  ('band-internal-rotation'),
  ('band-standing-row'),
  ('side-lying-external-rotation'),
  ('prone-horizontal-abduction')
) requested(slug) on requested.slug = e.slug
where e.is_active and not exists (
  select 1 from public.exercise_media_assets existing
  where existing.exercise_id = e.id and existing.is_active
);

