-- Club snapshot gate for https://zloluzqzswdwaimlqlqx.supabase.co
-- Run once in Supabase → SQL Editor (as postgres). Re-running is safe.
--
-- anon cannot read or write public.club_state.
-- Windows app: anon key + club_write_key (stored only on the coach PC).
-- Mini App: anon key + Telegram initData. The bot token never leaves private.club_gate.
-- After this script, set the two secrets in the editor (do not commit them):
--   update private.club_gate
--   set bot_token = '<telegram bot token>',
--       club_write_key = '<long random secret, same value as in the Windows app>',
--       coach_telegram_id = '<numeric Telegram user id of the coach>'
--   where id = 'default';

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

create table if not exists public.club_state (
  id text primary key,
  updated_at timestamptz not null default now(),
  updated_by text,
  payload jsonb not null
);

create table if not exists private.club_gate (
  id text primary key,
  bot_token text not null default '',
  club_write_key text not null default '',
  coach_telegram_id text not null default ''
);

alter table private.club_gate add column if not exists coach_telegram_id text not null default '';

insert into private.club_gate (id, bot_token, club_write_key)
values ('default', '', '')
on conflict (id) do nothing;

revoke all on schema private from public, anon, authenticated;
revoke all on table private.club_gate from public, anon, authenticated;

alter table public.club_state enable row level security;
alter table public.club_state force row level security;

drop policy if exists club_state_read on public.club_state;
drop policy if exists club_state_write on public.club_state;
drop policy if exists club_state_update on public.club_state;

revoke all on table public.club_state from public, anon, authenticated;

create or replace function private.url_decode(input text)
returns text
language plpgsql
immutable
as $$
declare
  i int := 1;
  len int;
  out bytea := ''::bytea;
  c text;
  hex text;
begin
  if input is null then return null; end if;
  len := length(input);
  while i <= len loop
    c := substr(input, i, 1);
    if c = '+' then
      out := out || convert_to(' ', 'utf8');
      i := i + 1;
    elsif c = '%' and i + 2 <= len then
      hex := substr(input, i + 1, 2);
      out := out || decode(hex, 'hex');
      i := i + 3;
    else
      out := out || convert_to(c, 'utf8');
      i := i + 1;
    end if;
  end loop;
  return convert_from(out, 'utf8');
exception when others then
  return input;
end;
$$;

create or replace function private.club_key_ok(club_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = private, extensions, public
as $$
declare
  stored text;
begin
  select club_write_key into stored from private.club_gate where id = 'default';
  if stored is null or length(stored) < 16 or club_key is null or length(club_key) < 16 then
    return false;
  end if;
  return stored = club_key;
end;
$$;

create or replace function private.tg_user(init_data text)
returns jsonb
language plpgsql
stable
security definer
set search_path = private, extensions, public
as $$
declare
  bot text;
  parts text[];
  pair text;
  k text;
  v text;
  hash text := '';
  auth_date bigint := 0;
  user_json text := '';
  check_pairs text[] := array[]::text[];
  data_check text;
  secret bytea;
  calc text;
  now_sec bigint;
begin
  select bot_token into bot from private.club_gate where id = 'default';
  if bot is null or position(':' in bot) = 0 then
    return null;
  end if;
  if init_data is null or length(init_data) < 10 then
    return null;
  end if;
  parts := string_to_array(init_data, '&');
  foreach pair in array parts loop
    k := split_part(pair, '=', 1);
    v := private.url_decode(substr(pair, length(k) + 2));
    if k = 'hash' then
      hash := v;
    else
      check_pairs := array_append(check_pairs, k || '=' || v);
    end if;
    if k = 'auth_date' then
      auth_date := v::bigint;
    elsif k = 'user' then
      user_json := v;
    end if;
  end loop;
  if hash !~ '^[a-fA-F0-9]{64}$' then
    return null;
  end if;
  select string_agg(p, E'\n' order by p) into data_check from unnest(check_pairs) as p;
  secret := extensions.hmac(convert_to(bot, 'utf8'), convert_to('WebAppData', 'utf8'), 'sha256');
  calc := encode(extensions.hmac(convert_to(data_check, 'utf8'), secret, 'sha256'), 'hex');
  if lower(calc) is distinct from lower(hash) then
    return null;
  end if;
  now_sec := floor(extract(epoch from now()));
  if auth_date = 0 or now_sec - auth_date > 86400 or auth_date > now_sec + 60 then
    return null;
  end if;
  if user_json is null or user_json = '' then
    return null;
  end if;
  return user_json::jsonb;
exception when others then
  return null;
end;
$$;

create or replace function private.norm_nick(value text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(value, ''), '^@', ''));
$$;

create or replace function private.club_role(actor jsonb, payload jsonb)
returns text
language plpgsql
stable
as $$
declare
  coach_id text;
  player jsonb;
begin
  if actor is null or actor->>'id' is null then
    return 'deny';
  end if;
  select coach_telegram_id into coach_id from private.club_gate where id = 'default';
  if coach_id is not null and coach_id <> '' and actor->>'id' = coach_id then
    return 'full';
  end if;
  if payload is null or jsonb_typeof(payload->'players') <> 'array' then
    return 'deny';
  end if;
  for player in select value from jsonb_array_elements(payload->'players') loop
    if player->>'telegramId' is not null and player->>'telegramId' = actor->>'id' then
      return 'chat';
    end if;
    if player->>'linkedTelegramId' is not null and player->>'linkedTelegramId' = actor->>'id' then
      return 'chat';
    end if;
  end loop;
  return 'deny';
