import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, type User, type Session } from "@/lib/supabase/client";

export type SubscriptionTier = "free" | "premium";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
  subscription_expires_at: string | null;
  polar_user_id: string | null;
  polar_connected_at: string | null;
  sleep_goal_hours: number;
  use_metric: boolean;
}

// All features are now free - no tier limits
export const TIER_LIMITS = {
  free: {
    historyDays: 365,
    trendChartDays: [7, 30, 90] as number[],
    showBaselines: true,
    showPremiumInsights: true,
    canExport: true,
    maxWorkoutsVisible: 1000,
  },
  premium: {
    historyDays: 365,
    trendChartDays: [7, 30, 90] as number[],
    showBaselines: true,
    showPremiumInsights: true,
    canExport: true,
    maxWorkoutsVisible: 1000,
  },
};

interface AuthState {
  // Auth state
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Computed
  isAuthenticated: boolean;
  isPremium: boolean;
  tierLimits: (typeof TIER_LIMITS)["free"];

  // Actions
  initialize: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error?: string }>;
  upgradeToPremium: () => Promise<{ error?: string }>;
  checkSubscriptionStatus: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      isInitialized: false,

      // Computed - these need to be regular properties updated by set()
      isAuthenticated: false,
      isPremium: false,
      tierLimits: TIER_LIMITS.free,

      // Initialize auth on app start
      initialize: async () => {
        set({ isLoading: true });
        try {
          const session = await supabase.auth.initialize();
          if (session) {
            set({
              user: session.user,
              session,
              isAuthenticated: true,
            });
            await get().fetchProfile();
          }
        } catch (error) {
          console.error("Auth init error:", error);
        } finally {
          set({ isLoading: false, isInitialized: true });
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange((newSession) => {
          const hasUser = newSession?.user != null;
          set({
            session: newSession,
            user: newSession?.user ?? null,
            isAuthenticated: hasUser,
          });
          if (newSession) {
            get().fetchProfile();
          } else {
            set({ profile: null, isPremium: false, tierLimits: TIER_LIMITS.free });
          }
        });
      },

      signUp: async (email, password) => {
        set({ isLoading: true });
        try {
          const { error, session, user } = await supabase.auth.signUp(email, password);
          if (error) {
            return { error: error.message };
          }
          if (session && user) {
            set({ session, user, isAuthenticated: true });
            await get().fetchProfile();
          }
          return {};
        } finally {
          set({ isLoading: false });
        }
      },

      signIn: async (email, password) => {
        set({ isLoading: true });
        try {
          const { error, session, user } = await supabase.auth.signInWithPassword(
            email,
            password
          );
          if (error) {
            return { error: error.message };
          }
          if (session && user) {
            set({ session, user, isAuthenticated: true });
            await get().fetchProfile();
          }
          return {};
        } finally {
          set({ isLoading: false });
        }
      },

      signOut: async () => {
        set({ isLoading: true });
        try {
          await supabase.auth.signOut();
          set({
            user: null,
            session: null,
            profile: null,
            isAuthenticated: false,
            isPremium: false,
            tierLimits: TIER_LIMITS.free,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      resetPassword: async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) {
          return { error: error.message };
        }
        return {};
      },

      fetchProfile: async () => {
        const user = get().user;
        if (!user) return;

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()
          .execute<Profile>();

        if (error) {
          console.error("Failed to fetch profile:", error);
          return;
        }

        if (data) {
          // Calculate premium status
          let isPremium = false;
          if (data.subscription_tier === "premium") {
            if (data.subscription_expires_at) {
              isPremium = new Date(data.subscription_expires_at) > new Date();
            } else {
              isPremium = true;
            }
          }

          set({
            profile: data,
            isPremium,
            tierLimits: isPremium ? TIER_LIMITS.premium : TIER_LIMITS.free,
          });
        }
      },

      updateProfile: async (updates) => {
        const user = get().user;
        if (!user) return { error: "Not authenticated" };

        const { error } = await supabase
          .from("profiles")
          .eq("id", user.id)
          .update(updates);

        if (error) {
          return { error: error.message };
        }

        // Refresh profile
        await get().fetchProfile();
        return {};
      },

      upgradeToPremium: async () => {
        // This would typically integrate with RevenueCat or Stripe
        // For now, we'll just update the profile directly (for testing)
        const user = get().user;
        if (!user) return { error: "Not authenticated" };

        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year subscription

        const { error } = await supabase
          .from("profiles")
          .eq("id", user.id)
          .update({
            subscription_tier: "premium",
            subscription_expires_at: expiresAt.toISOString(),
          });

        if (error) {
          return { error: error.message };
        }

        await get().fetchProfile();
        return {};
      },

      checkSubscriptionStatus: async () => {
        const profile = get().profile;
        if (!profile) return;

        // Check if premium has expired
        if (
          profile.subscription_tier === "premium" &&
          profile.subscription_expires_at &&
          new Date(profile.subscription_expires_at) < new Date()
        ) {
          // Downgrade to free
          await get().updateProfile({ subscription_tier: "free" });
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist essential auth data
        user: state.user,
        session: state.session,
        profile: state.profile,
        isAuthenticated: state.isAuthenticated,
        isPremium: state.isPremium,
      }),
    }
  )
);
