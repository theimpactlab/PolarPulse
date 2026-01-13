# Polar Fitness Tracker

A Whoop-style fitness tracking app that connects to Polar AccessLink and Apple Health to display Recovery, Strain, and Sleep scores with trend analysis.

## Platforms

- **iOS/Android**: Native mobile app via Expo
- **Web**: Progressive Web App optimized for mobile browsers (iOS Safari, Chrome)

### Web Features
- Mobile-first responsive design
- iOS-like phone frame on desktop browsers
- PWA support - add to home screen for app-like experience
- Works on any device with a modern browser

## Features

### Core Features
- **Recovery Score (0-100)**: Based on HRV, resting heart rate, sleep quality, and prior day strain
- **Strain Score (0-21)**: TRIMP-based training load calculation from heart rate zones
- **Sleep Score (0-100)**: Duration vs goal, consistency, and sleep disturbances
- **Trend Charts**: 7, 30, and 90-day views for all metrics
- **Demo Mode**: Try the app with realistic mock data before connecting data sources
- **Dark UI**: Clean, card-based design inspired by Whoop

### Advanced Health Metrics
- **Body Battery (0-100)**: Energy reserve indicator showing how your body is recovering and expending energy throughout the day
- **VO2 Max Estimate**: Aerobic fitness indicator with percentile ranking and trend tracking
- **Training Load**: 7-day acute vs 28-day chronic load comparison with status indicators (detraining, recovery, maintaining, productive, peaking, overreaching)
- **Training Readiness (0-100)**: Daily readiness score based on recovery and sleep, with workout recommendations
- **Sleep Debt**: Accumulated sleep deficit over 7 days with recovery recommendations
- **Body Temperature Trends**: Deviation from baseline tracking for illness/stress detection

### Data Sources
- **Apple Health** (iOS): Workouts, sleep, HRV, resting heart rate
- **Polar Flow**: Direct sync via AccessLink API

### All Features Included
- 365 days of history
- 7, 30, and 90-day trend charts
- Baseline comparisons
- Premium insights
- Data export (CSV)
- Unlimited workouts visible

## Tech Stack

**Frontend:**
- React Native / Expo SDK 53
- Expo Router (file-based routing)
- NativeWind / Tailwind CSS
- Zustand (local state)
- react-native-reanimated (animations)
- react-native-svg (charts)

**Backend:**
- Supabase (PostgreSQL + Auth + Edge Functions)
- Polar AccessLink API
- Apple HealthKit (via react-native-health)
- Row Level Security (RLS)

## Deployment Guide for Web (Vercel + Supabase)

### Step 1: Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Set the following environment variables in Vercel:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Deploy - Vercel will auto-detect Expo and build the web version
5. Note your Vercel URL (e.g., `https://your-app.vercel.app`)

**Important:** The `vercel.json` file configures client-side routing. All routes (like `/polar-callback`) are handled by the React app, not as separate pages.

### Step 2: Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration from `supabase/migrations/001_initial_schema.sql`
3. Go to **Settings** → **API** and copy:
   - Project URL
   - anon public key
4. Add these to your Vercel environment variables

### Step 3: Register with Polar AccessLink

