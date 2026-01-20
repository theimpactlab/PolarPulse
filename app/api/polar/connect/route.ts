import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function sanitizeNext(nextRaw: string | null): string {
  const fallback = "/app/dashboard";
  if (!nextRaw) return fallback;

  const n = nextRaw.trim();

  // Must be a relative path
  if (!n.startsWith("/")) return fallback;

  // Restrict to /app to avoid open redirects
  if (!n.startsWith("/app")) return fallback;

  return n;
}

function hmacBase64Url(secret: string, message: string): string {
  return crypto.createHmac("sha256", secret).update(message).digest("base64url");
}

export async function GET(req: Request) {
  const POLAR_AUTHORIZE_URL = getEnv("POLAR_AUTHORIZE_URL"); // e.g. https://flow.polar.com/oauth2/authorization
  const POLAR_CLIENT_ID = getEnv("POLAR_CLIENT_ID");
  const OAUTH_STATE_SECRET = getEnv("OAUTH_STATE_SECRET");
  const SUPABASE_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");

  const cookieStore = cookies();

  // Supabase SSR client (reads auth cookies)
  const supabase = createServerClient(
    SUPABASE_URL,
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // no-op here
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.id) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", "/app/profile");
    return NextResponse.redirect(url);
  }

  const { searchParams } = new URL(req.url);
  const next = sanitizeNext(searchParams.get("next"));

  // IMPORTANT:
  // We sign over uid|nextRaw where nextRaw is URL-encoded (stable and reversible)
  const uid = data.user.id;
  const nextRaw = encodeURIComponent(next);

  const msg = `${uid}|${nextRaw}`;
  const sig = hmacBase64Url(OAUTH_STATE_SECRET, msg);
  const state = `${uid}|${nextRaw}|${sig}`;

  // redirect_uri must be the Edge Function URL registered with Polar
  const redirectUri = `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/polar-oauth-callback`;

  const url = new URL(POLAR_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", POLAR_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}