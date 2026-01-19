<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/lib_polar.php';

require_basic_auth();

// For now, single-user setup:
$appUserKey = 'admin';

$state = bin2hex(random_bytes(16)) . '|' . $appUserKey;

// Persist state in session
session_start();
$_SESSION['polar_oauth_state'] = $state;

$params = http_build_query([
  'response_type' => 'code',
  'client_id' => POLAR_CLIENT_ID,
  'redirect_uri' => POLAR_REDIRECT_URI,
  'state' => $state
]);

header('Location: ' . POLAR_AUTH_URL . '?' . $params);
exit;