1. Go to [admin.polaraccesslink.com](https://admin.polaraccesslink.com)
2. Sign in with your Polar account
3. Click "Create New Client"
4. Fill in:
   - **Application Name**: Your app name
   - **OAuth2 Callback URL**: `https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/polar-callback`
5. Save your **Client ID** and **Client Secret**

### Step 4: Configure Supabase Secrets

1. Go to **Edge Functions** → **Secrets** in Supabase dashboard
2. Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `POLAR_CLIENT_ID` | Your Polar client ID |
| `POLAR_CLIENT_SECRET` | Your Polar client secret |
| `APP_URL` | Your Vercel URL (e.g., `https://your-app.vercel.app`) |

### Step 5: Deploy Edge Functions

Install Supabase CLI and deploy the functions:

```bash
# Install CLI
npm install -g supabase

# Login and link
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Create function directories and copy code
mkdir -p supabase/functions/polar-auth
mkdir -p supabase/functions/polar-callback
mkdir -p supabase/functions/sync-polar

# Copy the code from edge-functions-deploy/ to each function's index.ts
# (Remove the /* */ comment wrappers)

# Deploy
supabase functions deploy polar-auth
supabase functions deploy polar-callback
supabase functions deploy sync-polar
```

### Step 6: Test the Flow

1. Open your Vercel deployment
2. Create an account or sign in
3. Go to Settings → Connect Polar Flow
4. You should be redirected to Polar's login
5. After authorization, you'll return to your app with Polar connected

## Troubleshooting

### OAuth Redirect Issues
- Ensure the callback URL in Polar admin matches exactly: `https://YOUR_PROJECT.supabase.co/functions/v1/polar-callback`
- Check that all secrets are set in Supabase

### CORS Errors on Web
- The edge functions include CORS headers
- If issues persist, check the Edge Functions logs in Supabase

### Token Exchange Fails
- Verify `POLAR_CLIENT_ID` and `POLAR_CLIENT_SECRET` are correct
- Check the Edge Functions logs for detailed errors

## Project Structure

```
src/
├── app/                      # Expo Router screens
│   ├── (tabs)/
│   │   ├── _layout.tsx       # Tab navigation
│   │   ├── index.tsx         # Today dashboard
│   │   ├── fitness.tsx       # Workouts & strain
│   │   ├── recovery.tsx      # HRV, RHR, recovery
│   │   ├── sleep.tsx         # Sleep analysis
│   │   └── settings.tsx      # Account & preferences
│   ├── login.tsx             # Sign in
│   ├── signup.tsx            # Create account
│   ├── forgot-password.tsx   # Password reset
│   ├── upgrade.tsx           # Premium paywall
│   └── _layout.tsx           # Root layout
├── components/
│   ├── ScoreRing.tsx         # Animated circular progress
│   ├── TrendChart.tsx        # SVG line chart
│   ├── BodyBatteryCard.tsx   # Body battery gauge with animation
│   ├── VO2MaxCard.tsx        # VO2 max with fitness percentile
│   ├── TrainingLoadCard.tsx  # Acute vs chronic load comparison
│   ├── TrainingReadinessCard.tsx # Readiness score with contributors
│   ├── SleepDebtCard.tsx     # Sleep debt with recommendations
│   └── BodyTempCard.tsx      # Body temperature deviation
└── lib/
    ├── state/
    │   ├── app-store.ts      # Fitness data (Zustand)
    │   └── auth-store.ts     # Auth & subscription (Zustand)
    ├── supabase/
    │   └── client.ts         # Supabase REST client
    └── utils/
        ├── format.ts         # Date/time formatters
        ├── mock-data.ts      # Demo data generator
        └── scoring.ts        # Score algorithms

supabase/
├── migrations/
│   └── 001_initial_schema.sql  # Database schema
└── edge-functions-deploy/
    ├── README.md               # Deployment instructions
    ├── polar-callback.ts       # OAuth callback handler
    └── sync-polar.ts           # Data sync function
```

## Supabase Setup

For detailed backend setup instructions, see **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)**.

### Quick Start

1. Create a project at [supabase.com](https://supabase.com)
2. Run the database migration from `supabase/migrations/001_initial_schema.sql`
3. Register your app at [admin.polaraccesslink.com](https://admin.polaraccesslink.com)
4. Deploy the edge functions from `supabase/edge-functions-deploy/`
5. Add your Supabase URL and anon key to your environment

### Environment Variables

Add these to your `.env` file or the Vibecode ENV tab:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Polar AccessLink Setup

1. Register at [polaraccesslink.polar.com](https://www.polaraccesslink.polar.com)
2. Create a new client application
3. Set OAuth callback URL to your Supabase function URL:
   `https://YOUR_PROJECT.supabase.co/functions/v1/polar-callback`
4. Copy client ID and secret to Supabase secrets

## Scoring Algorithms

### Recovery Score (0-100)
Weighted combination:
- **HRV vs Baseline (40%)**: Higher HRV = better recovery
- **Resting HR vs Baseline (20%)**: Lower RHR = better recovery
- **Sleep Quality (30%)**: Previous night's sleep score
- **Prior Day Strain (10%)**: Lower strain = better recovery

### Strain Score (0-21)
TRIMP-based calculation using heart rate zones:
- Zone 1 (50-60% max HR): 1x multiplier
- Zone 2 (60-70%): 2x multiplier
- Zone 3 (70-80%): 3x multiplier
- Zone 4 (80-90%): 4x multiplier
- Zone 5 (90-100%): 5x multiplier

### Sleep Score (0-100)
- **Duration vs Need (50%)**: Hours slept vs goal
- **Consistency (30%)**: Bedtime/waketime regularity
- **Disturbances (20%)**: Awake time during sleep

## Database Schema

Key tables:
- `profiles` - User accounts with subscription tier
- `oauth_tokens` - Polar OAuth tokens
- `workouts` - Exercise sessions with HR zones
- `sleep_sessions` - Sleep records with stages
- `daily_metrics` - Computed daily scores
- `baselines` - 30-day rolling averages
- `insights` - Auto-generated recommendations

All tables have Row Level Security enabled - users can only access their own data.

## Demo Mode

Try the app without creating an account:
1. Open the app
2. Tap "Continue without account (Demo)" on login
3. Go to Today tab and tap "Try Demo Mode"
4. Explore 30 days of realistic mock data

## License

Private project - All rights reserved
