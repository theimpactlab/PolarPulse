# Supabase Edge Functions

These functions should be deployed to Supabase Edge Functions.
They use Deno runtime and won't pass local TypeScript checks.

## Deploying

1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link project: `supabase link --project-ref YOUR_PROJECT_REF`
4. Deploy: `supabase functions deploy polar-callback`
5. Deploy: `supabase functions deploy sync-polar`

## Environment Variables

Set these in Supabase Dashboard > Edge Functions > Secrets:

```
POLAR_CLIENT_ID=your_polar_client_id
POLAR_CLIENT_SECRET=your_polar_client_secret
APP_URL=exp://your-app-url or https://your-app.com
```

## polar-callback

Handles OAuth callback from Polar. See `polar-callback.ts` for source.

## sync-polar

Syncs exercise and sleep data from Polar. See `sync-polar.ts` for source.
Can be triggered via cron or manually from the app.
