// Apple Health Service
// Uses react-native-health under the hood (requires development build)
// This service provides a clean API for the app to interact with HealthKit

import { Platform } from "react-native";

// HealthKit data types we're interested in
export const HEALTH_PERMISSIONS = {
  read: [
    "ActiveEnergyBurned",
    "BasalEnergyBurned",
    "HeartRate",
    "RestingHeartRate",
    "HeartRateVariabilitySDNN",
    "SleepAnalysis",
    "StepCount",
    "DistanceWalkingRunning",
    "Workout",
  ],
  write: [] as string[],
};

export interface HealthWorkout {
  id: string;
  startDate: string;
  endDate: string;
  activityType: string;
  duration: number; // minutes
  totalEnergyBurned: number; // calories
  totalDistance?: number; // meters
  averageHeartRate?: number;
  maxHeartRate?: number;
}

export interface HealthSleepSample {
  id: string;
  startDate: string;
  endDate: string;
  value: "ASLEEP" | "INBED" | "AWAKE" | "CORE" | "DEEP" | "REM";
}

export interface HealthHeartRateSample {
  id: string;
  startDate: string;
  value: number; // bpm
}

export interface HealthHRVSample {
  id: string;
  startDate: string;
  value: number; // ms
}

export interface HealthDailySummary {
  date: string;
  steps: number;
  activeCalories: number;
  restingCalories: number;
  distance: number; // meters
  avgHeartRate?: number;
  restingHeartRate?: number;
  hrv?: number;
}

// Check if Apple Health is available
export function isHealthAvailable(): boolean {
  return Platform.OS === "ios";
}

// Mock implementation for development/demo
// In production, this would use react-native-health
class AppleHealthService {
  private isAuthorized = false;

  async checkAuthorization(): Promise<boolean> {
    if (!isHealthAvailable()) return false;

    // In production, this would call:
    // AppleHealthKit.isAvailable((err, available) => {...})
    // AppleHealthKit.getAuthStatus({permissions: HEALTH_PERMISSIONS}, (err, result) => {...})
    return this.isAuthorized;
  }

  async requestAuthorization(): Promise<boolean> {
    if (!isHealthAvailable()) {
      throw new Error("Apple Health is only available on iOS");
    }

    // In production, this would call:
    // AppleHealthKit.initHealthKit(HEALTH_PERMISSIONS, (err) => {...})

    // For now, simulate success
    this.isAuthorized = true;
    return true;
  }

  async getWorkouts(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<HealthWorkout[]> {
    if (!this.isAuthorized) {
      throw new Error("Not authorized to access Apple Health");
    }

    // In production, this would call:
    // AppleHealthKit.getSamples({
    //   type: 'Workout',
    //   startDate: startDate.toISOString(),
    //   endDate: endDate.toISOString(),
    // }, (err, results) => {...})

    // Return empty array - real data comes from HealthKit
    return [];
  }

  async getSleepSamples(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<HealthSleepSample[]> {
    if (!this.isAuthorized) {
      throw new Error("Not authorized to access Apple Health");
    }

    // In production, this would call:
    // AppleHealthKit.getSleepSamples({
    //   startDate: startDate.toISOString(),
    //   endDate: endDate.toISOString(),
    // }, (err, results) => {...})

    return [];
  }

  async getHeartRateSamples(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<HealthHeartRateSample[]> {
    if (!this.isAuthorized) {
      throw new Error("Not authorized to access Apple Health");
    }

    // In production, this would call:
    // AppleHealthKit.getHeartRateSamples({
    //   startDate: startDate.toISOString(),
    //   endDate: endDate.toISOString(),
    // }, (err, results) => {...})

    return [];
  }

  async getRestingHeartRate(date: Date): Promise<number | null> {
    if (!this.isAuthorized) {
      throw new Error("Not authorized to access Apple Health");
    }

    // In production, this would call:
    // AppleHealthKit.getRestingHeartRate({
    //   date: date.toISOString(),
    // }, (err, result) => {...})

    return null;
  }

  async getHRVSamples(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<HealthHRVSample[]> {
    if (!this.isAuthorized) {
      throw new Error("Not authorized to access Apple Health");
    }

    // In production, this would call:
    // AppleHealthKit.getHeartRateVariabilitySamples({
    //   startDate: startDate.toISOString(),
    //   endDate: endDate.toISOString(),
    // }, (err, results) => {...})

    return [];
  }

  async getDailySummary(date: Date): Promise<HealthDailySummary> {
    const dateStr = date.toISOString().split("T")[0];
    const startOfDay = new Date(dateStr);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Get all metrics for the day
    const [heartRates, restingHR, hrvSamples] = await Promise.all([
      this.getHeartRateSamples(startOfDay, endOfDay),
      this.getRestingHeartRate(date),
      this.getHRVSamples(startOfDay, endOfDay),
    ]);

    // Calculate averages
    const avgHeartRate =
      heartRates.length > 0
        ? heartRates.reduce((sum, s) => sum + s.value, 0) / heartRates.length
        : undefined;

    const avgHRV =
      hrvSamples.length > 0
        ? hrvSamples.reduce((sum, s) => sum + s.value, 0) / hrvSamples.length
        : undefined;

    return {
      date: dateStr,
      steps: 0, // Would come from getStepCount
      activeCalories: 0, // Would come from getActiveEnergyBurned
      restingCalories: 0, // Would come from getBasalEnergyBurned
      distance: 0, // Would come from getDistanceWalkingRunning
      avgHeartRate,
      restingHeartRate: restingHR ?? undefined,
      hrv: avgHRV,
    };
  }

  // Convert HealthKit workout type to our format
  private mapWorkoutType(healthKitType: string): string {
    const typeMap: Record<string, string> = {
      Running: "Run",
      Walking: "Walk",
      Cycling: "Cycling",
      Swimming: "Swim",
      Hiking: "Hike",
      Yoga: "Yoga",
      HighIntensityIntervalTraining: "HIIT",
      FunctionalStrengthTraining: "Strength",
      TraditionalStrengthTraining: "Strength",
      CrossTraining: "Cross Training",
      Elliptical: "Elliptical",
      Rowing: "Rowing",
      Stairstepping: "Stairs",
      Dance: "Dance",
      Pilates: "Pilates",
      Other: "Workout",
    };
    return typeMap[healthKitType] || "Workout";
  }

  // Convert HealthKit sleep value to our format
  private mapSleepValue(
    healthKitValue: string
  ): "ASLEEP" | "INBED" | "AWAKE" | "CORE" | "DEEP" | "REM" {
    const valueMap: Record<string, "ASLEEP" | "INBED" | "AWAKE" | "CORE" | "DEEP" | "REM"> = {
      ASLEEP: "ASLEEP",
      INBED: "INBED",
      AWAKE: "AWAKE",
      ASLEEPCORE: "CORE",
      ASLEEPDEEP: "DEEP",
      ASLEEPREM: "REM",
    };
    return valueMap[healthKitValue] || "ASLEEP";
  }
}

// Export singleton instance
export const appleHealthService = new AppleHealthService();
