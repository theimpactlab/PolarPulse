import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateAllMockData } from '@/lib/utils/mock-data';
import { appleHealthService, isHealthAvailable } from '@/lib/services/apple-health';
import { calculateStrainScore } from '@/lib/utils/scoring';
import { polarOAuthService } from '@/lib/services/polar-oauth';

// Types
export interface HRZone {
  zone: number;
  minutes: number;
}

export interface Workout {
  id: string;
  date: string;
  type: string;
  durationMinutes: number;
  calories: number;
  avgHR: number;
  maxHR: number;
  hrZones?: HRZone[];
  strainScore?: number;
  polarId?: string;
  healthKitId?: string;
  source: 'polar' | 'apple_health' | 'manual' | 'demo';
}

export interface SleepSession {
  id: string;
  date: string;
  sleepStart?: string;
  sleepEnd?: string;
  totalSleepMinutes: number;
  timeInBedMinutes: number;
  stages?: {
    awake: number;
    light: number;
    deep: number;
    rem: number;
  };
  polarId?: string;
  healthKitId?: string;
  source: 'polar' | 'apple_health' | 'manual' | 'demo';
}

export interface DailyMetrics {
  date: string;
  recoveryScore: number;
  strainScore: number;
  sleepScore: number;
  sleepConsistency: number;
  hrv?: number;
  rhr?: number;
  bodyBattery?: number;
  vo2Max?: number;
  trainingLoad?: number;
  trainingLoadStatus?: 'detraining' | 'recovery' | 'maintaining' | 'productive' | 'peaking' | 'overreaching';
  trainingReadiness?: number;
  sleepDebt?: number;
  bodyTempDeviation?: number;
}

export interface BodyBatteryReading {
  timestamp: string;
  value: number;
}

export interface TrainingLoadHistory {
  date: string;
  acuteLoad: number;
  chronicLoad: number;
  ratio: number;
}

export interface Baselines {
  hrvBaseline: number;
  rhrBaseline: number;
  sleepDurationBaseline: number;
  strainBaseline: number;
  vo2MaxBaseline?: number;
  bodyTempBaseline?: number;
  chronicTrainingLoad?: number;
}

export interface UserSettings {
  sleepGoalHours: number;
  units: 'Metric' | 'Imperial';
  notificationsEnabled: boolean;
}

export interface Insight {
  id: string;
  date: string;
  type: 'recovery' | 'strain' | 'sleep' | 'general';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

type Result = { success: boolean; error?: string };
type SyncResult = { success: boolean; synced?: number; error?: string };

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

  bodyBatteryHistory: BodyBatteryReading[];
  trainingLoadHistory: TrainingLoadHistory[];

  // User preferences
  userSettings: UserSettings;

  // Polar Actions
  connectPolar: () => Promise<Result>;
  disconnectPolar: () => Promise<Result>;
  syncData: () => Promise<SyncResult>;

  // Apple Health Actions
  checkAppleHealthAvailability: () => void;
  connectAppleHealth: () => Promise<Result>;
  disconnectAppleHealth: () => void;
  syncAppleHealth: () => Promise<{ success: boolean; synced: number; error?: string }>;

  // General Actions
  loadDemoData: () => void;
  clearAllData: () => void;
  exportData: () => Promise<string>;
  updateSettings: (settings: Partial<UserSettings>) => void;

  // Data setters
  setWorkouts: (workouts: Workout[]) => void;
  setSleepSessions: (sessions: SleepSession[]) => void;
  setDailyMetrics: (metrics: DailyMetrics[]) => void;
  setBaselines: (baselines: Baselines) => void;
  setInsights: (insights: Insight[]) => void;
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
      isAppleHealthAvailable: isHealthAvailable(),
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
        try {
          await polarOAuthService.disconnectPolar();
        } catch {
          // If server disconnect fails, still clear local state
        }

