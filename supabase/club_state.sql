-- One club snapshot. Run once in Supabase → SQL Editor.
-- Project: https://zloluzqzswdwaimlqlqx.supabase.co

create table if not exists public.club_state (
  id text primary key,
  updated_at timestamptz not null default now(),
  updated_by text,
  payload jsonb not null
);

alter table public.club_state enable row level security;

drop policy if exists club_state_read on public.club_state;
drop policy if exists club_state_write on public.club_state;
drop policy if exists club_state_update on public.club_state;

create policy club_state_read on public.club_state
  for select to anon, authenticated using (true);

create policy club_state_write on public.club_state
  for insert to anon, authenticated with check (true);

create policy club_state_update on public.club_state
  for update to anon, authenticated using (true) with check (true);

grant select, insert, update on public.club_state to anon, authenticated;
