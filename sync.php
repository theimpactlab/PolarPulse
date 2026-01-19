<?php
// sync.php
// Runs every 30 minutes via cron, or manually via browser with secret

require_once __DIR__ . '/lib_polar.php';

/**
 * =========================
 * SECURITY
 * =========================
 * Allow:
 *  - CLI (cron)
 *  - Browser ONLY if secret matches
 */

// Optional: protect from public execution
$secret = $_GET['secret'] ?? '';
if (php_sapi_name() !== 'cli' && (!defined('SYNC_WEB_SECRET') || $secret !== SYNC_WEB_SECRET)) {
  http_response_code(403);
  echo "Forbidden";
  exit;
}

/**
 * =========================
 * HELPERS
 * =========================
 */

function safe_log(string $level, string $msg, ?string $polarUserId = null): void {
  try {
    log_sync($level, $msg, $polarUserId);
  } catch (Throwable $e) {
    // swallow logging errors
  }
}

/**
 * =========================
 * SUMMARY UPSERTS
 * =========================
 */

function upsert_exercise_summary(
  string $polarUserId,
  string $exerciseId,
  array $exercise,
  ?array $zones,
  ?array $samples
): void {

  $sql = "
    INSERT INTO polar_exercises
      (polar_user_id, exercise_id, start_time, duration_seconds, calories,
       sport, distance_m, avg_hr, max_hr,
       hr_zones_json, samples_json, raw_json)
    VALUES
      (?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      start_time = VALUES(start_time),
      duration_seconds = VALUES(duration_seconds),
      calories = VALUES(calories),
      sport = VALUES(sport),
      distance_m = VALUES(distance_m),
      avg_hr = VALUES(avg_hr),
      max_hr = VALUES(max_hr),
      hr_zones_json = VALUES(hr_zones_json),
      samples_json = VALUES(samples_json),
      raw_json = VALUES(raw_json)
  ";

  $durationSeconds = null;
  if (isset($exercise['duration']) && is_int($exercise['duration'])) {
    $durationSeconds = $exercise['duration'];
  }

  db()->prepare($sql)->execute([
    $polarUserId,
    $exerciseId,
    iso_to_mysql_datetime($exercise['start_time'] ?? null),
    $durationSeconds,
    $exercise['calories'] ?? null,
    $exercise['sport'] ?? null,
    $exercise['distance'] ?? null,
    $exercise['average_heart_rate'] ?? null,
    $exercise['maximum_heart_rate'] ?? null,
    $zones ? json_encode($zones) : null,
    $samples ? json_encode($samples) : null,
    json_encode($exercise),
  ]);
}

function upsert_activity_summary(
  string $polarUserId,
  string $activityId,
  array $activity,
  ?array $stepSamples,
  ?array $zoneSamples
): void {

  $sql = "
    INSERT INTO polar_daily_activity
      (polar_user_id, activity_id, activity_date, steps,
       calories, active_calories, distance_m,
       step_samples_json, zone_samples_json, raw_json)
    VALUES
      (?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      activity_date = VALUES(activity_date),
      steps = VALUES(steps),
      calories = VALUES(calories),
      active_calories = VALUES(active_calories),
      distance_m = VALUES(distance_m),
      step_samples_json = VALUES(step_samples_json),
      zone_samples_json = VALUES(zone_samples_json),
      raw_json = VALUES(raw_json)
  ";

  db()->prepare($sql)->execute([
    $polarUserId,
    $activityId,
    $activity['date'] ?? null,
    $activity['steps'] ?? null,
    $activity['calories'] ?? null,
    $activity['active_calories'] ?? null,
    $activity['distance'] ?? null,
    $stepSamples ? json_encode($stepSamples) : null,
    $zoneSamples ? json_encode($zoneSamples) : null,
    json_encode($activity),
  ]);
}

function upsert_sleep_summary(string $polarUserId, string $date, array $sleep): void {

  $stages = $sleep['sleep_stages'] ?? $sleep['sleep_stage'] ?? null;

  $sql = "
    INSERT INTO polar_sleep
      (polar_user_id, sleep_date, sleep_start, sleep_end,
       sleep_score, total_sleep_minutes, time_in_bed_minutes,
       stages_json, raw_json)
    VALUES
      (?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      sleep_start = VALUES(sleep_start),
      sleep_end = VALUES(sleep_end),
      sleep_score = VALUES(sleep_score),
      total_sleep_minutes = VALUES(total_sleep_minutes),
      time_in_bed_minutes = VALUES(time_in_bed_minutes),
      stages_json = VALUES(stages_json),
      raw_json = VALUES(raw_json)
  ";

  db()->prepare($sql)->execute([
    $polarUserId,
    $date,
    iso_to_mysql_datetime($sleep['sleep_start_time'] ?? null),
    iso_to_mysql_datetime($sleep['sleep_end_time'] ?? null),
    $sleep['sleep_score'] ?? null,
    $sleep['sleep_time'] ?? null,
    $sleep['time_in_bed'] ?? null,
    $stages ? json_encode($stages) : null,
    json_encode($sleep),
  ]);
}

function upsert_nightly_recharge_summary(string $polarUserId, string $date, array $nr): void {

  $sql = "
    INSERT INTO polar_nightly_recharge
      (polar_user_id, recharge_date, recharge_status,
       ans_charge, hrv_avg_ms, rhr_avg, raw_json)
    VALUES
      (?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      recharge_status = VALUES(recharge_status),
      ans_charge = VALUES(ans_charge),
      hrv_avg_ms = VALUES(hrv_avg_ms),
      rhr_avg = VALUES(rhr_avg),
      raw_json = VALUES(raw_json)
  ";

  db()->prepare($sql)->execute([
    $polarUserId,
    $date,
    $nr['recharge_status'] ?? null,
    $nr['ans_charge'] ?? null,
    $nr['hrv_avg'] ?? null,
    $nr['rhr_avg'] ?? null,
    json_encode($nr),
  ]);
}

/**
 * =========================
 * TRANSACTIONS
 * =========================
 */

function run_exercise_transactions(string $token, string $polarUserId): int {

  $init = polar_bearer($token, "/v3/users/{$polarUserId}/exercise-transactions", 'POST');
  if (!in_array($init['status'], [200,201,204], true)) return 0;

  $initData = json_decode_assoc($init['body']) ?? [];
  $transactionId = $initData['transaction-id'] ?? null;
  if (!$transactionId) return 0;

  $list = polar_bearer($token, "/v3/users/{$polarUserId}/exercise-transactions/{$transactionId}", 'GET');
  if ($list['status'] !== 200) return 0;

  $listData = json_decode_assoc($list['body']) ?? [];
  upsert_raw($polarUserId, 'exercise_transaction_list', (string)$transactionId, null,
    "/v3/users/{$polarUserId}/exercise-transactions/{$transactionId}", $listData);

  $count = 0;

  foreach ($listData['exercises'] ?? [] as $r) {
    $exerciseId = $r['id'] ?? null;
    if (!$exerciseId) continue;

    $base = "/v3/users/{$polarUserId}/exercise-transactions/{$transactionId}/exercises/{$exerciseId}";
    $exercise = fetch_and_store_json($token, $polarUserId, $base, 'exercise', (string)$exerciseId, null);
    if (!$exercise) continue;

    $date = iso_to_date($exercise['start_time'] ?? null);

    $zones = fetch_and_store_json($token, $polarUserId,
      "{$base}/heart-rate-zones", 'exercise_hr_zones', (string)$exerciseId, $date);

    $samples = fetch_and_store_json($token, $polarUserId,
      "{$base}/samples", 'exercise_samples', (string)$exerciseId, $date);

    upsert_exercise_summary($polarUserId, (string)$exerciseId, $exercise, $zones, $samples);
    $count++;
  }

  polar_bearer($token,
    "/v3/users/{$polarUserId}/exercise-transactions/{$transactionId}", 'PUT');

  return $count;
}

function run_activity_transactions(string $token, string $polarUserId): int {

  $init = polar_bearer($token, "/v3/users/{$polarUserId}/activity-transactions", 'POST');
  if (!in_array($init['status'], [200,201,204], true)) return 0;

  $initData = json_decode_assoc($init['body']) ?? [];
  $transactionId = $initData['transaction-id'] ?? null;
  if (!$transactionId) return 0;

  $list = polar_bearer($token,
    "/v3/users/{$polarUserId}/activity-transactions/{$transactionId}", 'GET');
  if ($list['status'] !== 200) return 0;

  $listData = json_decode_assoc($list['body']) ?? [];
  upsert_raw($polarUserId, 'activity_transaction_list', (string)$transactionId, null,
    "/v3/users/{$polarUserId}/activity-transactions/{$transactionId}", $listData);

  $count = 0;

  foreach ($listData['activities'] ?? [] as $r) {
    $activityId = $r['id'] ?? null;
    if (!$activityId) continue;

    $base = "/v3/users/{$polarUserId}/activity-transactions/{$transactionId}/activities/{$activityId}";
    $activity = fetch_and_store_json($token, $polarUserId, $base, 'activity', (string)$activityId, null);
    if (!$activity) continue;

    $date = $activity['date'] ?? null;

    $steps = fetch_and_store_json($token, $polarUserId,
      "{$base}/step-samples", 'activity_step_samples', (string)$activityId, $date);

    $zones = fetch_and_store_json($token, $polarUserId,
      "{$base}/zone-samples", 'activity_zone_samples', (string)$activityId, $date);

    upsert_activity_summary($polarUserId, (string)$activityId, $activity, $steps, $zones);
    $count++;
  }

  polar_bearer($token,
    "/v3/users/{$polarUserId}/activity-transactions/{$transactionId}", 'PUT');

  return $count;
}

/**
 * =========================
 * SLEEP + RECOVERY
 * =========================
 */

function sync_sleep_and_recharge_overlap(string $token, string $polarUserId, int $daysBack = 7): void {

  for ($i = 0; $i < $daysBack; $i++) {
    $date = date('Y-m-d', strtotime("-{$i} day"));

    $sleep = polar_bearer($token, "/v3/users/sleep/{$date}", 'GET');
    if ($sleep['status'] === 200) {
      $data = json_decode_assoc($sleep['body']);
      if ($data) {
        upsert_raw($polarUserId, 'sleep', null, $date,
          "/v3/users/sleep/{$date}", $data);
        upsert_sleep_summary($polarUserId, $date, $data);
      }
    }

    $nr = polar_bearer($token, "/v3/users/nightly-recharge/{$date}", 'GET');
    if ($nr['status'] === 200) {
      $data = json_decode_assoc($nr['body']);
      if ($data) {
        upsert_raw($polarUserId, 'nightly_recharge', null, $date,
          "/v3/users/nightly-recharge/{$date}", $data);
        upsert_nightly_recharge_summary($polarUserId, $date, $data);
      }
    }
  }
}

/**
 * =========================
 * MAIN
 * =========================
 */

safe_log('INFO', 'Sync started');

foreach (get_active_users() as $u) {
  try {
    $ex = run_exercise_transactions($u['access_token'], $u['polar_user_id']);
    $ac = run_activity_transactions($u['access_token'], $u['polar_user_id']);
    sync_sleep_and_recharge_overlap($u['access_token'], $u['polar_user_id'], 7);

    safe_log('INFO', "Synced exercises={$ex}, activities={$ac}", $u['polar_user_id']);
  } catch (Throwable $e) {
    safe_log('ERROR', 'Sync error: ' . $e->getMessage(), $u['polar_user_id']);
  }
}

safe_log('INFO', 'Sync finished');
echo "OK\n";