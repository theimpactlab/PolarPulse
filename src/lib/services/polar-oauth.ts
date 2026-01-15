import { Platform } from "react-native";
import { supabase } from "@/lib/supabase/client";

type Result = { success: boolean; error?: string };
type SyncResult = { success: boolean; synced?: number; error?: string };

const APP_WEB_URL = process.env.EXPO_PUBLIC_APP_URL || "";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";

function getCallbackUrl(): string {
  if (Platform.OS === "web" && APP_WEB_URL) return `${APP_WEB_URL}/polar-callback`;
  return `${APP_WEB_URL}/polar-callback`;
}

export const polarOAuthService = {
  async startOAuthFlow(): Promise<Result> {
    try {
      const session = supabase.auth.getSession?.() ?? null;
      const userId = session?.user?.id ?? supabase.auth.getUser?.()?.id ?? null;

      if (!userId) return { success: false, error: "Please sign in before connecting Polar." };
      if (!SUPABASE_URL) return { success: false, error: "Missing EXPO_PUBLIC_SUPABASE_URL" };

      const redirectUrl = getCallbackUrl();
      const state = `${userId}|${encodeURIComponent(redirectUrl)}`;

      // Your edge function name in repo is polar-auth (not polar-start)
      const authorizeUrl = `${SUPABASE_URL}/functions/v1/polar-auth?user_id=${encodeURIComponent(
        userId
      )}&redirect_url=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = authorizeUrl;
        return { success: true };
      }

      return { success: false, error: "Native connect not configured in this build." };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Failed to start OAuth." };
    }
  },

  handleWebCallback(urlParams: URLSearchParams): { success: boolean; error?: string } {
    const error = urlParams.get("error");
    if (error) return { success: false, error };
    const polar = urlParams.get("polar");
    if (polar === "connected") return { success: true };
    return { success: false, error: "Missing success parameter." };
  },

  clearPendingOAuth(): void {
    // no-op
  },

  // ✅ This stops your console error
  async checkPolarConnection(): Promise<{ connected: boolean; polarUserId?: string; error?: string }> {
    try {
      const session = supabase.auth.getSession?.() ?? null;
      const userId = session?.user?.id ?? supabase.auth.getUser?.()?.id ?? null;
      if (!userId) return { connected: false };

      const { data, error } = await supabase
        .from("profiles")
        .select("polar_user_id, polar_connected_at")
        .eq("id", userId)
        .single()
        .execute();

      if (error) return { connected: false, error: error.message };

      const polarUserId = (data as any)?.polar_user_id as string | undefined;
      return { connected: !!polarUserId, polarUserId };
    } catch (e) {
      return { connected: false, error: e instanceof Error ? e.message : "Failed to check connection" };
    }
  },

  async syncPolarData(): Promise<SyncResult> {
    try {
      const session = supabase.auth.getSession?.() ?? null;
      const userId = session?.user?.id ?? supabase.auth.getUser?.()?.id ?? null;

      if (!userId) return { success: false, error: "Please sign in before syncing." };

      const { data, error } = await supabase.functions.invoke<{
        results: Array<{ user_id: string; success: boolean; synced?: number; error?: string }>;
      }>("sync-polar", { body: { user_id: userId } });

      if (error) return { success: false, error: error.message };

      const first = data?.results?.[0];
      if (!first) return { success: false, error: "No sync result returned." };
      if (!first.success) return { success: false, error: first.error || "Sync failed." };

      return { success: true, synced: first.synced ?? 0 };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Sync failed." };
    }
  },

  // ✅ Makes the disconnect button actually do something server-side
  async disconnectPolar(): Promise<Result> {
    try {
      const session = supabase.auth.getSession?.() ?? null;
      const userId = session?.user?.id ?? supabase.auth.getUser?.()?.id ?? null;
      if (!userId) return { success: false, error: "Not signed in." };

      // Delete tokens
      const del = await supabase
        .from("oauth_tokens")
        .delete()
        .eq("user_id", userId)
        .eq("provider", "polar")
        .execute();

      if (del.error) return { success: false, error: del.error.message };

      // Clear profile markers
      const upd = await supabase
        .from("profiles")
        .update({ polar_user_id: null, polar_connected_at: null, updated_at: new Date().toISOString() })
        .eq("id", userId)
        .execute();

      if (upd.error) return { success: false, error: upd.error.message };

      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Disconnect failed." };
    }
  },
};