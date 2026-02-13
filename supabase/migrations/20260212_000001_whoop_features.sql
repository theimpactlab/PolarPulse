-- PolarPulse → Whoop-competitor feature migration
-- Paste directly into Supabase SQL editor
-- Safe to run: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS throughout

-- ============================================================
-- 1. Extend profiles with physiological settings
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_hr int;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight_kg double precision;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height_cm double precision;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text;

-- ============================================================
-- 2. Extend daily_metrics for Whoop-style coaching
-- ============================================================

-- Sleep Coach fields
ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS sleep_needed_min int;
ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS sleep_debt_min int;
ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS sleep_performance_pct int;

-- Strain Coach fields (target range based on recovery)
ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS strain_target_low double precision;
ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS strain_target_high double precision;

-- Whoop-style 0-21 strain (logarithmic)
ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS strain_21 double precision;

-- Health monitor extras
ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS skin_temp_c double precision;
ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS health_indicator int;

-- Update strain constraint to allow 0-21 scale in strain_21
-- (original strain_score 0-200 kept for backwards compat)

-- ============================================================
-- 3. Nightly Recharge data from Polar API
-- ============================================================

CREATE TABLE IF NOT EXISTS public.nightly_recharge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  polar_id text UNIQUE,
  date date NOT NULL,

  -- ANS charge (Autonomic Nervous System) -10 to +10 typically
  ans_charge double precision,
  ans_charge_status text, -- 'MUCH_BELOW_USUAL', 'BELOW_USUAL', 'USUAL', 'ABOVE_USUAL', 'MUCH_ABOVE_USUAL'

  -- HRV (heart rate variability)
  hrv_avg double precision,
  hrv_max double precision,

  -- Heart rate during first hours of sleep
  hr_avg double precision,
  hr_min double precision,

  -- Breathing rate
  breathing_rate_avg double precision,

  -- Beat-to-beat intervals (summarised)
  beat_to_beat_avg double precision,

  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_nightly_recharge_user_date
  ON public.nightly_recharge(user_id, date DESC);

DROP TRIGGER IF EXISTS trg_nightly_recharge_updated_at ON public.nightly_recharge;
CREATE TRIGGER trg_nightly_recharge_updated_at
BEFORE UPDATE ON public.nightly_recharge
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.nightly_recharge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nightly_recharge_select_own ON public.nightly_recharge;
CREATE POLICY nightly_recharge_select_own
ON public.nightly_recharge FOR SELECT
USING (user_id = auth.uid());

-- ============================================================
-- 4. Weekly Assessments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.weekly_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ISO week start (Monday)
  week_start date NOT NULL,
  week_end date NOT NULL,

  -- Aggregated scores (averages for the week)
  avg_recovery int,
  avg_strain double precision,
  avg_sleep_score int,
  avg_sleep_performance int,
  avg_hrv double precision,
  avg_resting_hr int,

  -- Counts
  total_workouts int DEFAULT 0,
  total_active_minutes int DEFAULT 0,
  total_calories int DEFAULT 0,

  -- Training state: 'overreaching', 'maintaining', 'peaking', 'detraining'
  training_state text,

  -- How user compares to their baseline
  recovery_vs_baseline double precision, -- percentage above/below
  strain_vs_baseline double precision,

  -- Payload for extended data
  payload jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_assessments_user_week
  ON public.weekly_assessments(user_id, week_start DESC);

DROP TRIGGER IF EXISTS trg_weekly_assessments_updated_at ON public.weekly_assessments;
CREATE TRIGGER trg_weekly_assessments_updated_at
BEFORE UPDATE ON public.weekly_assessments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.weekly_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_assessments_select_own ON public.weekly_assessments;
CREATE POLICY weekly_assessments_select_own
ON public.weekly_assessments FOR SELECT
USING (user_id = auth.uid());

-- ============================================================
-- 5. Extend journal_entries with structured behavior tracking
-- ============================================================

-- The existing journal_entries table uses `factors jsonb`
-- We add a dedicated behaviors table for Whoop-style tracking

CREATE TABLE IF NOT EXISTS public.journal_behaviors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,

  -- Behavior category and specific item
  category text NOT NULL, -- 'sleep_environment', 'nutrition', 'supplements', 'recovery', 'lifestyle', 'performance'
  behavior text NOT NULL, -- 'alcohol', 'caffeine_after_2pm', 'screen_before_bed', 'melatonin', 'cbd', 'stretching', 'sauna', 'cold_exposure', 'meditation', 'hydrated_well', 'ate_late', 'high_stress_day'
  value boolean NOT NULL DEFAULT true, -- did the behavior occur?

  -- Optional numeric value (e.g., number of drinks, hours of screen time)
  numeric_value double precision,

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id, date, behavior)
);

