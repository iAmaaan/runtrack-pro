-- RunTrack Pro Google Health API connection storage
-- Edge Function only: browser roles have no access to these tables.
create table if not exists public.google_health_oauth_states (
  state_hash text primary key,
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists public.google_health_connections (
  code_hash text primary key,
  health_user_id text not null,
  legacy_user_id text,
  refresh_token_ciphertext text not null,
  granted_scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_sync_error text
);
alter table public.google_health_oauth_states enable row level security;
alter table public.google_health_connections enable row level security;
revoke all on table public.google_health_oauth_states from public, anon, authenticated;
revoke all on table public.google_health_connections from public, anon, authenticated;
grant all on table public.google_health_oauth_states to service_role;
grant all on table public.google_health_connections to service_role;
create index if not exists google_health_oauth_states_expires_idx
  on public.google_health_oauth_states(expires_at);
delete from public.google_health_oauth_states where expires_at < now();
