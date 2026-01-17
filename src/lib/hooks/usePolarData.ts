/**
 * Custom hooks for Polar API data
 * Handles fetching, caching, and state management
 */

import { useEffect, useState, useCallback } from 'react';
import { polarApi } from '@/lib/services/polar-api';
import { transformExerciseToWorkout, transformSleepToSession, calculateDailyMetrics } from '@/lib/utils/polar-data-transform';
import type { Workout, SleepSession, DailyMetrics } from '@/lib/state/app-store';

interface UseDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch recent exercises
 */
export function useExercises() {
  const [state, setState] = useState<UseDataState<Workout[]>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await polarApi.getExercises();
      
      if (! response?. exercises) {
        setState({ data: [], loading: false, error: null });
        return;
      }

      const workouts = response.exercises.map(transformExerciseToWorkout);
      setState({ data: workouts, loading: false, error: null });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to fetch exercises';
      setState({ data: null, loading: false, error });
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ... state, refetch };
}

/**
 * Hook to fetch sleep data
 */
export function useSleepData(date?: string) {
  const [state, setState] = useState<UseDataState<SleepSession | null>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const response = await polarApi.getSleepByDate(targetDate);
      
      if (!response) {
        setState({ data: null, loading: false, error: null });
        return;
      }

      const sleepSession = transformSleepToSession(response);
      setState({ data: sleepSession, loading: false, error:  null });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to fetch sleep data';
      setState({ data: null, loading: false, error });
    }
  }, [date]);

  useEffect(() => {
    refetch();
  }, [refetch, date]);

  return { ...state, refetch };
}

/**
 * Hook to fetch cardio load (training load)
 */
export function useCardioLoad(date?: string) {
  const [state, setState] = useState<UseDataState<any>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      let response;
      
      if (date) {
        response = await polarApi.getCardioLoadByDate(date);
      } else {
        response = await polarApi.getCardioLoad();
      }

      setState({ data: response, loading: false, error: null });
    } catch (err) {
      const error = err instanceof Error ? err. message : 'Failed to fetch cardio load';
      setState({ data: null, loading: false, error });
    }
  }, [date]);

  useEffect(() => {
    refetch();
  }, [refetch, date]);

  return { ...state, refetch };
}

/**
 * Hook to fetch daily metrics for a specific date
 */
export function useDailyMetrics(date: string, workouts: Workout[]) {
  const [state, setState] = useState<UseDataState<DailyMetrics>>({
    data:  {
      date,
      recoveryScore: 0,
      strainScore: 0,
      sleepScore: 0,
    },
    loading: true,
    error: null,
  });

  const refetch = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const [sleepResponse, cardioLoadResponse, hrResponse] = await Promise.all([
        polarApi.getSleepByDate(date).catch(() => null),
        polarApi.getCardioLoadByDate(date).catch(() => null),
        polarApi.getContinuousHeartRate(date).catch(() => null),
      ]);

      const sleepData = sleepResponse ? transformSleepToSession(sleepResponse) : undefined;
      const metrics = calculateDailyMetrics(date, workouts, sleepData, cardioLoadResponse, hrResponse);

      setState({ data: metrics, loading: false, error: null });
    } catch (err) {
      const error = err instanceof Error ?  err.message : 'Failed to fetch metrics';
      setState(prev => ({
        ...prev,
        loading: false,
        error,
      }));
    }
  }, [date, workouts]);

  useEffect(() => {
    refetch();
  }, [refetch, date, workouts]);

  return { ...state, refetch };
}

/**
 * Hook to fetch heart rate data for a date range
 */
export function useHeartRateData(from: string, to: string) {
  const [state, setState] = useState<UseDataState<any>>({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await polarApi.getContinuousHeartRateRange(from, to);
      setState({ data: response, loading: false, error: null });
    } catch (err) {
      const error = err instanceof Error ? err. message : 'Failed to fetch heart rate data';
      setState({ data: null, loading: false, error });
    }
  }, [from, to]);

  useEffect(() => {
    refetch();
  }, [refetch, from, to]);

  return { ...state, refetch };
}