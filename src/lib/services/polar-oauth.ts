// Polar OAuth Service
// Handles the OAuth flow for connecting Polar Flow accounts

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase/client';

// Supabase function URLs - these will be set based on your Supabase project
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

// For web, we need to know the app URL to redirect back to
const getAppUrl = (): string => {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
  return Linking.createURL('');
};

export interface PolarOAuthResult {
  success: boolean;
  error?: string;
}

class PolarOAuthService {
  private pendingOAuthResolve: ((result: PolarOAuthResult) => void) | null = null;

  /**
   * Initiates the Polar OAuth flow
   * Opens the browser for the user to authorize the app
   */
  async startOAuthFlow(): Promise<PolarOAuthResult> {
    try {
      // Check if Supabase is configured
      if (!SUPABASE_URL) {
        return {
          success: false,
          error: 'Backend not configured. Please set up Supabase first.',
        };
      }

      // Get the current user if signed in, or use a device-local ID
      const user = supabase.auth.getUser();
      const userId = user?.id || await this.getOrCreateLocalUserId();

      // Build the OAuth URL with platform-specific redirect
      const appUrl = getAppUrl();
      const polarOAuthUrl = this.buildOAuthUrl(userId, appUrl);

      // Different flow for web vs native
      if (Platform.OS === 'web') {
        return this.startWebOAuthFlow(polarOAuthUrl);
      } else {
        return this.startNativeOAuthFlow(polarOAuthUrl);
      }
    } catch (error) {
      console.error('Polar OAuth error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to Polar',
      };
    }
  }

  /**
   * Gets or creates a local device ID for users who aren't signed in
   */
  private async getOrCreateLocalUserId(): Promise<string> {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const STORAGE_KEY = 'polar_local_user_id';

    let localId = await AsyncStorage.getItem(STORAGE_KEY);
    if (!localId) {
      // Generate a UUID-like ID
      localId = 'local_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      await AsyncStorage.setItem(STORAGE_KEY, localId);
    }
    return localId;
  }

  /**
   * Web OAuth flow - opens in same window with redirect back
   */
  private async startWebOAuthFlow(polarOAuthUrl: string): Promise<PolarOAuthResult> {
    // For web, we redirect in the same window
    // The callback page will handle the response
    if (typeof window !== 'undefined') {
      // Store that we're expecting a callback
      sessionStorage.setItem('polar_oauth_pending', 'true');

      // Redirect to Polar auth
      window.location.href = polarOAuthUrl;

      // This promise will never resolve since we're redirecting
      // The callback page will handle completion
      return new Promise(() => {});
    }

    return {
      success: false,
      error: 'Web OAuth not available',
    };
  }

  /**
   * Native OAuth flow - opens in in-app browser
   */
  private async startNativeOAuthFlow(polarOAuthUrl: string): Promise<PolarOAuthResult> {
    const result = await WebBrowser.openAuthSessionAsync(
      polarOAuthUrl,
      Linking.createURL('settings')
    );

    if (result.type === 'success') {
      const url = new URL(result.url);
      const error = url.searchParams.get('error');

      if (error) {
        return {
          success: false,
          error: this.getErrorMessage(error),
        };
      }

      const polarConnected = url.searchParams.get('polar');
      if (polarConnected === 'connected') {
        return { success: true };
      }

      return { success: true };
    }

    if (result.type === 'cancel') {
      return {
        success: false,
        error: 'Authorization was cancelled.',
      };
    }

    return {
      success: false,
      error: 'Authorization failed. Please try again.',
    };
  }

  /**
   * Handle OAuth callback from URL parameters (for web)
   * Call this from the callback page
   */
  handleWebCallback(params: URLSearchParams): PolarOAuthResult {
    const error = params.get('error');
    const polarConnected = params.get('polar');

    if (error) {
      return {
        success: false,
        error: this.getErrorMessage(error),
      };
    }

    if (polarConnected === 'connected') {
      return { success: true };
    }

    // Check if we have a code (successful auth)
    const code = params.get('code');
    if (code) {
      return { success: true };
    }

    return {
      success: false,
      error: 'Authorization failed. Please try again.',
    };
  }

