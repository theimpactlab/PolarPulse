// Supabase Edge Function: polar-oauth-callback
// Deploy: supabase functions deploy polar-oauth-callback
//
// State format (recommended)
//   state = "<uid>|<nextPath>|<sig>"
//   sig = HMAC_SHA256_BASE64URL(OAUTH_STATE_SECRET, "<uid>|<nextPath>")
//
// nextPath examples:
//   /app/dashboard
//   /app/profile
//
// SECURITY
// - uid is trusted only if signature verifies
// - nextPath is constrained to a relative path to prevent open redirects

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

function getEnv(name: string, required = true): string {
  const v = Deno.env.get(name);
  if (!v && required) throw new Error(`Missing env var: ${name}`);
  return v ?? "";
}

function base64UrlEncode(bytes: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...bytes));
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

async function verifyHmac(secret: string, message: string, sigB64Url: string): Promise<boolean> {
  const expected = await hmacSha256(secret, message);
  if (expected.length !== sigB64Url.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sigB64Url.charCodeAt(i);
  return diff === 0;
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function sanitizeNextPath(nextPathRaw: string): string {
  // Prevent open redirects. Only allow relative paths beginning with "/".
  const p = nextPathRaw.trim();
  if (!p.startsWith("/")) return "/app/dashboard";
  // Optional: restrict to /app only
  if (!p.startsWith("/app")) return "/app/dashboard";
  return p;
}

function redirect(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: url },
  });
}

function appendQuery(url: string, params: Record<string, string>): string {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

async function exchangeCodeForTokens(opts: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<any> {
  const basic = btoa(`${opts.clientId}:${opts.clientSecret}`);
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", opts.code);
  body.set("redirect_uri", opts.redirectUri);

  const res = await fetch(opts.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${text.slice(0, 400)}`);
  if (!json?.access_token || !json?.refresh_token) {
    throw new Error(`Token exchange did not return tokens: ${text.slice(0, 400)}`);
  }
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const defaultSuccessPath = "/polar-callback?polar=connected";
  const defaultFailPath = "/polar-callback?polar=error";

  try {
    const SUPABASE_URL = getEnv("SUPABASE_URL");
    const SERVICE_ROLE = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const POLAR_CLIENT_ID = getEnv("POLAR_CLIENT_ID");
    const POLAR_CLIENT_SECRET = getEnv("POLAR_CLIENT_SECRET");
    const POLAR_OAUTH_TOKEN_URL = getEnv("POLAR_OAUTH_TOKEN_URL");
    const APP_WEB_URL = getEnv("APP_WEB_URL");
    const OAUTH_STATE_SECRET = getEnv("OAUTH_STATE_SECRET");

    const INITIAL_SYNC = (Deno.env.get("INITIAL_SYNC") ?? "true").toLowerCase() === "true";
    const LOOKBACK_DAYS = Number(Deno.env.get("INITIAL_SYNC_LOOKBACK_DAYS") ?? "30");
    const SYNC_SECRET = Deno.env.get("SYNC_SECRET") ?? "";
    const SYNC_POLAR_FUNCTION_URL =
      Deno.env.get("SYNC_POLAR_FUNCTION_URL") ??
      `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/sync-polar`;

    const url = new URL(req.url);
    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const errorParam = url.searchParams.get("error");
    const errorDesc = url.searchParams.get("error_description");

    if (errorParam) {
      const failUrl = appendQuery(new URL(defaultFailPath, APP_WEB_URL).toString(), {
        reason: errorParam,
        message: errorDesc ?? "",
      });
      return redirect(failUrl);
    }

    if (!code || !state) {
      const failUrl = appendQuery(new URL(defaultFailPath, APP_WEB_URL).toString(), {
        reason: "missing_code_or_state",
      });
      return redirect(failUrl);
    }

    // Parse: uid|next|sig
    const parts = state.split("|");
    if (parts.length !== 3) {
      const failUrl = appendQuery(new URL(defaultFailPath, APP_WEB_URL).toString(), {
        reason: "invalid_state_format",
      });
      return redirect(failUrl);
    }

    const [uidRaw, nextRaw, sig] = parts;
    const uid = uidRaw.trim();
    const nextPath = sanitizeNextPath(decodeURIComponent(nextRaw));

    if (!isUuid(uid)) {
      const failUrl = appendQuery(new URL(defaultFailPath, APP_WEB_URL).toString(), {
        reason: "invalid_uid",
      });
      return redirect(failUrl);
    }

    const msg = `${uid}|${nextRaw}`;
    const okSig = await verifyHmac(OAUTH_STATE_SECRET, msg, sig);
    if (!okSig) {
      const failUrl = appendQuery(new URL(defaultFailPath, APP_WEB_URL).toString(), {
        reason: "invalid_state_signature",
      });
      return redirect(failUrl);
    }

    const userId = uid;
    const successUrlBase = new URL(defaultSuccessPath, APP_WEB_URL).toString();
    const successUrl = appendQuery(successUrlBase, { connected: "true", next: nextPath });

    // Token exchange: redirect_uri must match what you used in /api/polar/connect
    const redirectUri = `${SUPABASE_URL.replace(/\/+$/, "")}/functions/v1/polar-oauth-callback`;

    const tokenJson = await exchangeCodeForTokens({
      tokenUrl: POLAR_OAUTH_TOKEN_URL,
      clientId: POLAR_CLIENT_ID,
      clientSecret: POLAR_CLIENT_SECRET,
      code,
      redirectUri,
    });

    const accessToken = tokenJson.access_token as string;
    const refreshToken = tokenJson.refresh_token as string;
    const expiresIn = typeof tokenJson.expires_in === "number" ? tokenJson.expires_in : null;
    const scope = tokenJson.scope ?? null;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { error: upErr } = await supabaseAdmin
      .from("polar_connections")
      .upsert(
        {
          user_id: userId,
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt ? expiresAt.toISOString() : null,
          scope,
          connected_at: new Date().toISOString(),
          last_synced_at: null,
        },
        { onConflict: "user_id" },
      );
    if (upErr) throw upErr;

    if (INITIAL_SYNC) {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();
      try {
        await fetch(SYNC_POLAR_FUNCTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(SYNC_SECRET ? { "x-sync-secret": SYNC_SECRET } : {}),
          },
          body: JSON.stringify({ userId, since }),
        });
      } catch {
        // ignore initial sync errors
      }
    }

    // Redirect to web app (you can handle next param on /polar-callback)
    return redirect(successUrl);
  } catch (e) {
    const APP_WEB_URL = Deno.env.get("APP_WEB_URL") ?? "";
    const failBase = APP_WEB_URL
      ? new URL(defaultFailPath, APP_WEB_URL).toString()
      : defaultFailPath;

    const failUrl = appendQuery(failBase, {
      reason: "exception",
      message: (e as Error)?.message ?? String(e),
    });
    return redirect(failUrl);
  }
});