end;
$$;

create or replace function private.merge_chat(current jsonb, incoming jsonb, actor jsonb default null)
returns jsonb
language plpgsql
stable
as $$
declare
  item jsonb;
  acc jsonb := '{}'::jsonb;
  id text;
  existing jsonb;
  actor_id text;
begin
  actor_id := nullif(actor->>'id', '');
  for item in select value from jsonb_array_elements(coalesce(current, '[]'::jsonb)) loop
    id := left(coalesce(item->>'id', ''), 80);
    if id = '' or length(btrim(coalesce(item->>'text', ''))) = 0 then continue; end if;
    acc := acc || jsonb_build_object(id, item);
  end loop;
  for item in select value from jsonb_array_elements(coalesce(incoming, '[]'::jsonb)) loop
    id := left(coalesce(item->>'id', ''), 80);
    if id = '' or length(btrim(coalesce(item->>'text', ''))) = 0 then continue; end if;
    if actor_id is null then
      acc := acc || jsonb_build_object(id, item);
    else
      existing := acc->id;
      if existing is not null and coalesce(existing->>'telegramId', existing->>'playerId', '') is distinct from actor_id then
        continue;
      end if;
      acc := acc || jsonb_build_object(id, jsonb_build_object(
        'id', id,
        'text', left(btrim(item->>'text'), 500),
        'authorName', left(coalesce(actor->>'first_name', actor->>'username', 'Гравець'), 80),
        'authorRole', 'player',
        'playerId', actor_id,
        'telegramId', actor_id,
        'createdAt', coalesce(item->>'createdAt', '')
      ));
    end if;
  end loop;
  return (
    select coalesce(jsonb_agg(value order by value->>'createdAt'), '[]'::jsonb)
    from (
      select value from jsonb_each(acc)
      order by value->>'createdAt' desc
      limit 300
    ) newest
  );
end;
$$;

drop function if exists private.merge_chat(jsonb, jsonb);

create or replace function public.club_pull(init_data text default null, club_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  row public.club_state;
  actor jsonb;
  allowed boolean := false;
begin
  if private.club_key_ok(club_key) then
    allowed := true;
  else
    actor := private.tg_user(init_data);
    select * into row from public.club_state where id = 'metalist';
    if actor is not null and private.club_role(actor, row.payload) in ('full', 'chat') then
      allowed := true;
    end if;
  end if;
  if not allowed then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select * into row from public.club_state where id = 'metalist';
  if row.id is null then
    return jsonb_build_object('empty', true);
  end if;
  return jsonb_build_object(
    'updated_at', row.updated_at,
    'updatedAt', row.updated_at,
    'updated_by', row.updated_by,
    'updatedBy', row.updated_by,
    'payload', row.payload
  );
end;
$$;

create or replace function public.club_push(
  payload jsonb,
  updated_at timestamptz,
  updated_by text default 'coach',
  init_data text default null,
  club_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  row public.club_state;
  actor jsonb;
  role text := 'deny';
  next_payload jsonb;
  stamp timestamptz;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'payload_required' using errcode = '22023';
  end if;
  select * into row from public.club_state where id = 'metalist';
  if private.club_key_ok(club_key) then
    role := 'full';
  else
    actor := private.tg_user(init_data);
    role := private.club_role(actor, row.payload);
  end if;
  if role = 'deny' then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  stamp := coalesce(updated_at, now());
  if row.updated_at is not null and stamp < row.updated_at and role = 'full' then
    raise exception 'stale' using errcode = '40001';
  end if;
  if role = 'full' then
    next_payload := payload;
  else
    if row.id is null then
      raise exception 'unauthorized' using errcode = '42501';
    end if;
    next_payload := jsonb_set(
      row.payload,
      '{chat}',
      private.merge_chat(row.payload->'chat', payload->'chat', actor),
      true
    );
    stamp := now();
    updated_by := coalesce(nullif(updated_by, ''), 'player');
  end if;
  insert into public.club_state (id, updated_at, updated_by, payload)
  values ('metalist', stamp, coalesce(updated_by, 'coach'), next_payload)
  on conflict (id) do update
    set updated_at = excluded.updated_at,
        updated_by = excluded.updated_by,
        payload = excluded.payload;
  return jsonb_build_object(
    'ok', true,
    'role', role,
    'updated_at', stamp,
    'updatedAt', stamp,
    'updated_by', coalesce(updated_by, 'coach'),
    'updatedBy', coalesce(updated_by, 'coach')
  );
end;
$$;

revoke all on function private.url_decode(text) from public, anon, authenticated;
revoke all on function private.club_key_ok(text) from public, anon, authenticated;
revoke all on function private.tg_user(text) from public, anon, authenticated;
revoke all on function private.norm_nick(text) from public, anon, authenticated;
revoke all on function private.club_role(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.merge_chat(jsonb, jsonb, jsonb) from public, anon, authenticated;

revoke all on function public.club_pull(text, text) from public;
revoke all on function public.club_push(jsonb, timestamptz, text, text, text) from public;
grant execute on function public.club_pull(text, text) to anon, authenticated;
grant execute on function public.club_push(jsonb, timestamptz, text, text, text) to anon, authenticated;