  /**
   * Check if there's a pending OAuth flow (for web page reload handling)
   */
  hasPendingOAuth(): boolean {
    if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('polar_oauth_pending') === 'true';
    }
    return false;
  }

  /**
   * Clear pending OAuth state
   */
  clearPendingOAuth(): void {
    if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('polar_oauth_pending');
    }
  }

  /**
   * Builds the OAuth authorization URL
   */
  private buildOAuthUrl(userId: string, appUrl: string): string {
    // This URL points to our Supabase edge function that handles the OAuth flow
    const authUrl = `${SUPABASE_URL}/functions/v1/polar-auth`;
    const params = new URLSearchParams({
      user_id: userId,
      redirect_url: `${appUrl}/polar-callback`, // Where to return after OAuth
    });
    return `${authUrl}?${params.toString()}`;
  }

  /**
   * Syncs data from Polar via the backend
   */
  async syncPolarData(): Promise<{ success: boolean; synced?: number; error?: string }> {
    try {
      if (!SUPABASE_URL) {
        return {
          success: false,
          error: 'Backend not configured.',
        };
      }

      // Get the user ID - either from Supabase auth or local storage
      const user = supabase.auth.getUser();
      const userId = user?.id || await this.getLocalUserId();

      if (!userId) {
        return {
          success: false,
          error: 'No user ID found. Please reconnect Polar.',
        };
      }

      // Call sync with user_id in body for local users
      const { data, error } = await supabase.functions.invoke<{
        results: Array<{ success: boolean; synced?: number; error?: string }>;
      }>('sync-polar', {
        body: { user_id: userId },
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      const result = data?.results?.[0];
      if (result?.success) {
        return {
          success: true,
          synced: result.synced ?? 0,
        };
      }

      return {
        success: false,
        error: result?.error ?? 'Sync failed',
      };
    } catch (error) {
      console.error('Polar sync error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  }

  /**
   * Disconnects Polar by removing the OAuth tokens
   */
  async disconnectPolar(): Promise<{ success: boolean; error?: string }> {
    try {
      const user = supabase.auth.getUser();
      const userId = user?.id || await this.getLocalUserId();

      if (!userId) {
        return { success: true }; // Nothing to disconnect
      }

      // Delete the OAuth tokens from Supabase
      const { error } = await supabase
        .from('oauth_tokens')
        .eq('user_id', userId)
        .eq('provider', 'polar')
        .delete();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disconnect',
      };
    }
  }

  /**
   * Gets the local user ID if it exists
   */
  private async getLocalUserId(): Promise<string | null> {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    return await AsyncStorage.getItem('polar_local_user_id');
  }

  /**
   * Checks if the user has Polar connected by querying the backend
   */
  async checkPolarConnection(): Promise<boolean> {
    try {
      if (!SUPABASE_URL) return false;

      const userId = await this.getLocalUserId();
      if (!userId) return false;

      const { data, error } = await supabase
        .from('oauth_tokens')
        .select('id')
        .eq('user_id', userId)
        .eq('provider', 'polar')
        .limit(1)
        .execute<Array<{ id: string }>>();

      if (error) {
        console.log('Polar connection check error:', error.message);
        return false;
      }

      return Array.isArray(data) && data.length > 0;
    } catch (err) {
      console.log('Polar connection check failed:', err);
      return false;
    }
  }

  /**
   * Converts error codes to user-friendly messages
   */
  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'oauth_denied':
        return 'You denied access to Polar. Please try again if you want to connect.';
      case 'token_exchange':
        return 'Failed to complete authorization. Please try again.';
      case 'invalid_state':
        return 'Security error. Please try again.';
      default:
        return 'Failed to connect to Polar. Please try again.';
    }
  }
}

export const polarOAuthService = new PolarOAuthService();
