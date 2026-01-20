-- PolarHealth Web Rebuild: Schema + RLS (Supabase Postgres)
-- Safe to run in Supabase SQL editor. Idempotent where practical.

-- Extensions
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------

-- Updated-at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create profile row automatically when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, timezone)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), coalesce(new.raw_user_meta_data->>'timezone', 'UTC'))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Core identity
-- ------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Connections (server-only tokens)
-- ------------------------------------------------------------

create table if not exists public.polar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  polar_user_id text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_polar_connections_updated_at on public.polar_connections;
create trigger trg_polar_connections_updated_at
before update on public.polar_connections
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Daily rollups and scores (powers most charts)
-- ------------------------------------------------------------

create table if not exists public.daily_metrics (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,

  -- Scores (0-100 unless noted)
  sleep_score int,
  recovery_score int,
  strain_score int,

  -- Core physiology
  hrv_ms double precision,
  resting_hr int,
  respiratory_rate double precision,
  spo2 double precision,

  -- Activity
  steps int,
  active_calories int,
  total_calories int,
  distance_m int,

  -- Optional extra metrics seen in UI
  cardiovascular_age int,
  stress_avg int,

  -- UI support
  last_computed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, date),

  constraint chk_scores_range check (
    (sleep_score is null or (sleep_score between 0 and 100)) and
    (recovery_score is null or (recovery_score between 0 and 100)) and
    (strain_score is null or (strain_score between 0 and 200))
  )
);

create index if not exists idx_daily_metrics_user_date on public.daily_metrics(user_id, date desc);

drop trigger if exists trg_daily_metrics_updated_at on public.daily_metrics;
create trigger trg_daily_metrics_updated_at
before update on public.daily_metrics
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Sleep
-- ------------------------------------------------------------

create table if not exists public.sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Polar identifiers
  polar_id text unique,

  -- Sleep interval
  sleep_start timestamptz not null,
  sleep_end timestamptz not null,
  sleep_date date not null, -- "morning of" date for grouping in UI

  duration_min int,
  time_in_bed_min int,
  efficiency_pct int,
  sleep_score int,

  -- Aggregates from series if available
  avg_hr int,
  min_hr int,
  max_hr int,
  avg_resp_rate double precision,

  -- Raw payload for traceability
  raw jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_sleep_score_range check (sleep_score is null or (sleep_score between 0 and 100)),
  constraint chk_efficiency_range check (efficiency_pct is null or (efficiency_pct between 0 and 100))
);

create index if not exists idx_sleep_sessions_user_date on public.sleep_sessions(user_id, sleep_date desc);
create index if not exists idx_sleep_sessions_user_start on public.sleep_sessions(user_id, sleep_start desc);

drop trigger if exists trg_sleep_sessions_updated_at on public.sleep_sessions;
create trigger trg_sleep_sessions_updated_at
before update on public.sleep_sessions
for each row execute function public.set_updated_at();

-- Sleep stages (for stacked bars)
create table if not exists public.sleep_stages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sleep_id uuid not null references public.sleep_sessions(id) on delete cascade,

  -- awake, light, deep, rem
  stage text not null,
  minutes int not null default 0,

  created_at timestamptz not null default now(),

  constraint chk_sleep_stage_valid check (stage in ('awake','light','deep','rem')),
  constraint chk_sleep_stage_minutes check (minutes >= 0)
);

create index if not exists idx_sleep_stages_sleep on public.sleep_stages(sleep_id);
create index if not exists idx_sleep_stages_user on public.sleep_stages(user_id);

-- Heart rate during sleep (for area chart)
create table if not exists public.sleep_hr_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sleep_id uuid not null references public.sleep_sessions(id) on delete cascade,

  -- seconds from sleep_start
  t_offset_sec int not null,
  hr int not null,

  created_at timestamptz not null default now(),

  constraint chk_sleep_hr_offset check (t_offset_sec >= 0),
  constraint chk_sleep_hr_value check (hr > 0 and hr < 250)
);

create index if not exists idx_sleep_hr_series_sleep on public.sleep_hr_series(sleep_id, t_offset_sec);

