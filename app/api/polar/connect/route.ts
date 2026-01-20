import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options?: any };

function safeNext(nextRaw: string | null): string {
  if (!nextRaw) return "/app/dashboard";
  const n = nextRaw.trim();
  if (!n.startsWith("/")) return "/app/dashboard";
  if (!n.startsWith("/app")) return "/app/dashboard";
  return n;
}

// base64url (no padding) helpers that match the edge function
function base64UrlEncode(bytes: Uint8Array): string {
  const b64 = Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256B64Url(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const nextPath = safeNext(url.searchParams.get("next"));

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const POLAR_CLIENT_ID = process.env.POLAR_CLIENT_ID || "";
  const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || "";

  if (!SUPABASE_URL || !SUPABASE_ANON || !POLAR_CLIENT_ID || !OAUTH_STATE_SECRET) {
    const fail = new URL("/app/profile", url.origin);
    fail.searchParams.set("error", "missing_env");
    return NextResponse.redirect(fail);
  }

  // Read logged-in user from cookies
  const cookieStore = await cookies();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(_cookiesToSet: CookieToSet[]) {
        // no-op (read-only)
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("next", nextPath);
    return NextResponse.redirect(login);
  }

  // Must match what polar-oauth-callback.parseState expects:
  // state = base64url(JSON) + "." + HMAC(base64url(JSON))
  const payload = {
    uid: user.id,
    redir: `/polar-callback?next=${encodeURIComponent(nextPath)}`,
    iat: Math.floor(Date.now() / 1000),
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payloadJson));
  const sig = await hmacSha256B64Url(OAUTH_STATE_SECRET, payloadB64);

  const state = `${payloadB64}.${sig}`;

  // Redirect URI must be the Supabase edge function URL Polar calls back to
  const redirectUri = `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/polar-oauth-callback`;

  // Build Polar authorization URL
  const authUrl = new URL("https://flow.polar.com/oauth2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", POLAR_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "accesslink.read_all");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}