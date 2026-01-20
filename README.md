# PolarPulse

A web rebuild of the PolarPulse mobile experience using:

- Next.js (App Router) deployed on Vercel
- Supabase (Auth, Postgres, RLS, Edge Functions)
- Tailwind CSS
- Recharts (graphs)

## Repo layout

- `app/` Next.js routes (App Router)
- `src/` shared libs + UI components
- `supabase/` migrations + Edge Functions (Deno)

## Prerequisites

- Node.js 18+ (or 20+ recommended)
- Supabase project created (URL + anon key)
- Supabase CLI installed (for deploying functions/migrations)

## Local setup

1) Install dependencies

```bash
npm install



2.	Create .env.local

Copy from .env.example and fill values:

cp .env.example .env.local

	3.	Run the dev server

	npm run dev


Open http://localhost:3000


Environment variables

These are required for the Next.js app:

Public:
	•	NEXT_PUBLIC_SUPABASE_URL
	•	NEXT_PUBLIC_SUPABASE_ANON_KEY
	•	NEXT_PUBLIC_APP_URL

Server-only:
	•	POLAR_AUTHORIZE_URL
	•	POLAR_CLIENT_ID
	•	OAUTH_STATE_SECRET

Supabase Edge Functions require their own secrets (set in Supabase dashboard or via CLI):
	•	SUPABASE_URL
	•	SUPABASE_SERVICE_ROLE_KEY
	•	POLAR_CLIENT_ID
	•	POLAR_CLIENT_SECRET
	•	POLAR_OAUTH_TOKEN_URL
	•	APP_WEB_URL
	•	OAUTH_STATE_SECRET
	•	(optional) SYNC_SECRET, INITIAL_SYNC, INITIAL_SYNC_LOOKBACK_DAYS

OAuth flow summary
	1.	User clicks Connect Polar on /app/profile
	2.	Next.js API route /api/polar/connect redirects to Polar authorize URL
	3.	Polar redirects to Supabase Edge Function polar-oauth-callback
	4.	Edge function stores tokens in polar_connections and redirects to /polar-callback
	5.	/polar-callback shows a brief status UI and forwards into /app/...

Deployment

Vercel
	•	Connect the GitHub repo
	•	Set the env vars from .env.example in Vercel Project Settings
	•	Deploy

Supabase

Edge Functions and migrations are deployed to Supabase, not Vercel.

Typical workflow:
	•	Apply migrations (schema + RLS)
	•	Deploy Edge Functions

If you add a GitHub Action later, you can auto-deploy functions and migrations on push to main.

Useful scripts

npm run dev
npm run build
npm run start
npm run lint

Notes

This project provides a scaffold (Dashboard, Sleep, Activity, Profile) wired to Supabase.
You can refine styling and chart behavior to match the original app screenshots.

