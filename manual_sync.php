<?php
require_once __DIR__ . '/lib_polar.php';
require_basic_auth();

session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo "Method Not Allowed";
  exit;
}

$token = $_POST['csrf'] ?? '';
if (!$token || !isset($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $token)) {
  http_response_code(400);
  echo "Bad Request";
  exit;
}

// Run sync.php internally without exposing the secret in the browser
ob_start();
$_GET['secret'] = defined('SYNC_WEB_SECRET') ? SYNC_WEB_SECRET : '';
include __DIR__ . '/sync.php';
$out = trim(ob_get_clean());

// Redirect back (show a tiny status in query string)
$ok = (stripos($out, 'OK') !== false);
header('Location: /PolarPulse/fitness.php?sync=' . ($ok ? 'ok' : 'fail'));
exit;