CREATE INDEX IF NOT EXISTS idx_journal_behaviors_user_date
  ON public.journal_behaviors(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_behaviors_behavior
  ON public.journal_behaviors(behavior, user_id);

ALTER TABLE public.journal_behaviors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journal_behaviors_select_own ON public.journal_behaviors;
CREATE POLICY journal_behaviors_select_own
ON public.journal_behaviors FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS journal_behaviors_insert_own ON public.journal_behaviors;
CREATE POLICY journal_behaviors_insert_own
ON public.journal_behaviors FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS journal_behaviors_update_own ON public.journal_behaviors;
CREATE POLICY journal_behaviors_update_own
ON public.journal_behaviors FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS journal_behaviors_delete_own ON public.journal_behaviors;
CREATE POLICY journal_behaviors_delete_own
ON public.journal_behaviors FOR DELETE
USING (user_id = auth.uid());

-- ============================================================
-- 6. Behavior impact analysis view (for journal insights)
-- ============================================================

-- This view computes the average recovery when a behavior occurred vs. didn't
CREATE OR REPLACE VIEW public.behavior_recovery_impact AS
SELECT
  jb.user_id,
  jb.behavior,
  jb.category,
  COUNT(*) FILTER (WHERE jb.value = true) AS days_with,
  COUNT(*) FILTER (WHERE jb.value = false) AS days_without,
  ROUND(AVG(dm.recovery_score) FILTER (WHERE jb.value = true)::numeric, 1) AS avg_recovery_with,
  ROUND(AVG(dm.recovery_score) FILTER (WHERE jb.value = false)::numeric, 1) AS avg_recovery_without,
  ROUND(
    (AVG(dm.recovery_score) FILTER (WHERE jb.value = true) -
     AVG(dm.recovery_score) FILTER (WHERE jb.value = false))::numeric,
    1
  ) AS recovery_delta
FROM public.journal_behaviors jb
JOIN public.daily_metrics dm
  ON dm.user_id = jb.user_id AND dm.date = jb.date
WHERE dm.recovery_score IS NOT NULL
GROUP BY jb.user_id, jb.behavior, jb.category
HAVING COUNT(*) FILTER (WHERE jb.value = true) >= 3
   AND COUNT(*) FILTER (WHERE jb.value = false) >= 3;

-- ============================================================
-- 7. Extend sleep_sessions with additional coaching fields
-- ============================================================

ALTER TABLE public.sleep_sessions ADD COLUMN IF NOT EXISTS sleep_needed_min int;
ALTER TABLE public.sleep_sessions ADD COLUMN IF NOT EXISTS sleep_debt_min int;
ALTER TABLE public.sleep_sessions ADD COLUMN IF NOT EXISTS sleep_performance_pct int;
ALTER TABLE public.sleep_sessions ADD COLUMN IF NOT EXISTS latency_min int;
ALTER TABLE public.sleep_sessions ADD COLUMN IF NOT EXISTS wake_after_onset_min int;

-- ============================================================
-- 8. Goals / Targets table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_goals (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric text NOT NULL, -- 'daily_strain', 'sleep_hours', 'steps', 'calories', 'workouts_per_week'
  target_value double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, metric)
);

DROP TRIGGER IF EXISTS trg_user_goals_updated_at ON public.user_goals;
CREATE TRIGGER trg_user_goals_updated_at
BEFORE UPDATE ON public.user_goals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_goals_select_own ON public.user_goals;
CREATE POLICY user_goals_select_own
ON public.user_goals FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_goals_insert_own ON public.user_goals;
CREATE POLICY user_goals_insert_own
ON public.user_goals FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_goals_update_own ON public.user_goals;
CREATE POLICY user_goals_update_own
ON public.user_goals FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_goals_delete_own ON public.user_goals;
CREATE POLICY user_goals_delete_own
ON public.user_goals FOR DELETE
USING (user_id = auth.uid());

-- ============================================================
-- 9. Continuous heart rate data from Polar
-- ============================================================

CREATE TABLE IF NOT EXISTS public.continuous_hr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  t_min int NOT NULL, -- minutes since midnight
  hr int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_chr_tmin CHECK (t_min BETWEEN 0 AND 1440),
  CONSTRAINT chk_chr_hr CHECK (hr > 0 AND hr < 250)
);

CREATE INDEX IF NOT EXISTS idx_continuous_hr_user_date
  ON public.continuous_hr(user_id, date DESC, t_min);

ALTER TABLE public.continuous_hr ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS continuous_hr_select_own ON public.continuous_hr;
CREATE POLICY continuous_hr_select_own
ON public.continuous_hr FOR SELECT
USING (user_id = auth.uid());

-- ============================================================
-- Done. Now deploy frontend changes + edge function updates.
-- ============================================================
