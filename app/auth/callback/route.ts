import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = {
  name: string;
  value: string;
  options?: any; // Supabase may send expires as string; we normalize below
};

function normalizeCookieOptions(opts?: any) {
  if (!opts) return undefined;

  // NextResponse cookies expect expires: Date | number (NOT string)
  let expires: Date | number | undefined = undefined;

  if (opts.expires instanceof Date) {
    expires = opts.expires;
  } else if (typeof opts.expires === "number") {
    expires = opts.expires;
  } else if (typeof opts.expires === "string") {
    const d = new Date(opts.expires);
    if (Number.isFinite(d.getTime())) expires = d;
  }

  const out: any = { ...opts, expires };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/app/dashboard";

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

  // IMPORTANT: create the redirect response first, then write cookies onto it
  const res = NextResponse.redirect(new URL(next, url.origin));

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, normalizeCookieOptions(options));
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