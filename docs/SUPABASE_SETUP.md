# Supabase Backend Setup Guide

This guide will help you set up the Supabase backend for your Polar Fitness Tracker app.

## Overview

The backend handles:
- User authentication (email/password, Apple, Google)
- Polar OAuth flow (secure token exchange)
- Data sync from Polar AccessLink API
- Storage of workouts, sleep, and daily metrics

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/log in
2. Click "New Project"
3. Choose your organization
4. Enter a project name (e.g., "polar-fitness-tracker")
5. Set a strong database password (save this!)
6. Select a region close to your users
7. Click "Create new project"

Wait for the project to be provisioned (1-2 minutes).

## Step 2: Get Your Project Credentials

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://abc123.supabase.co`)
   - **anon public** key (the long string)

Add these to your app's environment:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 3: Set Up the Database

1. Go to **SQL Editor** in your Supabase dashboard
2. Click "New query"
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste into the SQL Editor
5. Click "Run" to execute

This creates all the necessary tables with Row Level Security (RLS) policies.

## Step 4: Register with Polar AccessLink

1. Go to [admin.polaraccesslink.com](https://admin.polaraccesslink.com)
2. Sign in with your Polar account
3. Click "Create New Client"
4. Fill in:
   - **Application Name**: Your app name
   - **Description**: Brief description of your app
   - **OAuth2 Callback URL**: `https://YOUR_PROJECT.supabase.co/functions/v1/polar-callback`
     (Replace `YOUR_PROJECT` with your Supabase project ID)
5. Save your:
   - **Client ID**
   - **Client Secret**

## Step 5: Configure Supabase Secrets

1. Go to **Edge Functions** → **Secrets** in Supabase dashboard
2. Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `POLAR_CLIENT_ID` | Your Polar client ID from Step 4 |
| `POLAR_CLIENT_SECRET` | Your Polar client secret from Step 4 |
| `APP_URL` | Your app's deep link URL (e.g., `polarfitness://`) |

## Step 6: Deploy Edge Functions

You need to deploy three edge functions. You can do this via the Supabase CLI:

### Install Supabase CLI

```bash
npm install -g supabase
```

### Login and Link Project

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

(Find your project ref in Settings → General)

### Deploy Functions

Create these function files in `supabase/functions/`:

**1. polar-auth/index.ts** (initiates OAuth)
```typescript
// Copy from supabase/edge-functions-deploy/polar-auth.ts
```

**2. polar-callback/index.ts** (handles OAuth callback)
```typescript
// Copy from supabase/edge-functions-deploy/polar-callback.ts
```

**3. sync-polar/index.ts** (syncs Polar data)
```typescript
// Copy from supabase/edge-functions-deploy/sync-polar.ts
```

Deploy each function:
```bash
supabase functions deploy polar-auth
supabase functions deploy polar-callback
supabase functions deploy sync-polar
```

## Step 7: Configure Authentication (Optional)

For Apple/Google Sign-In:

1. Go to **Authentication** → **Providers**
2. Enable desired providers
3. Follow Supabase's guide for each provider

## Step 8: Test the Connection

1. Open your app
2. Sign in or create an account
3. Go to Settings
4. Tap "Connect" next to Polar Flow
5. You should be redirected to Polar's login page
6. Authorize the app
7. You'll be redirected back to the app with Polar connected

## Troubleshooting

### "Backend not configured" error
- Make sure `EXPO_PUBLIC_SUPABASE_URL` is set in your environment

### OAuth redirect fails
- Check that the callback URL in Polar matches exactly: `https://YOUR_PROJECT.supabase.co/functions/v1/polar-callback`
- Make sure the edge functions are deployed

### Sync not working
- Check the Edge Functions logs in Supabase dashboard
- Verify the secrets are set correctly
- Make sure the user has authorized the app with Polar

### Token refresh errors
- The `POLAR_CLIENT_SECRET` might be incorrect
- Try disconnecting and reconnecting Polar

## Database Schema

The migration creates these tables:

- **profiles** - User accounts with Polar connection status
- **oauth_tokens** - Securely stored Polar OAuth tokens
- **workouts** - Exercise sessions with HR zones
- **sleep_sessions** - Sleep records with stages
- **daily_metrics** - Computed daily scores (recovery, strain, sleep)
- **baselines** - 30-day rolling averages for comparisons
- **sync_log** - Track sync history and errors

All tables have Row Level Security - users can only access their own data.

## Automatic Sync (Optional)

To sync data automatically, set up a cron job:

1. Go to **Database** → **Extensions**
2. Enable `pg_cron`
3. Run this SQL:

```sql
SELECT cron.schedule(
  'sync-polar-data',
  '0 */6 * * *', -- Every 6 hours
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/sync-polar',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

This will sync all connected users' data every 6 hours.
