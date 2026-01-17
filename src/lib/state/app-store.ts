import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { polarOAuthService } from '@/lib/services/polar-oauth';
import { calculateRecoveryScore } from '@/lib/utils/scoring';

export interface Workout {
  id: string;
  polarId?:  string;
  date: string;
  type: string;
  durationMinutes:  number;
  calories?:  number;
  avgHR?:  number;
  maxHR?:  number;
  strainScore?:  number;
  hrZones?: Array<{ zone: number; minutes: number }>;
  source:  'polar' | 'apple_health' | 'manual' | 'demo';
}

export interface SleepSession {
  id: string;
  polarId?: string;
  date: string;
  sleepStart?:  string;
  sleepEnd?:  string;
  totalSleepMinutes:  number;
  timeInBedMinutes: number;
  stages: {
    awake: number;
    light:  number;
    deep: number;
    rem: number;
  };
  source: 'polar' | 'apple_health' | 'manual' | 'demo';
}

export interface DailyMetrics {
  date: string;
  recoveryScore?  :   number;
  strainScore? :   number;
  sleepScore?:  number;
  bodyBattery?:  number;
  bodyTemperature?: number;  //
  trainingLoad?: number;
}

export interface BodyBatteryReading {
  timestamp: string;
  value: number;
}

export interface TrainingLoadHistory {
  date: string;
  value: number;
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
  polarAccessToken?:  string;
  polarRefreshToken?: string;
  polarUserId?: string;
  lastSyncDate?: string;
  lastAppleHealthSyncDate?: string;

  // Data
  workouts: Workout[];
  sleepSessions: SleepSession[];
  dailyMetrics: DailyMetrics[];
  baselines?:  Baselines;
  insights: Insight[];

  // Advanced data
  bodyBatteryHistory: BodyBatteryReading[];
  trainingLoadHistory:  TrainingLoadHistory[];

  // User preferences
  userSettings: UserSettings;

  // Polar Actions
  connectPolar: () => Promise<{ success: boolean; error?: string }>;
  disconnectPolar: () => Promise<void>;
  syncData: () => Promise<{ success: boolean; synced?:  number; error?: string }>;

