-- Polar Fitness Tracker - Supabase Schema
-- Run this in Supabase SQL Editor

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- SUBSCRIPTION TIERS
-- ============================================
create type subscription_tier as enum ('free', 'premium');

-- ============================================
-- USER PROFILES (extends auth.users)
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,

  -- Subscription
  subscription_tier subscription_tier default 'free',
  subscription_expires_at timestamptz,

  -- Polar connection
  polar_user_id text unique,
  polar_connected_at timestamptz,

  -- Preferences
  sleep_goal_hours numeric(3,1) default 8.0,
  use_metric boolean default true,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================
-- OAUTH TOKENS (encrypted)
-- ============================================
create table public.oauth_tokens (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  provider text not null default 'polar',
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider)
);

-- ============================================
-- WORKOUTS
-- ============================================
create table public.workouts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  polar_exercise_id text,

  workout_date date not null,
  workout_type text not null,
  duration_minutes integer not null,
  calories integer,

  avg_hr integer,
  max_hr integer,
  strain_score numeric(4,2),

  -- HR zones (minutes in each)
  zone1_minutes integer default 0,
  zone2_minutes integer default 0,
  zone3_minutes integer default 0,
  zone4_minutes integer default 0,
  zone5_minutes integer default 0,

  raw_data jsonb,
  created_at timestamptz default now(),

  unique(user_id, polar_exercise_id)
);

-- ============================================
-- SLEEP SESSIONS
-- ============================================
create table public.sleep_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  polar_sleep_id text,

  sleep_date date not null,
  bedtime timestamptz not null,
  wake_time timestamptz not null,
  duration_minutes integer not null,

  -- Sleep stages (minutes)
  deep_minutes integer,
  light_minutes integer,
  rem_minutes integer,
  awake_minutes integer,

  sleep_score numeric(5,2),

  raw_data jsonb,
  created_at timestamptz default now(),

  unique(user_id, polar_sleep_id)
);

-- ============================================
-- DAILY METRICS (computed daily rollup)
-- ============================================
create table public.daily_metrics (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  metric_date date not null,

  -- Scores
  recovery_score numeric(5,2),
  strain_score numeric(4,2),
  sleep_score numeric(5,2),

  -- Raw metrics
  hrv numeric(6,2),
  resting_hr integer,

  -- Workout summary
  total_workout_minutes integer default 0,
  total_calories integer default 0,
  workout_count integer default 0,

  -- Sleep summary
  sleep_duration_minutes integer,
  bedtime_consistency numeric(5,2),

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id, metric_date)
);

-- ============================================
-- BASELINES (30-day rolling averages)
-- ============================================
create table public.baselines (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles on delete cascade not null,

  avg_hrv numeric(6,2),
  avg_resting_hr numeric(5,2),
  avg_sleep_duration numeric(5,2),
  avg_strain numeric(4,2),
  avg_recovery numeric(5,2),

  typical_bedtime time,
  typical_wake_time time,

  updated_at timestamptz default now(),

  unique(user_id)
);

-- ============================================
-- INSIGHTS (auto-generated recommendations)
-- ============================================
create table public.insights (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles on delete cascade not null,

  insight_date date not null,
  insight_type text not null, -- 'recovery', 'strain', 'sleep', 'trend'
  title text not null,
  message text not null,
  priority integer default 0,

  -- Premium only insights
  is_premium boolean default false,

  created_at timestamptz default now()
);

-- ============================================
-- SYNC LOG
-- ============================================
create table public.sync_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles on delete cascade not null,

  sync_type text not null,
  status text not null,
  records_synced integer default 0,
  error_message text,

  started_at timestamptz default now(),
  completed_at timestamptz
);

-- ============================================
-- INDEXES
-- ============================================
create index idx_workouts_user_date on public.workouts(user_id, workout_date desc);
create index idx_sleep_user_date on public.sleep_sessions(user_id, sleep_date desc);
create index idx_metrics_user_date on public.daily_metrics(user_id, metric_date desc);
create index idx_insights_user_date on public.insights(user_id, insight_date desc);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.oauth_tokens enable row level security;
alter table public.workouts enable row level security;
alter table public.sleep_sessions enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.baselines enable row level security;
alter table public.insights enable row level security;
alter table public.sync_log enable row level security;

-- Profiles: users can only see/edit their own
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- OAuth tokens: users can only access their own
create policy "Users can view own tokens"
  on public.oauth_tokens for select
  using (auth.uid() = user_id);

create policy "Users can insert own tokens"
  on public.oauth_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tokens"
  on public.oauth_tokens for update
  using (auth.uid() = user_id);

create policy "Users can delete own tokens"
  on public.oauth_tokens for delete
  using (auth.uid() = user_id);

-- Workouts: users can only access their own
create policy "Users can view own workouts"
  on public.workouts for select
  using (auth.uid() = user_id);

create policy "Users can insert own workouts"
  on public.workouts for insert
  with check (auth.uid() = user_id);

-- Sleep: users can only access their own
create policy "Users can view own sleep"
  on public.sleep_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sleep"
  on public.sleep_sessions for insert
  with check (auth.uid() = user_id);

-- Daily metrics: users can only access their own
create policy "Users can view own metrics"
  on public.daily_metrics for select
  using (auth.uid() = user_id);

create policy "Users can manage own metrics"
  on public.daily_metrics for all
  using (auth.uid() = user_id);

-- Baselines: users can only access their own
create policy "Users can view own baselines"
  on public.baselines for select
  using (auth.uid() = user_id);

create policy "Users can manage own baselines"
  on public.baselines for all
  using (auth.uid() = user_id);

-- Insights: users see own, but premium filtering happens in app
create policy "Users can view own insights"
  on public.insights for select
  using (auth.uid() = user_id);

-- Sync log: users can view their own
create policy "Users can view own sync log"
  on public.sync_log for select
  using (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();

create trigger update_metrics_updated_at
  before update on public.daily_metrics
  for each row execute procedure public.update_updated_at();

-- ============================================
-- FEATURE FLAGS BY TIER
-- ============================================
-- Free tier:
--   - Last 7 days of data
--   - Basic scores (Recovery, Strain, Sleep)
--   - Today's insights only
--
-- Premium tier:
--   - Full history (90+ days)
--   - Trend charts (7/30/90 day)
--   - All insights including premium
--   - Export data
--   - Baseline comparisons
-- ============================================