-- ------------------------------------------------------------
-- Activity / Workouts
-- ------------------------------------------------------------

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  polar_id text unique,

  start_time timestamptz not null,
  end_time timestamptz,
  workout_date date not null,

  sport text,
  duration_min int,
  calories int,
  distance_m int,

  avg_hr int,
  max_hr int,

  -- Training load style fields shown in screenshots
  tlp_cardio double precision,
  tlp_muscle double precision,
  tlp_perceived double precision,

  route_available boolean not null default false,

  raw jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_workout_duration check (duration_min is null or duration_min >= 0),
  constraint chk_workout_calories check (calories is null or calories >= 0)
);

create index if not exists idx_workouts_user_date on public.workouts(user_id, workout_date desc);
create index if not exists idx_workouts_user_start on public.workouts(user_id, start_time desc);

drop trigger if exists trg_workouts_updated_at on public.workouts;
create trigger trg_workouts_updated_at
before update on public.workouts
for each row execute function public.set_updated_at();

-- Heart rate over time
create table if not exists public.workout_hr_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,

  t_offset_sec int not null,
  hr int not null,

  created_at timestamptz not null default now(),

  constraint chk_workout_hr_offset check (t_offset_sec >= 0),
  constraint chk_workout_hr_value check (hr > 0 and hr < 250)
);

create index if not exists idx_workout_hr_series_workout on public.workout_hr_series(workout_id, t_offset_sec);

-- Heart rate zones
create table if not exists public.workout_hr_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,

  zone int not null,
  seconds int not null default 0,

  -- Optional zone bounds for display (<=109 bpm etc)
  min_bpm int,
  max_bpm int,

  created_at timestamptz not null default now(),

  constraint chk_hr_zone check (zone between 1 and 5),
  constraint chk_hr_zone_seconds check (seconds >= 0)
);

create index if not exists idx_workout_hr_zones_workout on public.workout_hr_zones(workout_id, zone);

-- ------------------------------------------------------------
-- Intra-day metrics (Body Recharge, Stress Level)
-- ------------------------------------------------------------

create table if not exists public.intra_day_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,

  -- e.g. 'body_recharge', 'stress_level'
  metric text not null,

  -- minutes since midnight for bucketing
  t_min int not null,

  value double precision not null,

  -- optional label for stress category: relaxed, low, medium, high
  label text,

  created_at timestamptz not null default now(),

  constraint chk_intraday_tmin check (t_min between 0 and 1440)
);

create index if not exists idx_intraday_user_date_metric on public.intra_day_metrics(user_id, date, metric, t_min);

-- ------------------------------------------------------------
-- Journal
-- ------------------------------------------------------------

create table if not exists public.journal_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  factors jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

drop trigger if exists trg_journal_entries_updated_at on public.journal_entries;
create trigger trg_journal_entries_updated_at
before update on public.journal_entries
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Baselines (28-day rolling)
-- ------------------------------------------------------------

create table if not exists public.baselines_28d (
  user_id uuid not null references auth.users(id) on delete cascade,
  metric text not null, -- 'hrv_ms', 'resting_hr', 'sleep_score', etc.
  computed_on date not null,
  avg double precision,
  stddev double precision,
  n int,
  primary key (user_id, metric, computed_on)
);

create index if not exists idx_baselines_28d_user_metric on public.baselines_28d(user_id, metric, computed_on desc);

-- ------------------------------------------------------------
-- Suggestions (dashboard card)
-- ------------------------------------------------------------

create table if not exists public.daily_suggestions (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  suggestion_key text not null,
  title text,
  body text,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

drop trigger if exists trg_daily_suggestions_updated_at on public.daily_suggestions;
create trigger trg_daily_suggestions_updated_at
before update on public.daily_suggestions
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Monthly recaps
-- ------------------------------------------------------------

create table if not exists public.monthly_recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year int not null,
  month int not null,

  total_workouts int,
  total_steps int,
  total_distance_m int,
  total_calories int,

  payload jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_month_valid check (month between 1 and 12),
  unique (user_id, year, month)
);

drop trigger if exists trg_monthly_recaps_updated_at on public.monthly_recaps;
create trigger trg_monthly_recaps_updated_at
before update on public.monthly_recaps
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Remote Config replacement (feature flags, weights, thresholds)
-- ------------------------------------------------------------

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Leaderboards (groups + seasons + daily scores)
-- ------------------------------------------------------------

create table if not exists public.leaderboard_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  join_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_leaderboard_groups_updated_at on public.leaderboard_groups;
create trigger trg_leaderboard_groups_updated_at
before update on public.leaderboard_groups
for each row execute function public.set_updated_at();

