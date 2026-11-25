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
drop policy if exists club_media_delete on storage.objects;

create policy club_media_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'club-media');
create policy club_media_insert on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'club-media');
create policy club_media_update on storage.objects
  for update to anon, authenticated using (bucket_id = 'club-media') with check (bucket_id = 'club-media');
create policy club_media_delete on storage.objects
  for delete to anon, authenticated using (bucket_id = 'club-media');

create or replace function public.club_server_stats()
returns json
language sql
stable
security definer
set search_path = public, storage
as $$
  select json_build_object(
    'files', (select count(*)::int from storage.objects where bucket_id = 'club-media'),
    'bytes', (
      select coalesce(sum(
        coalesce((metadata->>'size')::bigint, (metadata->>'contentLength')::bigint, 0)
      ), 0)
      from storage.objects
      where bucket_id = 'club-media'
    ),
    'db_bytes', pg_database_size(current_database())
  );
$$;

revoke all on function public.club_server_stats() from public;
grant execute on function public.club_server_stats() to anon, authenticated;

notify pgrst, 'reload schema';
