// src/lib/services/polar-oauth.ts
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase/client';

type Result = { success: boolean; error?: string };
type SyncResult = { success: boolean; synced?: number; error?: string };

const APP_WEB_URL = process.env.EXPO_PUBLIC_APP_URL || '';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

function getCallbackUrl(): string {
  // Web: return the deployed app callback route
  if (Platform.OS === 'web') {
    if (APP_WEB_URL) return `${APP_WEB_URL}/polar-callback`;
    if (typeof window !== 'undefined') return `${window.location.origin}/polar-callback`;
  }

  // Native: keep your current approach for now
  return `${APP_WEB_URL}/polar-callback`;
}

function getCurrentUserId(): string | null {
  // Your lightweight client has synchronous getters
  const session = supabase.auth.getSession?.() ?? null;
  const userFromSession = session?.user?.id ?? null;

  const user = supabase.auth.getUser?.() ?? null;
  const userFromGetter = user?.id ?? null;

  return userFromSession || userFromGetter;
}

export const polarOAuthService = {
  async startOAuthFlow(): Promise<Result> {
    try {
      const userId = getCurrentUserId();
      if (!userId) return { success: false, error: 'Please sign in before connecting Polar.' };
      if (!SUPABASE_URL) return { success: false, error: 'Missing EXPO_PUBLIC_SUPABASE_URL' };

      const redirectUrl = getCallbackUrl();

      // IMPORTANT: your deployed edge function is `polar-auth` (not `polar-start`)
      const authorizeUrl =
        `${SUPABASE_URL}/functions/v1/polar-auth` +
        `?user_id=${encodeURIComponent(userId)}` +
        `&redirect_url=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = authorizeUrl;
        return { success: true };
      }

      // If you want native, swap this for Linking.openURL(authorizeUrl)
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

  async syncPolarData(): Promise<SyncResult> {
    try {
      const userId = getCurrentUserId();
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

  async disconnectPolar(): Promise<Result> {
    try {
      const userId = getCurrentUserId();
      if (!userId) return { success: true };

      // Use a service-role edge function to delete tokens reliably (RLS-safe)
      const { data, error } = await supabase.functions.invoke<{ success: boolean; error?: string }>(
        'disconnect-polar',
        { body: { user_id: userId } }
      );

      if (error) return { success: false, error: error.message };
      if (!data?.success) return { success: false, error: data?.error || 'Disconnect failed.' };

      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Disconnect failed.' };
    }
  },
};