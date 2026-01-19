<?php
require_once __DIR__ . '/lib_polar.php';
require_basic_auth();

$page_title = "Today";

// active user
$u = db()->query("SELECT * FROM polar_users WHERE is_active=1 ORDER BY id DESC LIMIT 1")->fetch();
$polarUserId = $u['polar_user_id'] ?? '';

$today = date('Y-m-d');
$yday  = date('Y-m-d', strtotime('-1 day'));

// Latest sleep and recharge: try yesterday, then today (some APIs attach to wake date)
$sleepStmt = db()->prepare("
  SELECT * FROM polar_sleep
  WHERE polar_user_id = ?
  AND sleep_date IN (?,?)
  ORDER BY sleep_date DESC
  LIMIT 1
");
$sleepStmt->execute([$polarUserId, $yday, $today]);
$sleep = $sleepStmt->fetch();

$nrStmt = db()->prepare("
  SELECT * FROM polar_nightly_recharge
  WHERE polar_user_id = ?
  AND recharge_date IN (?,?)
  ORDER BY recharge_date DESC
  LIMIT 1
");
$nrStmt->execute([$polarUserId, $yday, $today]);
$nr = $nrStmt->fetch();

// Today activity
$actStmt = db()->prepare("
  SELECT * FROM polar_daily_activity
  WHERE polar_user_id = ? AND activity_date = ?
  LIMIT 1
");
$actStmt->execute([$polarUserId, $today]);
$act = $actStmt->fetch();

// Today workouts
$workoutsStmt = db()->prepare("
  SELECT *
  FROM polar_exercises
  WHERE polar_user_id = ? AND start_time IS NOT NULL AND DATE(start_time) = ?
  ORDER BY start_time DESC
  LIMIT 50
");
$workoutsStmt->execute([$polarUserId, $today]);
$workouts = $workoutsStmt->fetchAll();

// 7 day chart data: Sleep score vs Strain approximation
$start7 = date('Y-m-d', strtotime('-6 day'));
$sleep7Stmt = db()->prepare("
  SELECT sleep_date AS d, sleep_score AS v
  FROM polar_sleep
  WHERE polar_user_id = ? AND sleep_date BETWEEN ? AND ?
  ORDER BY sleep_date ASC
");
$sleep7Stmt->execute([$polarUserId, $start7, $today]);
$sleepRows = $sleep7Stmt->fetchAll();

$sleepMap = [];
foreach ($sleepRows as $r) $sleepMap[$r['d']] = (int)($r['v'] ?? 0);

// Strain approximation: sum of workout calories per day, scaled to 0..100
$strainStmt = db()->prepare("
  SELECT DATE(start_time) AS d, COALESCE(SUM(calories),0) AS cal
  FROM polar_exercises
  WHERE polar_user_id = ? AND start_time IS NOT NULL AND DATE(start_time) BETWEEN ? AND ?
  GROUP BY DATE(start_time)
  ORDER BY d ASC
");
$strainStmt->execute([$polarUserId, $start7, $today]);
$strainRows = $strainStmt->fetchAll();

$strainMap = [];
foreach ($strainRows as $r) $strainMap[$r['d']] = (int)($r['cal'] ?? 0);

// build labels for last 7 days
$labels = [];
$sleepVals = [];
$strainVals = [];
for ($i=6; $i>=0; $i--){
  $d = date('Y-m-d', strtotime("-{$i} day"));
  $labels[] = date('n/j', strtotime($d));
  $sleepVals[] = $sleepMap[$d] ?? null;

  $cal = $strainMap[$d] ?? 0;
  // quick scaling: 0 kcal -> 0, 800 kcal -> 100 (cap)
  $strain = (int)round(min(100, ($cal / 800) * 100));
  $strainVals[] = $strain;
}

// Ring values
$sleepScore = isset($sleep['sleep_score']) ? (int)$sleep['sleep_score'] : null;

// Recovery score approximation: use ANS charge if present, else HRV based
$recoveryScore = null;
if (isset($nr['ans_charge']) && $nr['ans_charge'] !== null && $nr['ans_charge'] !== '') {
  // ans_charge sometimes comes as -10..+10 or 0..100 depending on payloads.
  // We handle both: if it looks like 0..100 use directly, else map -10..+10 to 0..100.
  $ans = (float)$nr['ans_charge'];
  $recoveryScore = ($ans > 20) ? (int)round($ans) : (int)round(max(0, min(100, (($ans + 10) / 20) * 100)));
} elseif (isset($nr['hrv_avg_ms']) && $nr['hrv_avg_ms'] !== null) {
  $hrv = (float)$nr['hrv_avg_ms'];
  // very rough: 20ms -> 0, 80ms -> 100
  $recoveryScore = (int)round(max(0, min(100, (($hrv - 20) / 60) * 100)));
}

$todayStrain = end($strainVals);
if ($todayStrain === false) $todayStrain = 0;

// Helpers
function h($s){ return htmlspecialchars((string)$s); }
function fmt_int($n){ return ($n === null || $n === '') ? '–' : number_format((int)$n); }
function fmt_mins($mins){
  if ($mins === null || $mins === '') return '–';
  $m = (int)$mins;
  $h = intdiv($m, 60);
  $mm = $m % 60;
  return $h > 0 ? "{$h}h {$mm}m" : "{$mm}m";
}
function fmt_time_short($dt){
  if (!$dt) return '–';
  $ts = strtotime($dt);
  if ($ts === false) return h($dt);
  return date('H:i', $ts);
}
?>
<!doctype html>
<html lang="en">
<head>
  <?php include __DIR__ . '/_app_head.php'; ?>
</head>
<body class="app">
  <main class="screen">

    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;">
      <div>
        <h1 class="h1">Good <?= (date('H') < 12 ? 'morning' : (date('H') < 18 ? 'afternoon' : 'evening')) ?>, Ryan</h1>
        <div class="sub">
          Today: <?= h($today) ?>
          <?php if ($sleep): ?>
            · last night: <?= h($sleep['sleep_date'] ?? '') ?>
          <?php endif; ?>
        </div>
      </div>
      <span class="pill"><span class="dot blue"></span><?= $polarUserId ? 'User '.h($polarUserId) : 'No user' ?></span>
    </div>

    <div style="height:12px;"></div>

    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="sec-title">Today's Overview</div>
          <div class="sec-sub">Sleep · Recovery · Strain</div>
        </div>
      </div>

      <div style="height:12px;"></div>

      <div class="row row-3">
        <?php
          $sleepPct = $sleepScore === null ? 0 : max(0, min(100, $sleepScore));
          $recPct = $recoveryScore === null ? 0 : max(0, min(100, $recoveryScore));
          $strainPct = max(0, min(100, (int)$todayStrain));
        ?>
        <div class="ring-wrap">
          <div class="ring" style="--pct:<?= $sleepPct ?>; --ringColor: var(--green);">
            <div class="ring-center">
              <div class="ring-val"><?= $sleepScore === null ? '–' : $sleepScore.'%' ?></div>
              <div class="ring-lab">SLEEP</div>
            </div>
          </div>
        </div>

        <div class="ring-wrap">
          <div class="ring" style="--pct:<?= $recPct ?>; --ringColor: var(--green);">
            <div class="ring-center">
              <div class="ring-val"><?= $recoveryScore === null ? '–' : $recoveryScore.'%' ?></div>
              <div class="ring-lab">RECOVERY</div>
            </div>
          </div>
        </div>

        <div class="ring-wrap">
          <div class="ring" style="--pct:<?= $strainPct ?>; --ringColor: var(--blue);">
            <div class="ring-center">
              <div class="ring-val"><?= (int)round($strainPct) ?></div>
              <div class="ring-lab">STRAIN</div>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-box">
        <canvas id="chartSleepStrain"></canvas>
      </div>
      <div class="sec-sub" style="margin-top:8px;">Sleep vs Strain balance (7 days)</div>
    </div>

    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="sec-title">Your Metrics</div>
          <div class="sec-sub">Today snapshot vs your recent patterns</div>
        </div>
      </div>

      <div class="metric-list">
        <div class="metric-item">
          <div>
            <div class="metric-name">Sleep Duration</div>
            <div class="metric-meta"><?= fmt_time_short($sleep['sleep_start'] ?? null) ?> → <?= fmt_time_short($sleep['sleep_end'] ?? null) ?></div>
          </div>
          <div class="metric-val good"><?= fmt_mins($sleep['total_sleep_minutes'] ?? null) ?></div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">Time in Bed</div>
            <div class="metric-meta">Sleep efficiency later</div>
          </div>
          <div class="metric-val info"><?= fmt_mins($sleep['time_in_bed_minutes'] ?? null) ?></div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">HRV</div>
            <div class="metric-meta">Nightly average</div>
          </div>
          <div class="metric-val"><?= $nr ? h($nr['hrv_avg_ms'] ?? '–').' ms' : '–' ?></div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">Resting HR</div>
            <div class="metric-meta">Nightly average</div>
          </div>
          <div class="metric-val"><?= $nr ? h($nr['rhr_avg'] ?? '–').' bpm' : '–' ?></div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">Steps</div>
            <div class="metric-meta">Today</div>
          </div>
          <div class="metric-val"><?= fmt_int($act['steps'] ?? null) ?></div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">Calories</div>
            <div class="metric-meta">Today</div>
          </div>
          <div class="metric-val warn"><?= fmt_int($act['calories'] ?? null) ?> kcal</div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">Training Sessions</div>
            <div class="metric-meta">Today</div>
          </div>
          <div class="metric-val"><?= count($workouts) ?></div>
        </div>
      </div>
    </div>

    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="sec-title">Training Sessions</div>
          <div class="sec-sub">Tap into Activity for drilldowns</div>
        </div>
        <a class="btn btn-small" href="/PolarPulse/activity.php">Open</a>
      </div>

      <div class="hr"></div>

      <?php if (!$workouts): ?>
        <div class="sec-sub">No exercises recorded for this day.</div>
      <?php else: ?>
        <?php foreach ($workouts as $w): ?>
          <div class="metric-item">
            <div>
              <div class="metric-name"><?= h($w['sport'] ?? 'Workout') ?></div>
              <div class="metric-meta">
                <?= h($w['start_time'] ?? '') ?>
                · <?= $w['duration_seconds'] ? (int)round($w['duration_seconds']/60).' min' : '–' ?>
              </div>
            </div>
            <div class="metric-val"><?= fmt_int($w['calories'] ?? null) ?> kcal</div>
          </div>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>

  </main>

  <?php include __DIR__ . '/_tabbar.php'; ?>

  <script>
    const labels = <?= json_encode($labels) ?>;
    const sleepVals = <?= json_encode($sleepVals) ?>;
    const strainVals = <?= json_encode($strainVals) ?>;

    const ctx = document.getElementById('chartSleepStrain');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Sleep',
            data: sleepVals,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 3,
          },
          {
            label: 'Strain',
            data: strainVals,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: 'rgba(233,238,247,.75)' }
          },
          tooltip: { enabled: true }
        },
        scales: {
          x: {
            ticks: { color: 'rgba(233,238,247,.55)' },
            grid: { color: 'rgba(255,255,255,.06)' }
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { color: 'rgba(233,238,247,.55)' },
            grid: { color: 'rgba(255,255,255,.06)' }
          }
        }
      }
    });
  </script>
</body>
</html>