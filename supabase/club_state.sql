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
  nick text;
  coach text;
  coaches jsonb;
  player jsonb;
  is_coach boolean := false;
begin
  if actor is null or nullif(actor->>'id', '') is null then
    return 'deny';
  end if;
  nick := private.norm_nick(actor->>'username');
  select coach_telegram_id into coach_id from private.club_gate where id = 'default';
  if coach_id is not null and coach_id <> '' and actor->>'id' = coach_id then
    is_coach := true;
  end if;
  -- Same nicks as the Mini App, and only after HMAC (actor is already tg_user).
  -- @Artem_Serdyuk is a player and never the coach.
  if nick <> '' and nick not in ('artem_serdyuk', 'artem_serdiuk') then
    if nick = 'serdiuk_artem' then
      is_coach := true;
    end if;
    coaches := payload #> '{settings,rbac,coaches}';
    if coaches is null or jsonb_typeof(coaches) <> 'array' then
      coaches := '[]'::jsonb;
    end if;
    for coach in select value from jsonb_array_elements_text(coaches) loop
      if private.norm_nick(coach) in ('artem_serdyuk', 'artem_serdiuk') then
        continue;
      end if;
      if private.norm_nick(coach) = actor->>'id' or private.norm_nick(coach) = nick then
        is_coach := true;
      end if;
    end loop;
  end if;
  if is_coach then
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
    if nick <> '' and private.norm_nick(player->>'telegramUsername') = nick then
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

