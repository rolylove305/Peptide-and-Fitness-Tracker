begin;

create table public.peptide_inventory_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  protocol_id uuid references public.peptide_protocols(id) on delete set null,
  peptide_name text not null check (char_length(btrim(peptide_name)) between 2 and 120),
  lot_number text check (
    lot_number is null or char_length(btrim(lot_number)) between 1 and 120
  ),
  quantity_remaining numeric(12,4) not null check (
    quantity_remaining >= 0 and quantity_remaining <= 1000000
  ),
  quantity_unit text not null check (
    quantity_unit in ('vials', 'mg', 'mL', 'units')
  ),
  low_stock_threshold numeric(12,4) check (
    low_stock_threshold is null
    or (low_stock_threshold >= 0 and low_stock_threshold <= 1000000)
  ),
  opened_on date,
  expires_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on is null or opened_on is null or expires_on >= opened_on)
);

create index peptide_inventory_lots_user_active_idx
on public.peptide_inventory_lots(user_id, is_active, expires_on);

create index peptide_inventory_lots_protocol_idx
on public.peptide_inventory_lots(protocol_id)
where protocol_id is not null;

create trigger peptide_inventory_lots_set_updated_at
before update on public.peptide_inventory_lots
for each row execute function public.biotrack_set_updated_at();

alter table public.peptide_inventory_lots enable row level security;

revoke all on public.peptide_inventory_lots from anon;
grant select, insert, update, delete on public.peptide_inventory_lots to authenticated;
grant all on public.peptide_inventory_lots to service_role;

create policy "Users can read own peptide inventory"
on public.peptide_inventory_lots for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own peptide inventory"
on public.peptide_inventory_lots for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    protocol_id is null
    or exists (
      select 1
      from public.peptide_protocols p
      where p.id = protocol_id
        and p.user_id = (select auth.uid())
    )
  )
);

create policy "Users can update own peptide inventory"
on public.peptide_inventory_lots for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    protocol_id is null
    or exists (
      select 1
      from public.peptide_protocols p
      where p.id = protocol_id
        and p.user_id = (select auth.uid())
    )
  )
);

create policy "Users can delete own peptide inventory"
on public.peptide_inventory_lots for delete to authenticated
using ((select auth.uid()) = user_id);

commit;
