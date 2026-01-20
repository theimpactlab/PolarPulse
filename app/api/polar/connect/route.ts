import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function isSafeNext(nextRaw: string | null): string {
  // only allow internal /app routes
  if (!nextRaw) return "/app/dashboard";
  const n = nextRaw.trim();
  if (!n.startsWith("/")) return "/app/dashboard";
  if (!n.startsWith("/app")) return "/app/dashboard";
  return n;
}

function base64UrlEncode(bytes: Uint8Array): string {
  const b64 = Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256(secret: string, message: string): Promise<string> {
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

  const nextPath = isSafeNext(url.searchParams.get("next"));

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const POLAR_CLIENT_ID = process.env.POLAR_CLIENT_ID || "";
  const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || "";

  if (!SUPABASE_URL || !SUPABASE_ANON || !POLAR_CLIENT_ID || !OAUTH_STATE_SECRET) {
    const fail = new URL("/app/profile", url.origin);
    fail.searchParams.set("error", "missing_env");
    return NextResponse.redirect(fail);
  }

  // Supabase Edge Function callback (this is what you registered with Polar)
  const polarRedirectUri = `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/polar-oauth-callback`;

  // Read the signed-in user from cookies
  const cookieStore = await cookies();
  const res = NextResponse.next();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(_cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        // no-op in this route (we’re only reading auth)
      }
    },
  });

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (!user) {
    const login = new URL("/login", url.origin);
    login.searchParams.set("next", nextPath);
    return NextResponse.redirect(login);
  }

  // Build signed state payload that your Supabase Edge Function expects:
  // state = base64url(JSON payload) + "." + HMAC(payloadB64)
  const payloadObj = {
    uid: user.id,
    redir: `/polar-callback?next=${encodeURIComponent(nextPath)}`,
    iat: Math.floor(Date.now() / 1000),
  };

  const payloadJson = JSON.stringify(payloadObj);
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payloadJson));
  const sig = await hmacSha256(OAUTH_STATE_SECRET, payloadB64);
  const state = `${payloadB64}.${sig}`;

  // Build Polar authorize URL
  // Polar AccessLink uses accesslink.read_all scope (if omitted, Polar may ask for all scopes linked to the client)
  // Authorization endpoint: https://flow.polar.com/oauth2/authorization  [oai_citation:1‡Polar](https://www.polar.com/accesslink-api/?srsltid=AfmBOooye7FUojTa5_HA7Se8phM_sta7uE7YvffP2KPsRHU-KC-yRPNL)
  const authUrl = new URL("https://flow.polar.com/oauth2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", POLAR_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", polarRedirectUri);
  authUrl.searchParams.set("scope", "accesslink.read_all");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}