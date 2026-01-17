import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { polarOAuthService } from '@/lib/services/polar-oauth';

export interface Workout {
  id: string;
  polarId?: string;
  date: string;
  type: string;
  durationMinutes: number;
  calories?: number;
  avgHR?: number;
  maxHR?: number;
  strainScore?: number;
  hrZones?: Array<{ zone: number; minutes: number }>;
  source: 'polar' | 'apple_health' | 'manual' | 'demo';
}

export interface SleepSession {
  id: string;
  polarId?:  string;
  date: string;
  sleepStart?:  string;
  sleepEnd?:  string;
  totalSleepMinutes: number;
  timeInBedMinutes: number;
  stages: {
    awake: number;
    light:  number;
    deep: number;
    rem: number;
  };
  sleep_score?: number;  // ✅ ADD THIS
  source: 'polar' | 'apple_health' | 'manual' | 'demo';
}

export interface DailyMetrics {
  date: string;
  recoveryScore?:  number;
  strainScore?: number;
  sleepScore?: number;
  bodyBattery?: number;
  bodyTemperature?: number;
  trainingLoad?: number;
  hrv?: number;
  rhr?: number;
  vo2Max?: number;  // ✅ ADD THIS
  trainingLoadStatus?: string;  // ✅ ADD THIS
}

export interface BodyBatteryReading {
  timestamp: string;
  value: number;
}

// ✅ ADD these interfaces to app-store.ts if missing
export interface TrainingLoadHistory {
  date:  string;
  acuteLoad: number;
  chronicLoad: number;
  status: string;
}

export interface Insight {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface Baselines {
  recoveryScore: number;
  strainScore: number;
  sleepScore: number;
}

export interface UserSettings {
  sleepGoalHours: number;
  units: 'Metric' | 'Imperial';
  notificationsEnabled: boolean;
}

interface AppState {
  // Connection state
  isPolarConnected: boolean;
  isAppleHealthConnected: boolean;
  isAppleHealthAvailable: boolean;
  isDemoMode: boolean;
  polarAccessToken?: string;
  polarRefreshToken?: string;
  polarUserId?: string;
  lastSyncDate?: string;
  lastAppleHealthSyncDate?: string;

  // Data
  workouts: Workout[];
  sleepSessions: SleepSession[];
  dailyMetrics: DailyMetrics[];
  baselines?: Baselines;
  insights: Insight[];

  // Advanced data
  bodyBatteryHistory: BodyBatteryReading[];
  trainingLoadHistory: TrainingLoadHistory[];

  // User preferences
  userSettings: UserSettings;

  // Polar Actions
  connectPolar: () => Promise<{ success: boolean; error?: string }>;
  disconnectPolar: () => Promise<void>;
  syncData: () => Promise<{ success: boolean; synced?: number; error?: string }>;

  // Apple Health Actions
  checkAppleHealthAvailability: () => void;
  connectAppleHealth: () => Promise<{ success: boolean; error?: string }>;
  disconnectAppleHealth: () => void;
  syncAppleHealth: () => Promise<{ success: boolean; synced: number; error?: string }>;

