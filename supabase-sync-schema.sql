-- RunTrack Pro no-login private sync
-- Apply once in the Supabase SQL Editor.
-- The client generates a 256-bit random sync code (43 base64url characters).
-- Only its SHA-256 hash is stored. Keep the code private: it is a bearer credential.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.runtrack_sync_v1 (
  code_hash bytea primary key,
  payload jsonb not null default jsonb_build_object(
    'version', 1,
    'runs', '[]'::jsonb,
    'settings', '{}'::jsonb,
    'settingsUpdatedAt', 0,
    'deletedRunIds', '[]'::jsonb
  ),
  updated_at timestamptz not null default now()
);

alter table public.runtrack_sync_v1 enable row level security;

-- No direct table access from browser roles. All access goes through the two RPCs.
revoke all on table public.runtrack_sync_v1 from public, anon, authenticated;

-- Keep database validation aligned with the payload accepted by the app.
alter table public.runtrack_sync_v1
  drop constraint if exists runtrack_sync_v1_payload_object,
  drop constraint if exists runtrack_sync_v1_payload_runs,
  drop constraint if exists runtrack_sync_v1_payload_size;

alter table public.runtrack_sync_v1
  add constraint runtrack_sync_v1_payload_object
    check (jsonb_typeof(payload) = 'object'),
  add constraint runtrack_sync_v1_payload_runs
    check (jsonb_typeof(payload->'runs') = 'array'),
  add constraint runtrack_sync_v1_payload_size
    check (pg_column_size(payload) <= 5000000);

-- SECURITY DEFINER is intentional: clients have no login and no direct table grants.
-- Fixed search_path and schema-qualified references prevent object-shadowing attacks.
create or replace function public.runtrack_sync_get(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $function$
declare
  v_result jsonb;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{40,50}$' then
    raise exception 'Invalid sync code' using errcode = '22023';
  end if;

  select jsonb_build_object('payload', payload, 'updated_at', updated_at)
    into v_result
  from public.runtrack_sync_v1
  where code_hash = extensions.digest(convert_to(p_code, 'UTF8'), 'sha256');

  return v_result;
end;
$function$;

create or replace function public.runtrack_sync_save(p_code text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $function$
declare
  v_updated_at timestamptz;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{40,50}$' then
    raise exception 'Invalid sync code' using errcode = '22023';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(p_payload->'runs') <> 'array'
     or pg_column_size(p_payload) > 5000000 then
    raise exception 'Invalid or oversized RunTrack payload (maximum 5 MB)' using errcode = '22023';
  end if;

  insert into public.runtrack_sync_v1 (code_hash, payload, updated_at)
  values (
    extensions.digest(convert_to(p_code, 'UTF8'), 'sha256'),
    p_payload,
    now()
  )
  on conflict (code_hash)
  do update set payload = excluded.payload, updated_at = excluded.updated_at
  returning updated_at into v_updated_at;

  return jsonb_build_object('ok', true, 'updated_at', v_updated_at);
end;
$function$;

-- This app is explicitly no-login, so only the anon role needs RPC execution.
revoke all on function public.runtrack_sync_get(text) from public, anon, authenticated;
revoke all on function public.runtrack_sync_save(text, jsonb) from public, anon, authenticated;
grant execute on function public.runtrack_sync_get(text) to anon;
grant execute on function public.runtrack_sync_save(text, jsonb) to anon;
