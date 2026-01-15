import { Platform } from "react-native";
import { supabase } from "@/lib/supabase/client";

type Result = { success: boolean; error?: string };
type SyncResult = { success: boolean; synced?: number; error?: string };
type PullResult = {
  success: boolean;
  workouts?: any[];
  sleeps?: any[];
  error?: string;
};

const APP_WEB_URL = process.env.EXPO_PUBLIC_APP_URL || "";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";

function getCallbackUrl(): string {
  if (APP_WEB_URL) return `${APP_WEB_URL}/polar-callback`;
  return "/polar-callback";
}

export const polarOAuthService = {
  async startOAuthFlow(): Promise<Result> {
    try {
      const session = supabase.auth.getSession?.() ?? null;
      const userId = session?.user?.id ?? supabase.auth.getUser?.()?.id ?? null;

      if (!userId) return { success: false, error: "Please sign in before connecting Polar." };
      if (!SUPABASE_URL) return { success: false, error: "Missing EXPO_PUBLIC_SUPABASE_URL" };
      if (!APP_WEB_URL) return { success: false, error: "Missing EXPO_PUBLIC_APP_URL" };

      const redirectUrl = getCallbackUrl();

      const authorizeUrl =
        `${SUPABASE_URL}/functions/v1/polar-auth` +
        `?user_id=${encodeURIComponent(userId)}` +
        `&redirect_url=${encodeURIComponent(redirectUrl)}`;

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

  async pullLatestFromSupabase(): Promise<PullResult> {
    try {
      const session = supabase.auth.getSession?.() ?? null;
      const userId = session?.user?.id ?? supabase.auth.getUser?.()?.id ?? null;
      if (!userId) return { success: false, error: "Not signed in" };

      // Grab latest 60 workouts + latest 30 sleeps (tweak as needed)
      const workoutsRes = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", userId)
        .order("workout_date", { ascending: false })
        .limit(60)
        .execute<any[]>();

      if (workoutsRes.error) {
        return { success: false, error: workoutsRes.error.message };
      }

      const sleepsRes = await supabase
        .from("sleep_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("sleep_date", { ascending: false })
        .limit(30)
        .execute<any[]>();

      if (sleepsRes.error) {
        return { success: false, error: sleepsRes.error.message };
      }

      return { success: true, workouts: workoutsRes.data ?? [], sleeps: sleepsRes.data ?? [] };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Failed to fetch data" };
    }
  },

  async disconnectPolar(): Promise<void> {
    const session = supabase.auth.getSession?.() ?? null;
    const userId = session?.user?.id ?? supabase.auth.getUser?.()?.id ?? null;
    if (!userId) return;

    await supabase.functions.invoke<{ success: boolean }>("polar-disconnect", {
      body: { user_id: userId },
    });
  },
};