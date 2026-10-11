begin;

create table public.peptide_protocols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  peptide_name text not null check (char_length(btrim(peptide_name)) between 2 and 120),
  dose_amount numeric(12,4) not null check (dose_amount > 0 and dose_amount <= 1000000),
  dose_unit text not null check (dose_unit in ('mcg', 'mg', 'mL', 'units')),
  frequency_type text not null check (
    frequency_type in ('daily', 'selected_days', 'interval_days', 'as_needed')
  ),
  time_of_day time,
  days_of_week smallint[] not null default '{}',
  interval_days smallint,
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    frequency_type <> 'selected_days'
    or (
      cardinality(days_of_week) between 1 and 7
      and days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    )
  ),
  check (
    (frequency_type = 'interval_days' and interval_days between 1 and 365)
    or (frequency_type <> 'interval_days' and interval_days is null)
  ),
  check (end_date is null or end_date >= start_date)
);

create table public.peptide_administrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  protocol_id uuid not null references public.peptide_protocols(id) on delete restrict,
  peptide_name_snapshot text not null check (
    char_length(btrim(peptide_name_snapshot)) between 2 and 120
  ),
  dose_amount_snapshot numeric(12,4) not null check (
    dose_amount_snapshot > 0 and dose_amount_snapshot <= 1000000
  ),
  dose_unit_snapshot text not null check (
    dose_unit_snapshot in ('mcg', 'mg', 'mL', 'units')
  ),
  status text not null default 'taken' check (status in ('taken', 'skipped')),
  scheduled_for timestamptz,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index peptide_protocols_user_active_idx
on public.peptide_protocols(user_id, is_active, start_date desc);

create index peptide_administrations_user_recorded_idx
on public.peptide_administrations(user_id, recorded_at desc);

create index peptide_administrations_protocol_recorded_idx
on public.peptide_administrations(protocol_id, recorded_at desc);

create trigger peptide_protocols_set_updated_at
before update on public.peptide_protocols
for each row execute function public.biotrack_set_updated_at();

alter table public.peptide_protocols enable row level security;
alter table public.peptide_administrations enable row level security;

revoke all on public.peptide_protocols from anon;
revoke all on public.peptide_administrations from anon;

grant select, insert, update, delete on public.peptide_protocols to authenticated;
grant select, insert, update, delete on public.peptide_administrations to authenticated;
grant all on public.peptide_protocols to service_role;
grant all on public.peptide_administrations to service_role;

create policy "Users can read own peptide protocols"
on public.peptide_protocols for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own peptide protocols"
on public.peptide_protocols for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own peptide protocols"
on public.peptide_protocols for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own peptide protocols"
on public.peptide_protocols for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own peptide administrations"
on public.peptide_administrations for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own peptide administrations"
on public.peptide_administrations for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.peptide_protocols p
    where p.id = protocol_id
      and p.user_id = (select auth.uid())
  )
);

create policy "Users can update own peptide administrations"
on public.peptide_administrations for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.peptide_protocols p
    where p.id = protocol_id
      and p.user_id = (select auth.uid())
  )
);

create policy "Users can delete own peptide administrations"
on public.peptide_administrations for delete to authenticated
using ((select auth.uid()) = user_id);

commit;
