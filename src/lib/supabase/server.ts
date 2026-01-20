import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<ReturnType<typeof createServerClient>["auth"]> extends any
    ? any
    : never;
};

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        // In Server Components, setting cookies is only allowed in Route Handlers / Server Actions.
        // We keep this as a safe no-op to satisfy the interface and avoid runtime crashes.
        // Middleware should handle session refresh cookie writes.
        try {
          cookiesToSet.forEach(() => {});
        } catch {
          // ignore
        }
      },
    },
  });
}