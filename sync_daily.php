<?php
// sync_daily.php (run once per day)
require_once __DIR__ . '/lib_polar.php';

// Optional protection
$secret = $_GET['secret'] ?? '';
if (php_sapi_name() !== 'cli' && $secret !== 'CHANGE_ME_DAILY_SECRET') {
  http_response_code(403);
  echo "Forbidden";
  exit;
}

function safe_log(string $level, string $msg, ?string $polarUserId = null): void {
  try { log_sync($level, $msg, $polarUserId); } catch (Throwable $e) { /* ignore */ }
}

function date_ymd_days_back(int $daysBack): array {
  $out = [];
  for ($i = 0; $i < $daysBack; $i++) $out[] = date('Y-m-d', strtotime("-{$i} day"));
  return $out;
}

function ymd_from_to(int $daysBack): array {
  $to = date('Y-m-d');
  $from = date('Y-m-d', strtotime("-{$daysBack} day"));
  return [$from, $to];
}

function fetch_json_authed(string $auth, string $tokenOrNull, string $pathOrUrl): array {
  // $pathOrUrl can be "/v3/..." or full https://...
  if (str_starts_with($pathOrUrl, 'http')) {
    $url = $pathOrUrl;
  } else {
    $url = POLAR_API_BASE . $pathOrUrl;
  }

  if ($auth === 'basic') {
    // Use client_id:client_secret
    $res = polar_basic(str_starts_with($pathOrUrl, 'http') ? parse_url($url, PHP_URL_PATH) . (parse_url($url, PHP_URL_QUERY) ? '?' . parse_url($url, PHP_URL_QUERY) : '') : $pathOrUrl, 'GET');
    return $res;
  }

  // bearer
  $res = polar_bearer($tokenOrNull ?? '', str_starts_with($pathOrUrl, 'http') ? parse_url($url, PHP_URL_PATH) . (parse_url($url, PHP_URL_QUERY) ? '?' . parse_url($url, PHP_URL_QUERY) : '') : $pathOrUrl, 'GET');
  return $res;
}

function store_raw_if_json_ok(string $polarUserId, string $dataType, ?string $objectId, ?string $objectDate, string $endpoint, array $res): bool {
  if ($res['status'] !== 200) return false;

  $payload = json_decode_assoc($res['body']);
  if (!$payload) return false;

  upsert_raw($polarUserId, $dataType, $objectId, $objectDate, $endpoint, $payload);
  return true;
}

function download_file_basic(string $urlOrPath, string $destPath): array {
  // URL might be full; our polar_basic expects a path
  $path = $urlOrPath;
  if (str_starts_with($urlOrPath, 'http')) {
    $u = parse_url($urlOrPath);
    $path = ($u['path'] ?? '') . (isset($u['query']) ? '?' . $u['query'] : '');
  }

  $url = POLAR_API_BASE . $path;
  $auth = base64_encode(POLAR_CLIENT_ID . ':' . POLAR_CLIENT_SECRET);
  $headers = [
    'Authorization: Basic ' . $auth,
    'Accept: */*'
  ];

  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');
  curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
  curl_setopt($ch, CURLOPT_TIMEOUT, 60);

  $body = curl_exec($ch);
  $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err = ($body === false) ? curl_error($ch) : null;
  curl_close($ch);

  if ($body === false) return ['status' => 0, 'error' => $err, 'bytes' => 0];

  if ($status === 200) {
    $dir = dirname($destPath);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    file_put_contents($destPath, $body);
    return ['status' => 200, 'error' => null, 'bytes' => strlen($body)];
  }

  return ['status' => $status, 'error' => null, 'bytes' => 0];
}

function maybe_store_exercise_files(string $polarUserId, string $exerciseId): void {
  // Recommended: store files on disk, not in MySQL.
  // Change base dir if you want. Ensure folder is writable.
  $baseDir = __DIR__ . '/polar_files/' . $polarUserId;
  @mkdir($baseDir, 0755, true);

  $targets = [
    ['fit', "/v3/exercises/{$exerciseId}/fit"],
    ['tcx', "/v3/exercises/{$exerciseId}/tcx"],
    ['gpx', "/v3/exercises/{$exerciseId}/gpx"],
  ];

  foreach ($targets as $t) {
    [$ext, $path] = $t;
    $dest = "{$baseDir}/{$exerciseId}.{$ext}";
    if (file_exists($dest) && filesize($dest) > 0) continue; // already downloaded

    $dl = download_file_basic($path, $dest);
    if ($dl['status'] === 200) {
      $meta = [
        'exercise_id' => $exerciseId,
        'format' => $ext,
        'path' => $dest,
        'bytes' => $dl['bytes'],
        'sha1' => sha1_file($dest),
      ];
      upsert_raw($polarUserId, "exercise_file_{$ext}", $exerciseId, null, $path, $meta);
    }
  }
}

