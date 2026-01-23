import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function sanitizeNext(nextRaw: string | null): string {
  const fallback = "/app/dashboard";
  if (!nextRaw) return fallback;
  const n = nextRaw.trim();
  if (!n.startsWith("/")) return fallback;
  if (!n.startsWith("/app")) return fallback;
  return n;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNext(url.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      new URL(`/login?error=missing_code&next=${encodeURIComponent(next)}`, url.origin),
    );
  }

  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.redirect(
      new URL(`/login?error=missing_env&next=${encodeURIComponent(next)}`, url.origin),
    );
  }

  const res = NextResponse.redirect(new URL(next, url.origin));

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=exchange_failed&next=${encodeURIComponent(next)}`, url.origin),
    );
  }

  return res;
}