  // Data actions
  loadDemoData: () => void;
  exportData: () => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => void;
  addWorkout: (workout: Workout) => void;
  addSleepSession: (session: SleepSession) => void;
  updateDailyMetric: (metric: DailyMetrics) => void;
}

const defaultSettings: UserSettings = {
  sleepGoalHours: 8,
  units: 'Metric',
  notificationsEnabled: true,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      isPolarConnected: false,
      isAppleHealthConnected: false,
      isAppleHealthAvailable: false,
      isDemoMode: false,

      workouts: [],
      sleepSessions: [],
      dailyMetrics: [],
      insights: [],
      bodyBatteryHistory: [],
      trainingLoadHistory: [],
      userSettings: defaultSettings,

      // Polar connection actions
      connectPolar: async () => {
        const result = await polarOAuthService.startOAuthFlow();
        if (result.success) {
          set({ isPolarConnected: true, isDemoMode: false });
        }
        return result;
      },

      disconnectPolar: async () => {
        await polarOAuthService.disconnectPolar();
        set({
          isPolarConnected: false,
          isDemoMode: false,
          polarAccessToken: undefined,
          polarRefreshToken: undefined,
          polarUserId: undefined,
        });
      },

      // ✅ FIXED: Calculate training load and strain from workouts
      syncData:  async () => {
        const result = await polarOAuthService.syncPolarData();
        if (! result.success) return result;

        const pulled = await polarOAuthService.pullLatestFromSupabase();
        if (!pulled.success) {
          return {
            success: false,
            error: pulled.error || 'Synced but could not load data into app.',
          };
        }

        // Map workouts
        const mappedWorkouts:  Workout[] = (pulled.workouts || []).map((w:  any) => ({
          id: `polar_${w.polar_exercise_id}`,
          polarId: w.polar_exercise_id,
          date: w.workout_date,
          type: w.workout_type || 'workout',
          durationMinutes: w.duration_minutes || 0,
          calories: w.calories || 0,
          avgHR: w.avg_hr || 0,
          maxHR: w.max_hr || 0,
          strainScore: w.strain_score ??  undefined,
          source: 'polar',
        }));

        // Map sleep sessions
        const mappedSleeps: SleepSession[] = (pulled. sleepSessions || []).map((s: any) => ({
          id: `polar_sleep_${s.polar_sleep_id}`,
          polarId: s.polar_sleep_id,
          date: s.sleep_date,
          sleepStart: s.bedtime ??  undefined,
          sleepEnd: s.wake_time ?? undefined,
          totalSleepMinutes: s.duration_minutes || 0,
          timeInBedMinutes: s.duration_minutes || 0,
          stages: {
            awake: s.awake_minutes || 0,
            light: s.light_minutes || 0,
            deep: s. deep_minutes || 0,
            rem: s.rem_minutes || 0,
          },
          sleep_score: s.sleep_score ??  undefined,
          source: 'polar',
        }));

        // ✅ NEW: Calculate strain score from workouts per day
        const strainByDate:  { [date: string]: number } = {};
        mappedWorkouts.forEach((w) => {
          if (! strainByDate[w.date]) strainByDate[w.date] = 0;
          strainByDate[w.date] += w.strainScore || 0;
        });

        // ✅ NEW: Calculate training load history (7-day and 28-day rolling)
        const trainingLoadHistory:  TrainingLoadHistory[] = [];
        const today = new Date();
        for (let i = 0; i < 90; i++) {
          const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split('T')[0];

          // 7-day acute load
          const last7 = mappedWorkouts.filter((w) => {
            const workoutDate = new Date(w. date);
            const daysDiff = Math.floor((date. getTime() - workoutDate.getTime()) / (24 * 60 * 60 * 1000));
            return daysDiff >= 0 && daysDiff < 7;
          });
          const acuteLoad = last7.reduce((sum, w) => sum + (w.strainScore || 0), 0);

          // 28-day chronic load
          const last28 = mappedWorkouts. filter((w) => {
            const workoutDate = new Date(w.date);
            const daysDiff = Math.floor((date.getTime() - workoutDate.getTime()) / (24 * 60 * 60 * 1000));
            return daysDiff >= 0 && daysDiff < 28;
          });
          const chronicLoad = last28.reduce((sum, w) => sum + (w.strainScore || 0), 0);

          // Determine status based on acute/chronic ratio
          const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : 1;
          let status = 'maintaining';
          if (ratio > 1.3) status = 'overreaching';
          else if (ratio > 1.1) status = 'increasing';
          else if (ratio < 0.8) status = 'decreasing';

          trainingLoadHistory.push({
            date:  dateStr,
            acuteLoad:  Math.round(acuteLoad),
            chronicLoad: Math.round(chronicLoad),
            status,
          });
        }

        // Map daily metrics
        const mappedDailyMetrics: DailyMetrics[] = (pulled.dailyMetrics || []).map((m: any) => {
          const sleepForDate = (pulled.sleepSessions || []).find(
            (s:  any) => s.sleep_date === m.metric_date
          );

          return {
            date: m.metric_date,
            recoveryScore: m.recovery_score ?? undefined,
            strainScore: strainByDate[m.metric_date] ?? undefined,  // ✅ FROM workouts
            sleepScore: sleepForDate?. sleep_score ?  Math.round(sleepForDate. sleep_score) : undefined,
            bodyBattery: m. body_battery ?? undefined,
            bodyTemperature: m.body_temperature_celsius ?? undefined,
            trainingLoad: m.training_load ?? undefined,
            hrv: m. hrv ?? undefined,
            rhr: m.resting_hr ?? undefined,
            vo2Max: undefined,  // Not available from Polar nightly recharge
            trainingLoadStatus: trainingLoadHistory.find((t) => t.date === m.metric_date)?.status,
          };
        });

        set({
          workouts: mappedWorkouts,
          sleepSessions: mappedSleeps,
          dailyMetrics: mappedDailyMetrics,
          trainingLoadHistory,  // ✅ ADD THIS
          lastSyncDate: new Date().toISOString(),
          isDemoMode: false,
        });

        return { success: true, synced: result.synced ??  0 };
      },

      // Apple Health actions
      checkAppleHealthAvailability: () => {
        set({ isAppleHealthAvailable: false });
      },

      connectAppleHealth: async () => {
        return { success: false, error: 'Apple Health is only available on iOS' };
      },

      disconnectAppleHealth: () => {
        set({
          isAppleHealthConnected: false,
          lastAppleHealthSyncDate: undefined,
        });
      },

      syncAppleHealth: async () => {
        return { success: false, synced: 0, error: 'Apple Health sync not configured' };
      },

      loadDemoData: () => {
        const demoWorkouts: Workout[] = [
          {
            id: 'demo_1',
            date: new Date().toISOString().split('T')[0],
            type: 'running',
            durationMinutes: 45,
            calories: 450,
            avgHR: 145,
            maxHR: 180,
            strainScore: 85,
            source: 'demo',
          },
        ];

        const demoSleep: SleepSession[] = [
          {
            id: 'demo_sleep_1',
            date: new Date().toISOString().split('T')[0],
            totalSleepMinutes: 480,
            timeInBedMinutes: 510,
            stages: { awake: 30, light: 180, deep: 180, rem: 90 },
            source: 'demo',
          },
        ];

        set({
          workouts: demoWorkouts,
          sleepSessions: demoSleep,
          isDemoMode: true,
        });
      },

      exportData: async () => {
        // Implementation for exporting data
      },

      updateSettings: (settings: Partial<UserSettings>) => {
        set((state) => ({
          userSettings: { ...state.userSettings, ...settings },
        }));
      },

      addWorkout: (workout: Workout) =>
        set((state) => ({
          workouts: [...state.workouts.filter((w) => w.id !== workout.id), workout],
        })),

      addSleepSession: (session: SleepSession) =>
        set((state) => ({
          sleepSessions: [
            ...state.sleepSessions.filter((s) => s.id !== session.id),
            session,
          ],
        })),

      updateDailyMetric: (metric: DailyMetrics) =>
        set((state) => ({
          dailyMetrics: [
            ...state.dailyMetrics.filter((m) => m.date !== metric.date),
            metric,
          ],
        })),
    }),
    {
      name: 'polar-fitness-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isPolarConnected: state.isPolarConnected,
        isAppleHealthConnected: state.isAppleHealthConnected,
        isDemoMode: state.isDemoMode,
        polarAccessToken: state.polarAccessToken,
        polarRefreshToken: state.polarRefreshToken,
        polarUserId: state.polarUserId,
        lastSyncDate: state.lastSyncDate,
        lastAppleHealthSyncDate: state.lastAppleHealthSyncDate,
        workouts: state.workouts,
        sleepSessions: state.sleepSessions,
        dailyMetrics: state.dailyMetrics,
        userSettings: state.userSettings,
      }),
    }
  )
);