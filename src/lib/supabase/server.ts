import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase may pass expires as string | Date.
// Next.js cookies().set expects expires: Date | number.
// We'll normalize here.
type CookieToSet = {
  name: string;
  value: string;
  options?: {
    path?: string;
    domain?: string;
    maxAge?: number;
    expires?: Date | string; // keep flexible for Supabase
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
  };
};

function normalizeCookieOptions(
  opts?: CookieToSet["options"],
): Partial<{
  path: string;
  domain: string;
  maxAge: number;
  expires: Date | number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
}> | undefined {
  if (!opts) return undefined;

  let expires: Date | number | undefined = undefined;

  if (opts.expires instanceof Date) {
    expires = opts.expires;
  } else if (typeof opts.expires === "string") {
    const d = new Date(opts.expires);
    if (Number.isFinite(d.getTime())) expires = d;
  }

  const out: any = {
    path: opts.path,
    domain: opts.domain,
    maxAge: opts.maxAge,
    expires,
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
  };

  // Remove undefined keys so Next doesn't get weird values
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

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
      setAll(cookiesToSet: CookieToSet[]) {
        // In Server Components, setting cookies may be ignored at runtime,
        // but types still must be valid for build.
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, normalizeCookieOptions(options));
          });
        } catch {
          // Ignore in Server Components; middleware/route handlers are the
          // correct place to reliably set cookies.
        }
      },
    },
  });
}