  // Apple Health Actions
  checkAppleHealthAvailability: () => void;
  connectAppleHealth: () => Promise<{ success: boolean; error?: string }>;
  disconnectAppleHealth: () => void;
  syncAppleHealth:  () => Promise<{ success: boolean; synced:  number; error?: string }>;

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
  units: "Metric",
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
          polarRefreshToken:  undefined,
          polarUserId: undefined,
        });
      },

      // ✅ FIXED: sync, then pull data from Supabase into Zustand so UI updates
      syncData:  async () => {
        const result = await polarOAuthService.syncPolarData();
        if (!result.success) return result;

        const pulled = await polarOAuthService.pullLatestFromSupabase();
        if (!pulled.success) {
          return {
            success: false,
            error: pulled.error || "Synced but could not load data into app.",
          };
        }

        const mappedWorkouts:  Workout[] = (pulled.workouts || []).map((w: any) => ({
          id: `polar_${w.polar_exercise_id}`,
          polarId: w.polar_exercise_id,
          date: w.workout_date,
          type: w.workout_type || "workout",
          durationMinutes: w.duration_minutes || 0,
          calories: w.calories || 0,
          avgHR: w.avg_hr || 0,
          maxHR: w.max_hr || 0,
          strainScore: w.strain_score ??  undefined,
          source: "polar",
        }));

        // ✅ Map sleep sessions
        const mappedSleeps: SleepSession[] = (pulled. sleepSessions || []).map((s: any) => ({
          id: `polar_sleep_${s.polar_sleep_id}`,
          polarId: s.polar_sleep_id,
          date: s.sleep_date,
          sleepStart: s.bedtime ??  undefined,
          sleepEnd:  s.wake_time ?? undefined,
          totalSleepMinutes: s.duration_minutes || 0,
          timeInBedMinutes: s.duration_minutes || 0,
          stages: {
            awake: s.awake_minutes || 0,
            light: s.light_minutes || 0,
            deep: s. deep_minutes || 0,
            rem: s.rem_minutes || 0,
          },
          sleep_score: s.sleep_score ??  undefined,
          source: "polar",
        }));

        // ✅ FIXED: Calculate recovery score from HRV, RHR, and sleep
        const mappedDailyMetrics:  DailyMetrics[] = (pulled.dailyMetrics || []).map((m:  any) => {
          // Calculate recovery score
          const hrv = m.hrv ??  undefined;
          const rhr = m.resting_hr ?? undefined;
          const sleepScore = m.sleep_score ?? 0;
          
          // Get prior day strain (need to find from workouts)
          const currentDate = new Date(m.metric_date);
          const prevDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const prevWorkouts = pulled.workouts?. filter((w: any) => w.workout_date === prevDate) || [];
          const priorDayStrain = prevWorkouts.length > 0
            ? prevWorkouts.reduce((sum, w:  any) => sum + (w.strain_score || 0), 0)
            : 0;

          // Calculate recovery using the scoring function
          let recoveryScore = 0;
          if (hrv && rhr) {
            // Use baselines from Polar (or reasonable defaults)
            const hrvBaseline = 30; // Default HRV baseline in ms
            const rhrBaseline = 60; // Default RHR baseline in bpm
            
            const { score } = calculateRecoveryScore(hrv, hrvBaseline, rhr, rhrBaseline, sleepScore, priorDayStrain);
            recoveryScore = score;
          }

          return {
            date: m.metric_date,
            recoveryScore:   recoveryScore || undefined,
            strainScore:  m.strain_score ??  undefined,
            sleepScore: m.sleep_score ?? undefined,
            bodyBattery: m.body_battery ??  undefined,
            bodyTemperature: m.body_temperature_celsius ?? undefined,  // ✅ ADD THIS
            trainingLoad: m.training_load ?? undefined,
            hrv:   hrv,
            rhr:  rhr,
          };
        });

      // Apple Health actions
      checkAppleHealthAvailability: () => {
        set({ isAppleHealthAvailable:  isHealthAvailable() });
      },

      connectAppleHealth: async () => {
        if (!isHealthAvailable()) {
          return { success: false, error: "Apple Health is only available on iOS" };
        }
        try {
          const authorized = await appleHealthService.requestAuthorization();
          if (authorized) {
            set({ isAppleHealthConnected: true, isDemoMode: false });
            return { success: true };
          }
          return { success: false, error:  "Authorization denied" };
        } catch (error) {
          return { success:  false, error: error instanceof Error ? error.message : "Failed to connect" };
        }
      },

      disconnectAppleHealth: () => {
        set({
          isAppleHealthConnected: false,
          lastAppleHealthSyncDate: undefined,
        });
      },

      syncAppleHealth: async () => {
        const state = get();
        if (!state.isAppleHealthConnected) {
          return { success: false, synced: 0, error: "Not connected to Apple Health" };
        }

        try {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const workoutsData = await appleHealthService.getWorkouts(thirtyDaysAgo);
          const sleepData = await appleHealthService.getSleep(thirtyDaysAgo);

          const mappedWorkouts = workoutsData.map((w) => ({
            id: `ah_${w.id}`,
            date: w.date,
            type: w.type,
            durationMinutes: w. durationMinutes,
            calories:  w.calories,
            avgHR: w.avgHR,
            maxHR: w. maxHR,
            source: "apple_health" as const,
          }));

          const mappedSleep = sleepData.map((s) => ({
            id: `ah_sleep_${s.id}`,
            date: s.date,
            sleepStart:  s.sleepStart,
            sleepEnd: s.sleepEnd,
            totalSleepMinutes: s.totalSleepMinutes,
            timeInBedMinutes: s.timeInBedMinutes,
            stages: s.stages,
            source: "apple_health" as const,
          }));

          set((state) => ({
            workouts:  [... state.workouts. filter((w) => w.source !== "apple_health"), ...mappedWorkouts],
            sleepSessions: [...state.sleepSessions.filter((s) => s.source !== "apple_health"), ...mappedSleep],
            lastAppleHealthSyncDate: new Date().toISOString(),
          }));

          return { success:  true, synced: workoutsData.length + sleepData.length };
        } catch (error) {
          return { success: false, synced: 0, error: error instanceof Error ? error.message : "Failed to sync" };
        }
      },

      loadDemoData: () => {
        const demoWorkouts:  Workout[] = [
          {
            id: "demo_1",
            date: new Date().toISOString().split("T")[0],
            type:  "running",
            durationMinutes:  45,
            calories: 450,
            avgHR: 145,
            maxHR: 180,
            strainScore:  85,
            source: "demo",
          },
        ];

        const demoSleep: SleepSession[] = [
          {
            id: "demo_sleep_1",
            date: new Date().toISOString().split("T")[0],
            totalSleepMinutes: 480,
            timeInBedMinutes: 510,
            stages: { awake: 30, light: 180, deep: 180, rem: 90 },
            source: "demo",
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
          workouts: [...state. workouts. filter((w) => w.id !== workout.id), workout],
        })),

      addSleepSession: (session: SleepSession) =>
        set((state) => ({
          sleepSessions: [...state.sleepSessions.filter((s) => s.id !== session.id), session],
        })),

      updateDailyMetric: (metric: DailyMetrics) =>
        set((state) => ({
          dailyMetrics:  [... state.dailyMetrics.filter((m) => m.date !== metric.date), metric],
        })),
    }),
    {
      name: "polar-fitness-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isPolarConnected: state.isPolarConnected,
        isAppleHealthConnected: state.isAppleHealthConnected,
        isDemoMode: state.isDemoMode,
        polarAccessToken: state.polarAccessToken,
        polarRefreshToken: state.polarRefreshToken,
        polarUserId: state.polarUserId,
        lastSyncDate: state. lastSyncDate,
        lastAppleHealthSyncDate: state.lastAppleHealthSyncDate,
        workouts: state. workouts,
        sleepSessions: state.sleepSessions,
        dailyMetrics:  state.dailyMetrics,
        userSettings: state.userSettings,
      }),
    }
  )
);