create table if not exists public.leaderboard_members (
  group_id uuid not null references public.leaderboard_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member', -- member, admin
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  constraint chk_leaderboard_role check (role in ('member','admin'))
);

create table if not exists public.leaderboard_seasons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.leaderboard_groups(id) on delete cascade,
  name text not null,
  metric text not null,        -- e.g. 'steps', 'sleep_score', 'strain_score'
  aggregation text not null,   -- sum, avg, max
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_aggregation check (aggregation in ('sum','avg','max')),
  constraint chk_dates check (end_date >= start_date)
);

drop trigger if exists trg_leaderboard_seasons_updated_at on public.leaderboard_seasons;
create trigger trg_leaderboard_seasons_updated_at
before update on public.leaderboard_seasons
for each row execute function public.set_updated_at();

create table if not exists public.leaderboard_daily_scores (
  season_id uuid not null references public.leaderboard_seasons(id) on delete cascade,
  group_id uuid not null references public.leaderboard_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  value double precision not null,
  created_at timestamptz not null default now(),
  primary key (season_id, user_id, date)
);

create index if not exists idx_leaderboard_daily_scores_group on public.leaderboard_daily_scores(group_id, season_id, date);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

-- Profiles
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles for select
using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- Connection tokens: deny all to client by default (no policies)
alter table public.polar_connections enable row level security;

-- Daily metrics
alter table public.daily_metrics enable row level security;

drop policy if exists daily_metrics_select_own on public.daily_metrics;
create policy daily_metrics_select_own
on public.daily_metrics for select
using (user_id = auth.uid());

drop policy if exists daily_metrics_update_own on public.daily_metrics;
create policy daily_metrics_update_own
on public.daily_metrics for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Sleep
alter table public.sleep_sessions enable row level security;
alter table public.sleep_stages enable row level security;
alter table public.sleep_hr_series enable row level security;

drop policy if exists sleep_sessions_select_own on public.sleep_sessions;
create policy sleep_sessions_select_own
on public.sleep_sessions for select
using (user_id = auth.uid());

drop policy if exists sleep_sessions_update_own on public.sleep_sessions;
create policy sleep_sessions_update_own
on public.sleep_sessions for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists sleep_stages_select_own on public.sleep_stages;
create policy sleep_stages_select_own
on public.sleep_stages for select
using (user_id = auth.uid());

drop policy if exists sleep_hr_series_select_own on public.sleep_hr_series;
create policy sleep_hr_series_select_own
on public.sleep_hr_series for select
using (user_id = auth.uid());

-- Activity
alter table public.workouts enable row level security;
alter table public.workout_hr_series enable row level security;
alter table public.workout_hr_zones enable row level security;

drop policy if exists workouts_select_own on public.workouts;
create policy workouts_select_own
on public.workouts for select
using (user_id = auth.uid());

drop policy if exists workouts_update_own on public.workouts;
create policy workouts_update_own
on public.workouts for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists workout_hr_series_select_own on public.workout_hr_series;
create policy workout_hr_series_select_own
on public.workout_hr_series for select
using (user_id = auth.uid());

drop policy if exists workout_hr_zones_select_own on public.workout_hr_zones;
create policy workout_hr_zones_select_own
on public.workout_hr_zones for select
using (user_id = auth.uid());

-- Intra-day
alter table public.intra_day_metrics enable row level security;

drop policy if exists intra_day_select_own on public.intra_day_metrics;
create policy intra_day_select_own
on public.intra_day_metrics for select
using (user_id = auth.uid());

-- Journal
alter table public.journal_entries enable row level security;

drop policy if exists journal_select_own on public.journal_entries;
create policy journal_select_own
on public.journal_entries for select
using (user_id = auth.uid());

drop policy if exists journal_upsert_own on public.journal_entries;
create policy journal_upsert_own
on public.journal_entries for insert
with check (user_id = auth.uid());

drop policy if exists journal_update_own on public.journal_entries;
create policy journal_update_own
on public.journal_entries for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Baselines
alter table public.baselines_28d enable row level security;

drop policy if exists baselines_select_own on public.baselines_28d;
create policy baselines_select_own
on public.baselines_28d for select
using (user_id = auth.uid());

-- Suggestions
alter table public.daily_suggestions enable row level security;

