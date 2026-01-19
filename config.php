<?php
// config.php

// DATABASE
define('DB_HOST', 'localhost');
define('DB_NAME', 'PolarPulse');
define('DB_USER', 'admin');
define('DB_PASS', 'Progre5587!');

// POLAR OAUTH
define('POLAR_CLIENT_ID', 'be76d111-785a-484a-97fe-b4afe928c9b5');
define('POLAR_CLIENT_SECRET', '70478e16-cba3-46fd-a6b3-2a99fadec87f');

// IMPORTANT: must match what you configured in Polar
define('POLAR_REDIRECT_URI', 'https://impctlab.uk/PolarPulse/callback.php');

// Simple page access protection (optional but recommended)
define('DASH_USER', 'admin');
define('DASH_PASS', 'Progre5587!');

// API base
define('POLAR_TOKEN_URL', 'https://polarremote.com/v2/oauth2/token');
define('POLAR_AUTH_URL', 'https://flow.polar.com/oauth2/authorization');
define('POLAR_API_BASE', 'https://www.polaraccesslink.com');

// Sync web secrets (used for manual sync runs)
define('SYNC_WEB_SECRET', 'PUT_A_LONG_RANDOM_STRING_HERE');
define('DAILY_WEB_SECRET', 'PUT_ANOTHER_LONG_RANDOM_STRING_HERE');