        set({
          isPolarConnected: false,
          isDemoMode: false,
          polarAccessToken: undefined,
          polarRefreshToken: undefined,
          polarUserId: undefined,
          lastSyncDate: undefined,
        });
      },

      syncData: async () => {
        const result = await polarOAuthService.syncPolarData();
        if (result.success) {
          set({ lastSyncDate: new Date().toISOString() });
        }
        return result;
      },

      // Apple Health actions
      checkAppleHealthAvailability: () => {
        set({ isAppleHealthAvailable: isHealthAvailable() });
      },

      connectAppleHealth: async () => {
        if (!isHealthAvailable()) {
          return { success: false, error: 'Apple Health is only available on iOS' };
        }

        try {
          const authorized = await appleHealthService.requestAuthorization();
          if (authorized) {
            set({ isAppleHealthConnected: true, isDemoMode: false });
            return { success: true };
          }
          return { success: false, error: 'Authorization denied' };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to connect',
          };
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
          return { success: false, synced: 0, error: 'Not connected to Apple Health' };
        }

        try {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const healthWorkouts = await appleHealthService.getWorkouts(thirtyDaysAgo);
          let syncedCount = 0;

          for (const hw of healthWorkouts) {
            const workout: Workout = {
              id: `health_${hw.id}`,
              healthKitId: hw.id,
              date: hw.startDate.split('T')[0],
              type: hw.activityType,
              durationMinutes: hw.duration,
              calories: hw.totalEnergyBurned,
              avgHR: hw.averageHeartRate || 0,
              maxHR: hw.maxHeartRate || 0,
              strainScore: calculateStrainScore(
                hw.duration,
                hw.averageHeartRate || 120,
                hw.maxHeartRate || 160
              ),
              source: 'apple_health',
            };
            get().addWorkout(workout);
            syncedCount++;
          }

          const healthSleep = await appleHealthService.getSleepSamples(thirtyDaysAgo);

          const sleepByDate: Record<string, typeof healthSleep> = {};
          for (const sample of healthSleep) {
            const date = sample.startDate.split('T')[0];
            if (!sleepByDate[date]) sleepByDate[date] = [];
            sleepByDate[date].push(sample);
          }

          for (const [date, samples] of Object.entries(sleepByDate)) {
            const stages = { awake: 0, light: 0, deep: 0, rem: 0 };
            let totalMinutes = 0;
            const bedtimeStart = samples[0]?.startDate;
            const bedtimeEnd = samples[samples.length - 1]?.endDate;

            for (const sample of samples) {
              const duration =
                (new Date(sample.endDate).getTime() - new Date(sample.startDate).getTime()) / 60000;
              totalMinutes += duration;

              switch (sample.value) {
                case 'AWAKE':
                  stages.awake += duration;
                  break;
                case 'CORE':
                case 'ASLEEP':
                  stages.light += duration;
                  break;
                case 'DEEP':
                  stages.deep += duration;
                  break;
                case 'REM':
                  stages.rem += duration;
                  break;
              }
            }

            const session: SleepSession = {
              id: `health_sleep_${date}`,
              date,
              sleepStart: bedtimeStart,
              sleepEnd: bedtimeEnd,
              totalSleepMinutes: totalMinutes - stages.awake,
              timeInBedMinutes: totalMinutes,
              stages,
              source: 'apple_health',
            };
            get().addSleepSession(session);
            syncedCount++;
          }

          set({ lastAppleHealthSyncDate: new Date().toISOString() });
          return { success: true, synced: syncedCount };
        } catch (error) {
          return {
            success: false,
            synced: 0,
            error: error instanceof Error ? error.message : 'Sync failed',
          };
        }
      },

      loadDemoData: () => {
        const mockData = generateAllMockData(30);
        set({
          workouts: mockData.workouts,
          sleepSessions: mockData.sleepSessions,
          dailyMetrics: mockData.dailyMetrics,
          baselines: mockData.baselines,
          insights: mockData.insights,
          bodyBatteryHistory: mockData.bodyBatteryHistory,
          trainingLoadHistory: mockData.trainingLoadHistory,
          isDemoMode: true,
          lastSyncDate: new Date().toISOString(),
        });
      },

      clearAllData: () => {
        set({
          workouts: [],
          sleepSessions: [],
          dailyMetrics: [],
          insights: [],
          bodyBatteryHistory: [],
          trainingLoadHistory: [],
          baselines: undefined,
          lastSyncDate: undefined,
          lastAppleHealthSyncDate: undefined,
          isDemoMode: false,
        });
      },

      exportData: async () => {
        const state = get();
        const workoutsCsv = state.workouts
          .map((w: Workout) => `${w.date},${w.type},${w.durationMinutes},${w.calories},${w.avgHR},${w.source}`)
          .join('\n');
        return `date,type,duration,calories,avgHR,source\n${workoutsCsv}`;
      },

      updateSettings: (settings) => {
        set((state) => ({
          userSettings: { ...state.userSettings, ...settings },
        }));
      },

      // Data setters
      setWorkouts: (workouts) => set({ workouts }),
      setSleepSessions: (sleepSessions) => set({ sleepSessions }),
      setDailyMetrics: (dailyMetrics) => set({ dailyMetrics }),
      setBaselines: (baselines) => set({ baselines }),
      setInsights: (insights) => set({ insights }),

      addWorkout: (workout) =>
        set((state) => ({
          workouts: [...state.workouts.filter((w: Workout) => w.id !== workout.id), workout],
        })),

      addSleepSession: (session) =>
        set((state) => ({
          sleepSessions: [...state.sleepSessions.filter((s: SleepSession) => s.id !== session.id), session],
        })),

      updateDailyMetric: (metric) =>
        set((state) => ({
          dailyMetrics: [...state.dailyMetrics.filter((m: DailyMetrics) => m.date !== metric.date), metric],
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
        baselines: state.baselines,
        insights: state.insights,
        bodyBatteryHistory: state.bodyBatteryHistory,
        trainingLoadHistory: state.trainingLoadHistory,
        userSettings: state.userSettings,
      }),
    }
  )
);