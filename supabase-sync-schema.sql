-- RunTrack Pro no-login private sync
-- Supabase Dashboard -> SQL Editor -> New query -> paste and Run.
-- A 256-bit random sync code is the only credential. The app stores only its SHA-256 hash.
-- Do not expose direct table access to anon; clients can only call these narrow RPC functions.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.runtrack_sync_v1 (
  code_hash bytea primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.runtrack_sync_v1 enable row level security;
revoke all on public.runtrack_sync_v1 from anon, authenticated, public;

drop function if exists public.runtrack_sync_get(text);
create function public.runtrack_sync_get(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  result jsonb;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{40,50}$' then
    raise exception 'Invalid sync code';
  end if;
  select jsonb_build_object('payload', payload, 'updated_at', updated_at)
    into result
    from public.runtrack_sync_v1
   where code_hash = digest(convert_to(p_code, 'UTF8'), 'sha256');
  return result;
end;
$$;

drop function if exists public.runtrack_sync_save(text, jsonb);
create function public.runtrack_sync_save(p_code text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  saved_at timestamptz;
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{40,50}$' then
    raise exception 'Invalid sync code';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(p_payload->'runs') <> 'array'
     or pg_column_size(p_payload) > 5000000 then
    raise exception 'Invalid or oversized RunTrack payload (maximum 5 MB)';
  end if;
  insert into public.runtrack_sync_v1(code_hash, payload, updated_at)
  values (digest(convert_to(p_code, 'UTF8'), 'sha256'), p_payload, now())
  on conflict (code_hash) do update
    set payload = excluded.payload, updated_at = now()
  returning updated_at into saved_at;
  return jsonb_build_object('ok', true, 'updated_at', saved_at);
end;
$$;

revoke all on function public.runtrack_sync_get(text) from public;
revoke all on function public.runtrack_sync_save(text, jsonb) from public;
grant execute on function public.runtrack_sync_get(text) to anon, authenticated;
grant execute on function public.runtrack_sync_save(text, jsonb) to anon, authenticated;
