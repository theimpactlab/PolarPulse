import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase/client';

type Result = { success: boolean; error?: string };
type SyncResult = { success: boolean; synced?: number; error?: string };

const APP_WEB_URL = process.env.EXPO_PUBLIC_APP_URL || '';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

function getCallbackUrl(): string {
  if (Platform.OS === 'web' && APP_WEB_URL) return `${APP_WEB_URL}/polar-callback`;
  return `${APP_WEB_URL}/polar-callback`;
}

function getUserIdOrNull(): string | null {
  const session = supabase.auth.getSession?.() ?? null;
  return session?.user?.id ?? supabase.auth.getUser?.()?.id ?? null;
}

async function pullLatestFromSupabaseImpl(): Promise<{
  success: boolean;
  workouts?: any[];
  sleepSessions?: any[];
  error?: string;
}> {
  try {
    const userId = getUserIdOrNull();
    if (!userId) return { success: false, error: 'Please sign in first.' };

    const workoutsRes = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('workout_date', { ascending: false })
      .limit(500)
      .execute<any[]>();

    if (workoutsRes.error) {
      return { success: false, error: workoutsRes.error.message || 'Failed to load workouts' };
    }

    const sleepRes = await supabase
      .from('sleep_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('sleep_date', { ascending: false })
      .limit(500)
      .execute<any[]>();

    if (sleepRes.error) {
      return { success: false, error: sleepRes.error.message || 'Failed to load sleep sessions' };
    }

    return {
      success: true,
      workouts: workoutsRes.data ?? [],
      sleepSessions: sleepRes.data ?? [],
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to load data.' };
  }
}

export const polarOAuthService = {
  async startOAuthFlow(): Promise<Result> {
    try {
      const userId = getUserIdOrNull();
      if (!userId) return { success: false, error: 'Please sign in before connecting Polar.' };
      if (!SUPABASE_URL) return { success: false, error: 'Missing EXPO_PUBLIC_SUPABASE_URL' };

      const redirectUrl = getCallbackUrl();

      // Use the deployed edge function name you actually have: polar-auth
      const authorizeUrl =
        `${SUPABASE_URL}/functions/v1/polar-auth?user_id=${encodeURIComponent(userId)}` +
        `&redirect_url=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = authorizeUrl;
        return { success: true };
      }

      return { success: false, error: 'Native connect not configured in this build.' };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Failed to start OAuth.' };
    }
  },

  handleWebCallback(urlParams: URLSearchParams): { success: boolean; error?: string } {
    const error = urlParams.get('error');
    if (error) return { success: false, error };
    const polar = urlParams.get('polar');
    if (polar === 'connected') return { success: true };
    return { success: false, error: 'Missing success parameter.' };
  },

  clearPendingOAuth(): void {
    // no-op
  },

  async syncPolarData(): Promise<SyncResult> {
    try {
      const userId = getUserIdOrNull();
      if (!userId) return { success: false, error: 'Please sign in before syncing.' };

      const { data, error } = await supabase.functions.invoke<{
        results: Array<{ user_id: string; success: boolean; synced?: number; error?: string }>;
      }>('sync-polar', { body: { user_id: userId } });

      if (error) return { success: false, error: error.message };

      const first = data?.results?.[0];
      if (!first) return { success: false, error: 'No sync result returned.' };
      if (!first.success) return { success: false, error: first.error || 'Sync failed.' };

      return { success: true, synced: first.synced ?? 0 };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Sync failed.' };
    }
  },

  // IMPORTANT: this is the function your app-store is calling
  async pullLatestFromSupabase(): Promise<{
    success: boolean;
    workouts?: any[];
    sleepSessions?: any[];
    error?: string;
  }> {
    return pullLatestFromSupabaseImpl();
  },

  async disconnectPolar(): Promise<{ success: boolean; error?: string }> {
    try {
      const userId = getUserIdOrNull();
      if (!userId) return { success: false, error: 'Please sign in first.' };

      const del = await supabase
        .from('oauth_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('provider', 'polar')
        .execute<any>();

      if (del.error) return { success: false, error: del.error.message || 'Failed to delete oauth token' };

      await supabase
        .from('profiles')
        .update({ polar_user_id: null, polar_connected_at: null })
        .eq('id', userId)
        .execute<any>();

      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Disconnect failed.' };
    }
  },
};

// TEMP: uncomment to verify bundle includes this function
console.log('[polarOAuthService keys]', Object.keys(polarOAuthService));