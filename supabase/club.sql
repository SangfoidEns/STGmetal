-- Один клуб Metalist Stuttgart. Виконай цей файл один раз у Supabase → SQL Editor.
-- Ключ у застосунку — anon public, не service_role.

create table if not exists public.club_state (
  id text primary key,
  updated_at timestamptz not null default now(),
  updated_by text,
  rev bigint not null default 0,
  path text,
  payload jsonb
);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.club_state to anon, authenticated;

alter table public.club_state enable row level security;

drop policy if exists club_state_read on public.club_state;
drop policy if exists club_state_insert on public.club_state;
drop policy if exists club_state_update on public.club_state;

create policy club_state_read on public.club_state
  for select to anon, authenticated using (true);
create policy club_state_insert on public.club_state
  for insert to anon, authenticated with check (id = 'metalist');
create policy club_state_update on public.club_state
  for update to anon, authenticated using (id = 'metalist') with check (id = 'metalist');

insert into storage.buckets (id, name, public)
values ('club-media', 'club-media', true)
on conflict (id) do update set public = true;

drop policy if exists club_media_read on storage.objects;
drop policy if exists club_media_insert on storage.objects;
drop policy if exists club_media_update on storage.objects;

create policy club_media_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'club-media');
create policy club_media_insert on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'club-media');
create policy club_media_update on storage.objects
  for update to anon, authenticated using (bucket_id = 'club-media') with check (bucket_id = 'club-media');

notify pgrst, 'reload schema';
