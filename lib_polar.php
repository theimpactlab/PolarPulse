<?php
// lib_polar.php
require_once __DIR__ . '/config.php';

function db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;

  $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
  $pdo = new PDO($dsn, DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
  ]);
  return $pdo;
}

function log_sync(string $level, string $message, ?string $polarUserId = null): void {
  $stmt = db()->prepare("INSERT INTO polar_sync_log (polar_user_id, level, message) VALUES (?,?,?)");
  $stmt->execute([$polarUserId, $level, $message]);
}

function require_basic_auth(): void {
  if (!isset($_SERVER['PHP_AUTH_USER'])) {
    header('WWW-Authenticate: Basic realm="Polar Dashboard"');
    header('HTTP/1.0 401 Unauthorized');
    echo "Auth required";
    exit;
  }
  if ($_SERVER['PHP_AUTH_USER'] !== DASH_USER || $_SERVER['PHP_AUTH_PW'] !== DASH_PASS) {
    header('HTTP/1.0 403 Forbidden');
    echo "Forbidden";
    exit;
  }
}

function http_request(string $method, string $url, array $headers = [], $body = null): array {
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
  curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
  curl_setopt($ch, CURLOPT_TIMEOUT, 30);

  if ($body !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
  }

  $respBody = curl_exec($ch);
  $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);

  if ($respBody === false) {
    $err = curl_error($ch);
    curl_close($ch);
    return ['status' => 0, 'body' => '', 'error' => $err];
  }

  curl_close($ch);
  return ['status' => $status, 'body' => $respBody, 'error' => null];
}

function polar_bearer(string $accessToken, string $path, string $method = 'GET', $body = null): array {
  $url = POLAR_API_BASE . $path;
  $headers = [
    'Authorization: Bearer ' . $accessToken,
    'Accept: application/json'
  ];
  if ($body !== null) $headers[] = 'Content-Type: application/json';
  return http_request($method, $url, $headers, $body);
}

function polar_basic(string $path, string $method = 'GET', $body = null): array {
  $url = POLAR_API_BASE . $path;
  $auth = base64_encode(POLAR_CLIENT_ID . ':' . POLAR_CLIENT_SECRET);
  $headers = [
    'Authorization: Basic ' . $auth,
    'Accept: application/json'
  ];
  if ($body !== null) $headers[] = 'Content-Type: application/json';
  return http_request($method, $url, $headers, $body);
}

function upsert_user(string $appUserKey, string $polarUserId, string $accessToken): void {
  $sql = "
    INSERT INTO polar_users (app_user_key, polar_user_id, access_token)
    VALUES (?,?,?)
    ON DUPLICATE KEY UPDATE
      polar_user_id = VALUES(polar_user_id),
      access_token = VALUES(access_token),
      is_active = 1
  ";
  db()->prepare($sql)->execute([$appUserKey, $polarUserId, $accessToken]);
}

function get_active_users(): array {
  return db()->query("SELECT * FROM polar_users WHERE is_active = 1")->fetchAll();
}

function upsert_raw(
  string $polarUserId,
  string $dataType,
  ?string $objectId,
  ?string $objectDate,
  string $endpoint,
  array $payload,
  ?string $sourceVersion = "v3"
): void {
  $sql = "
    INSERT INTO polar_raw_objects
      (polar_user_id, data_type, object_id, object_date, source_endpoint, source_version, payload_json)
    VALUES (?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      source_endpoint = VALUES(source_endpoint),
      source_version = VALUES(source_version),
      payload_json = VALUES(payload_json)
  ";
  db()->prepare($sql)->execute([
    $polarUserId,
    $dataType,
    $objectId,
    $objectDate,
    $endpoint,
    $sourceVersion,
    json_encode($payload),
  ]);
}

function json_decode_assoc(string $s): ?array {
  $d = json_decode($s, true);
  return is_array($d) ? $d : null;
}

function iso_to_date(?string $iso): ?string {
  if (!$iso) return null;
  $ts = strtotime($iso);
  if ($ts === false) return null;
  return date('Y-m-d', $ts);
}

function iso_to_mysql_datetime(?string $iso): ?string {
  if (!$iso) return null;
  $ts = strtotime($iso);
  if ($ts === false) return null;
  return date('Y-m-d H:i:s', $ts);
}