create or replace function private.merge_self_profile(current jsonb, incoming jsonb, actor jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  players jsonb;
  gifts jsonb;
  inc jsonb;
  mine jsonb;
  item jsonb;
  profile jsonb;
  actor_id text;
  nick text;
  mine_id text;
  birth text;
  photo text;
  key text := '';
  owns boolean := false;
  i int;
  idx int;
begin
  if current is null or incoming is null or actor is null or nullif(actor->>'id', '') is null then
    return current;
  end if;
  if jsonb_typeof(current->'players') <> 'array' or jsonb_typeof(incoming->'players') <> 'array' then
    return current;
  end if;
  actor_id := actor->>'id';
  nick := private.norm_nick(actor->>'username');
  players := current->'players';
  idx := null;
  for i in 0 .. jsonb_array_length(players) - 1 loop
    item := players->i;
    if (item->>'telegramId' is not null and item->>'telegramId' = actor_id)
       or (item->>'linkedTelegramId' is not null and item->>'linkedTelegramId' = actor_id)
       or (nick <> '' and private.norm_nick(item->>'telegramUsername') = nick) then
      mine := item;
      idx := i;
      exit;
    end if;
  end loop;
  if idx is null then
    return current;
  end if;
  mine_id := mine->>'id';
  inc := null;
  for i in 0 .. jsonb_array_length(incoming->'players') - 1 loop
    if (incoming->'players'->i)->>'id' = mine_id then
      inc := incoming->'players'->i;
      exit;
    end if;
  end loop;
  if inc is null then
    return current;
  end if;

  if inc ? 'firstName' and jsonb_typeof(inc->'firstName') <> 'null' then
    mine := jsonb_set(mine, '{firstName}', to_jsonb(left(inc->>'firstName', 40)));
  end if;
  if inc ? 'lastName' and jsonb_typeof(inc->'lastName') <> 'null' then
    mine := jsonb_set(mine, '{lastName}', to_jsonb(left(inc->>'lastName', 40)));
  end if;
  if inc ? 'birthDate' and jsonb_typeof(inc->'birthDate') <> 'null' then
    birth := btrim(coalesce(inc->>'birthDate', ''));
    if birth = '' or birth ~ '^\d{4}-\d{2}-\d{2}$' then
      mine := jsonb_set(mine, '{birthDate}', to_jsonb(birth));
    end if;
  end if;
  if inc ? 'phone' and jsonb_typeof(inc->'phone') <> 'null' then
    mine := jsonb_set(mine, '{phone}', to_jsonb(left(inc->>'phone', 40)));
  end if;
  if inc ? 'bio' and jsonb_typeof(inc->'bio') <> 'null' then
    mine := jsonb_set(mine, '{bio}', to_jsonb(left(inc->>'bio', 400)));
  end if;
  if inc ? 'statusText' and jsonb_typeof(inc->'statusText') <> 'null' then
    mine := jsonb_set(mine, '{statusText}', to_jsonb(left(inc->>'statusText', 80)));
  end if;
  foreach photo in array ARRAY['profilePhoto', 'photoUrl']::text[] loop
    if not (inc ? photo) or jsonb_typeof(inc->photo) = 'null' then
      continue;
    end if;
    if coalesce(inc->>photo, '') = '' then
      mine := jsonb_set(mine, array[photo], '""'::jsonb);
    elsif left(inc->>photo, 11) = 'data:image/' and length(inc->>photo) <= 400000 then
      mine := jsonb_set(mine, array[photo], to_jsonb(inc->>photo));
    elsif left(inc->>photo, 8) = 'https://' and length(inc->>photo) <= 500 then
      mine := jsonb_set(mine, array[photo], to_jsonb(inc->>photo));
    end if;
  end loop;
  if inc ? 'profile' and jsonb_typeof(inc->'profile') = 'object' then
    profile := case when jsonb_typeof(mine->'profile') = 'object' then mine->'profile' else '{}'::jsonb end;
    if inc->'profile' ? 'phone' then profile := jsonb_set(profile, '{phone}', to_jsonb(left(inc->'profile'->>'phone', 40))); end if;
    if inc->'profile' ? 'social' then profile := jsonb_set(profile, '{social}', to_jsonb(left(inc->'profile'->>'social', 200))); end if;
    if inc->'profile' ? 'status' then profile := jsonb_set(profile, '{status}', to_jsonb(left(inc->'profile'->>'status', 80))); end if;
    if inc->'profile' ? 'bio' then profile := jsonb_set(profile, '{bio}', to_jsonb(left(inc->'profile'->>'bio', 400))); end if;
    if inc->'profile' ? 'birthDate' then
      birth := btrim(coalesce(inc->'profile'->>'birthDate', ''));
      if birth = '' or birth ~ '^\d{4}-\d{2}-\d{2}$' then
        profile := jsonb_set(profile, '{birthDate}', to_jsonb(birth));
      end if;
    end if;
    mine := jsonb_set(mine, '{profile}', profile);
  end if;
  if coalesce(mine->>'birthDate', '') <> '' then
    profile := case when jsonb_typeof(mine->'profile') = 'object' then mine->'profile' else '{}'::jsonb end;
    profile := jsonb_set(profile, '{birthDate}', to_jsonb(mine->>'birthDate'));
    mine := jsonb_set(mine, '{profile}', profile);
  end if;

  gifts := case when jsonb_typeof(current->'gifts') = 'array' then current->'gifts' else '[]'::jsonb end;
  if jsonb_typeof(incoming->'gifts') = 'array' then
    for i in 0 .. jsonb_array_length(incoming->'gifts') - 1 loop
      item := incoming->'gifts'->i;
      if coalesce(item->>'featured', '') in ('true', 't') and item->>'playerId' = mine_id then
        key := left(coalesce(item->>'uid', item->>'id', ''), 80);
        exit;
      end if;
    end loop;
  end if;
  if key <> '' then
    for i in 0 .. jsonb_array_length(gifts) - 1 loop
      item := gifts->i;
      if item->>'playerId' = mine_id and left(coalesce(item->>'uid', item->>'id', ''), 80) = key then
        owns := true;
        exit;
      end if;
    end loop;
  end if;
  if owns then
    for i in 0 .. jsonb_array_length(gifts) - 1 loop
      item := gifts->i;
      if item->>'playerId' is distinct from mine_id then
        continue;
      end if;
      item := jsonb_set(item, '{featured}', to_jsonb(left(coalesce(item->>'uid', item->>'id', ''), 80) = key));
      gifts := jsonb_set(gifts, array[i::text], item);
      if coalesce(item->>'featured', '') = 'true' and item ? 'hue' and jsonb_typeof(item->'hue') <> 'null' then
        mine := jsonb_set(mine, '{themeHue}', item->'hue');
        mine := jsonb_set(mine, '{featuredGiftId}', to_jsonb(coalesce(item->>'giftId', mine->>'featuredGiftId', '')));
      end if;
    end loop;
    current := jsonb_set(current, '{gifts}', gifts);
  end if;
  players := jsonb_set(players, array[idx::text], mine);
  return jsonb_set(current, '{players}', players);
end;
$$;

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
    -- PT409 is the PostgREST status code. 40001 becomes HTTP 500 and the Mini App retries.
    raise exception using
      errcode = 'PT409',
      message = 'stale',
      detail = jsonb_build_object(
        'ok', false,
        'error', 'stale',
        'updatedAt', row.updated_at,
        'updated_at', row.updated_at,
        'updatedBy', row.updated_by,
        'updated_by', row.updated_by,
        'payload', row.payload
      )::text;
  end if;
  if role = 'full' then
    next_payload := payload;
    if row.id is not null then
      next_payload := jsonb_set(
        next_payload,
        '{chat}',
        private.merge_chat(row.payload->'chat', payload->'chat', null),
        true
      );
    end if;
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
    next_payload := private.merge_self_profile(next_payload, payload, actor);
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
revoke all on function private.merge_self_profile(jsonb, jsonb, jsonb) from public, anon, authenticated;

revoke all on function public.club_pull(text, text) from public;
revoke all on function public.club_push(jsonb, timestamptz, text, text, text) from public;
grant execute on function public.club_pull(text, text) to anon, authenticated;
grant execute on function public.club_push(jsonb, timestamptz, text, text, text) to anon, authenticated;
