<?php
require_once __DIR__ . '/lib_polar.php';

require_basic_auth();
session_start();

$code = $_GET['code'] ?? '';
$state = $_GET['state'] ?? '';

if (!$code || !$state || !isset($_SESSION['polar_oauth_state']) || $_SESSION['polar_oauth_state'] !== $state) {
  echo "Invalid callback";
  exit;
}

list($nonce, $appUserKey) = explode('|', $state, 2);

$auth = base64_encode(POLAR_CLIENT_ID . ':' . POLAR_CLIENT_SECRET);
$body = http_build_query([
  'grant_type' => 'authorization_code',
  'code' => $code,
  'redirect_uri' => POLAR_REDIRECT_URI
]);

$resp = http_request('POST', POLAR_TOKEN_URL, [
  'Authorization: Basic ' . $auth,
  'Content-Type: application/x-www-form-urlencoded'
], $body);

if ($resp['status'] < 200 || $resp['status'] >= 300) {
  echo "Token exchange failed: HTTP " . $resp['status'] . "<br><pre>" . htmlspecialchars($resp['body']) . "</pre>";
  exit;
}

$data = json_decode($resp['body'], true);
$accessToken = $data['access_token'] ?? '';
$polarUserId = $data['x_user_id'] ?? ($data['user_id'] ?? '');

if (!$accessToken || !$polarUserId) {
  echo "Token response missing access_token or user id.<br><pre>" . htmlspecialchars($resp['body']) . "</pre>";
  exit;
}

// Register user in AccessLink (required for transactions)
$regBody = json_encode(['member-id' => $appUserKey]);
$reg = polar_bearer($accessToken, '/v3/users', 'POST', $regBody);

// If already registered, Polar may return 409. We still proceed.
if (!in_array($reg['status'], [200, 201, 204, 409], true)) {
  echo "User registration failed: HTTP " . $reg['status'] . "<br><pre>" . htmlspecialchars($reg['body']) . "</pre>";
  exit;
}

upsert_user($appUserKey, $polarUserId, $accessToken);

header('Location: /polar/index.php?polar=connected');
exit;