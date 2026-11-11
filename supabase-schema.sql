-- RunTrack Pro cloud storage
-- Run this once in Supabase Dashboard -> SQL Editor -> New query.

create table if not exists public.runtrack_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default jsonb_build_object('runs', '[]'::jsonb, 'settings', '{}'::jsonb),
  updated_at timestamptz not null default now()
);

alter table public.runtrack_data enable row level security;

drop policy if exists "Users can read own RunTrack data" on public.runtrack_data;
create policy "Users can read own RunTrack data"
  on public.runtrack_data for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own RunTrack data" on public.runtrack_data;
create policy "Users can insert own RunTrack data"
  on public.runtrack_data for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own RunTrack data" on public.runtrack_data;
create policy "Users can update own RunTrack data"
  on public.runtrack_data for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own RunTrack data" on public.runtrack_data;
create policy "Users can delete own RunTrack data"
  on public.runtrack_data for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.runtrack_data to authenticated;
