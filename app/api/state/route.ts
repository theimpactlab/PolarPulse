// Next.js helper to generate a signed Polar OAuth `state`
//
// Recommended: generate state server-side (Route Handler) so the HMAC secret
// never ships to the browser.
//
// This example provides:
// 1) /api/polar/state  -> returns { state } for the logged-in user
// 2) /api/polar/connect -> returns { url } full Polar authorization URL
//
// You will need to:
// - decide your Polar authorize URL (POLAR_AUTHORIZE_URL)
// - set POLAR_REDIRECT_URI to your Supabase function callback URL
// - include the user's Supabase JWT when calling these endpoints from the client

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

// -----------------------------
// env
// -----------------------------
function env(name: string, required = true): string {
  const v = process.env[name];
  if (!v && required) throw new Error(`Missing env var: ${name}`);
  return v ?? "";
}

// -----------------------------
// base64url helpers
// -----------------------------
function base64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function hmacSha256Base64url(secret: string, message: string) {
  const h = crypto.createHmac("sha256", secret);
  h.update(message, "utf8");
  return base64url(h.digest());
}

// -----------------------------
// auth: get Supabase user id from JWT
// -----------------------------
// You can do this by:
// - calling Supabase "getUser" server-side using supabase-js, OR
// - decoding JWT and validating it properly.
//
// For simplicity, here we call Supabase Admin "getUser" via supabase-js.
// This keeps logic correct and avoids homemade JWT verification.

import { createClient } from "@supabase/supabase-js";

async function getUserIdFromBearer(req: NextRequest): Promise<string> {
  const auth = req.headers.get("authorization") ?? "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!jwt) throw new Error("Missing Authorization bearer token");

  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) throw new Error("Invalid user token");
  return data.user.id;
}

// -----------------------------
// build state
// -----------------------------
function buildState(opts: { uid: string; redir: string; iat: number; secret: string }) {
  const payload = JSON.stringify({ uid: opts.uid, redir: opts.redir, iat: opts.iat });
  const payloadB64 = base64url(payload);
  const sig = hmacSha256Base64url(opts.secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

// -----------------------------
// 1) Route: /api/polar/state
// -----------------------------
// Returns { state } for the logged-in user
export async function GET(req: NextRequest) {
  try {
    const uid = await getUserIdFromBearer(req);

    const secret = env("OAUTH_STATE_SECRET");
    const appUrl = env("NEXT_PUBLIC_APP_URL"); // e.g. https://polar-pulse.vercel.app
    const redir = new URL("/polar-callback?polar=connected", appUrl).toString();

    const iat = Math.floor(Date.now() / 1000);
    const state = buildState({ uid, redir, iat, secret });

    return NextResponse.json({ ok: true, state });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 400 });
  }
}