drop policy if exists suggestions_select_own on public.daily_suggestions;
create policy suggestions_select_own
on public.daily_suggestions for select
using (user_id = auth.uid());

drop policy if exists suggestions_update_own on public.daily_suggestions;
create policy suggestions_update_own
on public.daily_suggestions for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Monthly recaps
alter table public.monthly_recaps enable row level security;

drop policy if exists monthly_recaps_select_own on public.monthly_recaps;
create policy monthly_recaps_select_own
on public.monthly_recaps for select
using (user_id = auth.uid());

-- app_config: read-only to authenticated users (optional)
alter table public.app_config enable row level security;

drop policy if exists app_config_read_auth on public.app_config;
create policy app_config_read_auth
on public.app_config for select
to authenticated
using (true);

-- Leaderboards: members-only visibility
alter table public.leaderboard_groups enable row level security;
alter table public.leaderboard_members enable row level security;
alter table public.leaderboard_seasons enable row level security;
alter table public.leaderboard_daily_scores enable row level security;

-- Groups: readable if member
drop policy if exists lb_groups_select_member on public.leaderboard_groups;
create policy lb_groups_select_member
on public.leaderboard_groups for select
using (
  exists (
    select 1 from public.leaderboard_members m
    where m.group_id = leaderboard_groups.id
      and m.user_id = auth.uid()
  )
);

-- Groups: owner can insert/update
drop policy if exists lb_groups_insert_owner on public.leaderboard_groups;
create policy lb_groups_insert_owner
on public.leaderboard_groups for insert
with check (owner_id = auth.uid());

drop policy if exists lb_groups_update_owner on public.leaderboard_groups;
create policy lb_groups_update_owner
on public.leaderboard_groups for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Members: user can see membership rows for groups they are in
drop policy if exists lb_members_select_member on public.leaderboard_members;
create policy lb_members_select_member
on public.leaderboard_members for select
using (
  exists (
    select 1 from public.leaderboard_members m2
    where m2.group_id = leaderboard_members.group_id
      and m2.user_id = auth.uid()
  )
);

-- Members: user can join themselves (you will still validate join_code in an Edge Function)
drop policy if exists lb_members_insert_self on public.leaderboard_members;
create policy lb_members_insert_self
on public.leaderboard_members for insert
with check (user_id = auth.uid());

-- Seasons: readable if member of group
drop policy if exists lb_seasons_select_member on public.leaderboard_seasons;
create policy lb_seasons_select_member
on public.leaderboard_seasons for select
using (
  exists (
    select 1 from public.leaderboard_members m
    where m.group_id = leaderboard_seasons.group_id
      and m.user_id = auth.uid()
  )
);

-- Seasons: only group owner can create/update
drop policy if exists lb_seasons_insert_owner on public.leaderboard_seasons;
create policy lb_seasons_insert_owner
on public.leaderboard_seasons for insert
with check (
  exists (
    select 1 from public.leaderboard_groups g
    where g.id = leaderboard_seasons.group_id
      and g.owner_id = auth.uid()
  )
);

drop policy if exists lb_seasons_update_owner on public.leaderboard_seasons;
create policy lb_seasons_update_owner
on public.leaderboard_seasons for update
using (
  exists (
    select 1 from public.leaderboard_groups g
    where g.id = leaderboard_seasons.group_id
      and g.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.leaderboard_groups g
    where g.id = leaderboard_seasons.group_id
      and g.owner_id = auth.uid()
  )
);

-- Daily scores: readable if member of group
drop policy if exists lb_scores_select_member on public.leaderboard_daily_scores;
create policy lb_scores_select_member
on public.leaderboard_daily_scores for select
using (
  exists (
    select 1 from public.leaderboard_members m
    where m.group_id = leaderboard_daily_scores.group_id
      and m.user_id = auth.uid()
  )
);

-- Daily scores: no insert/update policy for clients (computed server-side)
-- leave without policies for insert/update/delete

-- ------------------------------------------------------------
-- Notes
-- ------------------------------------------------------------
-- 1) polar_connections has RLS enabled but no policies, so it is client-inaccessible.
--    Edge Functions using the service role key can still read/write.
-- 2) For computed tables like leaderboard_daily_scores, keep them server-written only.
-- 3) You can extend daily_metrics as you confirm additional Polar fields.