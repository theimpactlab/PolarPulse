/**
 * Polar API Service
 * Direct integration with Polar AccessLink API v3
 */

import { supabase } from '@/lib/supabase/client';

const POLAR_BASE_URL = 'https://www.polaraccesslink.com/v3';

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
}

async function getPolarAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase. auth.getSession();
    if (! session?. user?. id) {
      console.warn('[getPolarAccessToken] No session found');
      return null;
    }

    // Get token from oauth_tokens table
    const { data, error } = await supabase
      .from('oauth_tokens')
      .select('access_token')
      .eq('user_id', session.user. id)
      .eq('provider', 'polar')
      .single();

    if (error) {
      console.warn('[getPolarAccessToken] Token query error:', error. message);
      return null;
    }

    return data?. access_token || null;
  } catch (e) {
    console.error('[getPolarAccessToken] Exception:', e);
    return null;
  }
}

async function polarFetch(endpoint: string, options: FetchOptions = {}) {
  const token = await getPolarAccessToken();
  if (!token) {
    throw new Error('Polar access token not found.  Please authenticate first.');
  }

  const url = `${POLAR_BASE_URL}${endpoint}`;
  const headers:  Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Polar API error (${response.status}): ${error}`);
    }

    if (response.status === 204) return null;
    return response.json();
  } catch (err) {
    console.error(`[polarFetch] ${endpoint} error:`, err);
    throw err;
  }
}

export const polarApi = {
  // User endpoints
  async getUser(userId: string) {
    return polarFetch(`/users/${userId}`);
  },

  // Exercise endpoints (non-transactional - last 30 days)
  async getExercises() {
    return polarFetch('/exercises');
  },

  async getExerciseById(exerciseId: string) {
    return polarFetch(`/exercises/${exerciseId}`);
  },

  async getExerciseFit(exerciseId: string) {
    return polarFetch(`/exercises/${exerciseId}/fit`);
  },

  // Activity endpoints (last 28 days)
  async getActivities() {
    return polarFetch('/users/activities');
  },

  async getActivityByDate(date: string) {
    return polarFetch(`/users/activities/${date}`);
  },

  async getActivitiesByDateRange(from: string, to:  string) {
    return polarFetch(`/users/activities?from=${from}&to=${to}`);
  },

  async getActivitySamples() {
    return polarFetch('/users/activities/samples');
  },

  async getActivitySamplesByDate(date: string) {
    return polarFetch(`/users/activities/samples/${date}`);
  },

  // Heart rate endpoints
  async getContinuousHeartRate(date: string) {
    return polarFetch(`/users/continuous-heart-rate/${date}`);
  },

  async getContinuousHeartRateRange(from: string, to: string) {
    return polarFetch(`/users/continuous-heart-rate?from=${from}&to=${to}`);
  },

  // Training load endpoints
  async getCardioLoad() {
    return polarFetch('/users/cardio-load/');
  },

  async getCardioLoadByDate(date: string) {
    return polarFetch(`/users/cardio-load/${date}`);
  },

  async getCardioLoadByDateRange(from: string, to:  string) {
    return polarFetch(`/users/cardio-load/date?from=${from}&to=${to}`);
  },

  async getCardioLoadLastDays(days: number) {
    return polarFetch(`/users/cardio-load/period/days/${days}`);
  },

  // Sleep endpoints (last 28 days)
  async getSleep() {
    return polarFetch('/users/sleep');
  },

  async getSleepByDate(date: string) {
    return polarFetch(`/users/sleep/${date}`);
  },

  async getSleepAvailable() {
    return polarFetch('/users/sleep/available');
  },

  // Nightly Recharge endpoints
  async getNightlyRecharge() {
    return polarFetch('/users/nightly-recharge');
  },

  async getNightlyRechargeByDate(date: string) {
    return polarFetch(`/users/nightly-recharge/${date}`);
  },

  // Biosensing endpoints
  async getBodyTemperature(from?:  string, to?: string) {
    let endpoint = '/users/biosensing/bodytemperature';
    if (from && to) endpoint += `?from=${from}&to=${to}`;
    return polarFetch(endpoint);
  },

  async getSkinTemperature(from?: string, to?: string) {
    let endpoint = '/users/biosensing/skintemperature';
    if (from && to) endpoint += `?from=${from}&to=${to}`;
    return polarFetch(endpoint);
  },

  async getECG(from?: string, to?:  string) {
    let endpoint = '/users/biosensing/ecg';
    if (from && to) endpoint += `?from=${from}&to=${to}`;
    return polarFetch(endpoint);
  },

  async getSpO2(from?: string, to?: string) {
    let endpoint = '/users/biosensing/spo2';
    if (from && to) endpoint += `?from=${from}&to=${to}`;
    return polarFetch(endpoint);
  },

  // Exercise Transactions (detailed data)
  async initiateExerciseTransaction(userId: string) {
    return polarFetch(`/users/${userId}/exercise-transactions`, { method: 'POST' });
  },

  async getExerciseTransaction(userId: string, transactionId: string) {
    return polarFetch(`/users/${userId}/exercise-transactions/${transactionId}`);
  },

  async getExerciseInTransaction(userId: string, transactionId: string, exerciseId: string) {
    return polarFetch(`/users/${userId}/exercise-transactions/${transactionId}/exercises/${exerciseId}`);
  },

  async getExerciseHRZones(userId: string, transactionId: string, exerciseId:  string) {
    return polarFetch(`/users/${userId}/exercise-transactions/${transactionId}/exercises/${exerciseId}/heart-rate-zones`);
  },

  async commitExerciseTransaction(userId: string, transactionId: string) {
    return polarFetch(`/users/${userId}/exercise-transactions/${transactionId}`, { method: 'PUT' });
  },
};