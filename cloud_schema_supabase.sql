-- Autologika Cloud 0.18 — Auth + RLS, wariant jedno-konto = jeden warsztat.
-- Uruchom w Supabase SQL Editor przed podłączeniem aplikacji.

create table if not exists public.sync_records (
  id bigint generated always as identity primary key,
  workshop_id uuid not null,
  entity_type text not null,
  cloud_id text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version bigint not null default 1,
  device_id text,
  unique(workshop_id, entity_type, cloud_id)
);
create index if not exists sync_records_updated_idx on public.sync_records(workshop_id,updated_at);
create index if not exists sync_records_entity_idx on public.sync_records(workshop_id,entity_type,cloud_id);

alter table public.sync_records enable row level security;

drop policy if exists "autologika_select_own" on public.sync_records;
drop policy if exists "autologika_insert_own" on public.sync_records;
drop policy if exists "autologika_update_own" on public.sync_records;
drop policy if exists "autologika_delete_own" on public.sync_records;

create policy "autologika_select_own" on public.sync_records for select to authenticated using (workshop_id = auth.uid());
create policy "autologika_insert_own" on public.sync_records for insert to authenticated with check (workshop_id = auth.uid());
create policy "autologika_update_own" on public.sync_records for update to authenticated using (workshop_id = auth.uid()) with check (workshop_id = auth.uid());
create policy "autologika_delete_own" on public.sync_records for delete to authenticated using (workshop_id = auth.uid());

-- Pliki (zdjęcia) — przygotowanie bucketu prywatnego pod kolejny etap.
insert into storage.buckets (id,name,public) values ('order-files','order-files',false) on conflict (id) do nothing;

drop policy if exists "autologika_files_select" on storage.objects;
drop policy if exists "autologika_files_insert" on storage.objects;
drop policy if exists "autologika_files_update" on storage.objects;
drop policy if exists "autologika_files_delete" on storage.objects;
create policy "autologika_files_select" on storage.objects for select to authenticated using (bucket_id='order-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "autologika_files_insert" on storage.objects for insert to authenticated with check (bucket_id='order-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "autologika_files_update" on storage.objects for update to authenticated using (bucket_id='order-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "autologika_files_delete" on storage.objects for delete to authenticated using (bucket_id='order-files' and (storage.foldername(name))[1] = auth.uid()::text);

-- 0.30: bezpieczne linki do zdalnej akceptacji kosztorysu.
create table if not exists public.customer_approval_links (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  token text not null unique,
  approval_local_id bigint not null,
  order_local_id bigint not null,
  snapshot jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','DECLINED')),
  customer_note text not null default '',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days')
);
alter table public.customer_approval_links enable row level security;
drop policy if exists "approval_links_owner_all" on public.customer_approval_links;
create policy "approval_links_owner_all" on public.customer_approval_links for all to authenticated
using (workshop_id=auth.uid()) with check (workshop_id=auth.uid());
create index if not exists customer_approval_links_owner_idx on public.customer_approval_links(workshop_id,status,created_at desc);