function run_daily_for_user(string $polarUserId, string $token): void {
  safe_log('INFO', 'Daily sweep user start', $polarUserId);

  // Windows chosen to match API limits in your CSV:
  // - many are "last 28 days" max, so we use from/to for 28
  // - some allow older, but keep it safe and stable
  [$from28, $to] = ymd_from_to(28);
  [$from7, $to7] = ymd_from_to(7);

  $ok = 0;
  $attempt = 0;

  // -------------------------
  // Bearer endpoints (CSV-aligned)
  // -------------------------

  $bearerGets = [
    // Daily activity (non-transactional)
    ["daily_activity_list_28d", null, null, "/v3/users/activities/?from={$from28}&to={$to}"],
    ["activity_samples_list_28d", null, null, "/v3/users/activities/samples/?from={$from28}&to={$to}"],

    // Continuous heart rate
    ["continuous_hr_range_7d", null, null, "/v3/users/continuous-heart-rate?from={$from7}&to={$to7}"],

    // Cardio load (CSV has the range endpoint as /cardio-load/date with from/to)
    ["cardio_load_range_28d", null, null, "/v3/users/cardio-load/date?from={$from28}&to={$to}"],
    ["cardio_load_last_28d", null, null, "/v3/users/cardio-load/"],

    // Sleep + available
    ["sleep_list_28d", null, null, "/v3/users/sleep"],
    ["sleep_available", null, null, "/v3/users/sleep/available"],

    // Nightly Recharge
    ["nightly_recharge_list_28d", null, null, "/v3/users/nightly-recharge"],

    // SleepWise (beta) ranges
    ["sleepwise_alertness_range_28d", null, null, "/v3/users/sleepwise/alertness/date?from={$from28}&to={$to}"],
    ["sleepwise_alertness_last_28d", null, null, "/v3/users/sleepwise/alertness"],
    ["sleepwise_circadian_range_28d", null, null, "/v3/users/sleepwise/circadian-bedtime/date?from={$from28}&to={$to}"],
    ["sleepwise_circadian_last_28d", null, null, "/v3/users/sleepwise/circadian-bedtime"],

    // Biosensing (Elixir): CSV says last 28 days OR date range (max 28 days)
    ["biosensing_bodytemperature_28d", null, null, "/v3/users/biosensing/bodytemperature?from={$from28}&to={$to}"],
    ["biosensing_skintemperature_28d", null, null, "/v3/users/biosensing/skintemperature?from={$from28}&to={$to}"],
    ["biosensing_skincontacts_28d", null, null, "/v3/users/biosensing/skincontacts?from={$from28}&to={$to}"],
    ["biosensing_ecg_28d", null, null, "/v3/users/biosensing/ecg?from={$from28}&to={$to}"],
    ["biosensing_spo2_28d", null, null, "/v3/users/biosensing/spo2?from={$from28}&to={$to}"],

    // User info (handy snapshot)
    ["user_profile", $polarUserId, null, "/v3/users/{$polarUserId}"],
  ];

  foreach ($bearerGets as $g) {
    [$type, $objId, $objDate, $path] = $g;
    $attempt++;
    $res = polar_bearer($token, $path, 'GET');

    if (store_raw_if_json_ok($polarUserId, $type, $objId ? (string)$objId : null, $objDate, $path, $res)) {
      $ok++;
      continue;
    }

    if (in_array($res['status'], [204, 400, 401, 403, 404, 409], true)) {
      safe_log('WARN', "Daily bearer skipped {$type} HTTP {$res['status']} path={$path}", $polarUserId);
    } else {
      safe_log('WARN', "Daily bearer failed {$type} HTTP {$res['status']} path={$path} body={$res['body']}", $polarUserId);
    }
  }

  // Per-date detail endpoints for the last 7 days (these often have richer per-day payloads)
  $days7 = date_ymd_days_back(7);
  foreach ($days7 as $d) {
    $datePaths = [
      ["daily_activity_day", null, $d, "/v3/users/activities/{$d}"],
      ["activity_samples_day", null, $d, "/v3/users/activities/samples/{$d}"],
      ["continuous_hr_day", null, $d, "/v3/users/continuous-heart-rate/{$d}"],
      ["cardio_load_day", null, $d, "/v3/users/cardio-load/{$d}"],
      ["sleep_day", null, $d, "/v3/users/sleep/{$d}"],
      ["nightly_recharge_day", null, $d, "/v3/users/nightly-recharge/{$d}"],
    ];

    foreach ($datePaths as $p) {
      [$type, $objId, $objDate, $path] = $p;
      $attempt++;
      $res = polar_bearer($token, $path, 'GET');

      if (store_raw_if_json_ok($polarUserId, $type, $objId, $objDate, $path, $res)) {
        $ok++;
        continue;
      }

      if (in_array($res['status'], [204, 400, 401, 403, 404, 409], true)) {
        // common for devices/features not enabled
        continue;
      }
      safe_log('WARN', "Daily bearer day failed {$type} HTTP {$res['status']} path={$path} body={$res['body']}", $polarUserId);
    }
  }

  // -------------------------
  // Basic endpoints (CSV-aligned)
  // -------------------------

  // Notifications
  $attempt++;
  $nRes = polar_basic("/v3/notifications", "GET");
  if (store_raw_if_json_ok($polarUserId, "notifications", null, null, "/v3/notifications", $nRes)) {
    $ok++;
  } else {
    if (!in_array($nRes['status'], [204, 400, 401, 403, 404], true)) {
      safe_log('WARN', "Daily basic notifications failed HTTP {$nRes['status']} body={$nRes['body']}", $polarUserId);
    }
  }

  // Exercises list (last 30 days)
  $attempt++;
  $exListRes = polar_basic("/v3/exercises", "GET");
  $exList = null;
  if ($exListRes['status'] === 200) {
    $exList = json_decode_assoc($exListRes['body']);
    if ($exList) {
      upsert_raw($polarUserId, "exercises_list_30d", null, null, "/v3/exercises", $exList);
      $ok++;
    }
  }

  // Pull exercise details for each id we can find
  if (is_array($exList)) {
    // Different shapes exist; try common keys safely
    $ids = [];

    if (isset($exList['exercises']) && is_array($exList['exercises'])) {
      foreach ($exList['exercises'] as $e) {
        if (is_array($e) && isset($e['id'])) $ids[] = (string)$e['id'];
        if (is_string($e)) $ids[] = $e;
      }
    } elseif (array_is_list($exList)) {
      foreach ($exList as $e) {
        if (is_array($e) && isset($e['id'])) $ids[] = (string)$e['id'];
        if (is_string($e)) $ids[] = $e;
      }
    }

    $ids = array_values(array_unique(array_filter($ids)));

    foreach ($ids as $exerciseId) {
      // CSV: /v3/exercises/{exerciseId} supports query samples,zones
      $path = "/v3/exercises/{$exerciseId}?samples=true&zones=true";
      $attempt++;

      // polar_basic takes paths, but our helper above doesn’t; keep direct:
      $detailRes = polar_basic($path, "GET");

      if ($detailRes['status'] === 200) {
        $payload = json_decode_assoc($detailRes['body']);
        if ($payload) {
          upsert_raw($polarUserId, "exercise_basic_detail", $exerciseId, iso_to_date($payload['start_time'] ?? null), $path, $payload);
          $ok++;
        }
      } else {
        if (!in_array($detailRes['status'], [204, 400, 401, 403, 404], true)) {
          safe_log('WARN', "Daily basic exercise detail failed id={$exerciseId} HTTP {$detailRes['status']} body={$detailRes['body']}", $polarUserId);
        }
      }

      // Optional: download files to disk (safe on shared hosting)
      // Comment out if you don't want files yet.
      maybe_store_exercise_files($polarUserId, $exerciseId);
    }
  }

  safe_log('INFO', "Daily sweep user done ok={$ok} attempted={$attempt}", $polarUserId);
}

// Main
safe_log('INFO', 'Daily sweep started');

$users = get_active_users();
foreach ($users as $u) {
  $polarUserId = $u['polar_user_id'];
  $token = $u['access_token'];

  try {
    run_daily_for_user($polarUserId, $token);
  } catch (Throwable $e) {
    safe_log('ERROR', 'Daily sweep error: ' . $e->getMessage(), $polarUserId);
  }
}

safe_log('INFO', 'Daily sweep finished');
echo "OK\n";