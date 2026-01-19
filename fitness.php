<?php
require_once __DIR__ . '/lib_polar.php';
require_basic_auth();

$page_title = "Activity";

// active user
$u = db()->query("SELECT * FROM polar_users WHERE is_active=1 ORDER BY id DESC LIMIT 1")->fetch();
$polarUserId = $u['polar_user_id'] ?? '';

$today = date('Y-m-d');
$selected = $_GET['date'] ?? $today;
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $selected)) $selected = $today;

$prev = date('Y-m-d', strtotime($selected.' -1 day'));
$next = date('Y-m-d', strtotime($selected.' +1 day'));

// daily activity summary (steps, calories, distance)
$actStmt = db()->prepare("
  SELECT *
  FROM polar_daily_activity
  WHERE polar_user_id = ? AND activity_date = ?
  LIMIT 1
");
$actStmt->execute([$polarUserId, $selected]);
$activity = $actStmt->fetch();

// exercises on selected day (by start_time date)
$exStmt = db()->prepare("
  SELECT *
  FROM polar_exercises
  WHERE polar_user_id = ?
    AND DATE(start_time) = ?
  ORDER BY start_time DESC
");
$exStmt->execute([$polarUserId, $selected]);
$exercises = $exStmt->fetchAll();

// monthly aggregates for month view
$month = $_GET['month'] ?? date('Y-m', strtotime($selected));
if (!preg_match('/^\d{4}-\d{2}$/', $month)) $month = date('Y-m', strtotime($selected));
$monthStart = $month.'-01';
$monthEnd = date('Y-m-t', strtotime($monthStart));

$monStmt = db()->prepare("
  SELECT
    COUNT(*) AS sessions,
    COALESCE(SUM(duration_seconds),0) AS duration_s,
    COALESCE(SUM(distance_m),0) AS distance_m,
    COALESCE(SUM(calories),0) AS calories
  FROM polar_exercises
  WHERE polar_user_id = ?
    AND DATE(start_time) BETWEEN ? AND ?
");
$monStmt->execute([$polarUserId, $monthStart, $monthEnd]);
$monthAgg = $monStmt->fetch();

// trend charts (last 14 days)
$trendStart = date('Y-m-d', strtotime($selected.' -13 day'));
$trendStmt = db()->prepare("
  SELECT DATE(start_time) AS d,
         COALESCE(SUM(calories),0) AS cal,
         COALESCE(SUM(duration_seconds),0) AS dur_s,
         COALESCE(SUM(distance_m),0) AS dist_m,
         COUNT(*) AS sessions
  FROM polar_exercises
  WHERE polar_user_id = ?
    AND DATE(start_time) BETWEEN ? AND ?
  GROUP BY DATE(start_time)
  ORDER BY DATE(start_time) ASC
");
$trendStmt->execute([$polarUserId, $trendStart, $selected]);
$trendRows = $trendStmt->fetchAll();

$trendMap = [];
foreach ($trendRows as $r) $trendMap[$r['d']] = $r;

$trendLabels = [];
$trendCalories = [];
$trendDurationMin = [];
$trendDistanceKm = [];

for ($i=13; $i>=0; $i--){
  $d = date('Y-m-d', strtotime($selected." -{$i} day"));
  $trendLabels[] = date('j M', strtotime($d));
  $row = $trendMap[$d] ?? null;

  $trendCalories[] = $row ? (int)$row['cal'] : 0;
  $trendDurationMin[] = $row ? (float)($row['dur_s']/60.0) : 0;
  $trendDistanceKm[] = $row ? (float)($row['dist_m']/1000.0) : 0;
}

// helpers
function h($s){ return htmlspecialchars((string)$s); }
function fmt_mins_from_s($s){
  if ($s === null) return '–';
  $m = (int)round(((int)$s)/60);
  $h = intdiv($m, 60);
  $mm = $m % 60;
  return $h > 0 ? "{$h}h {$mm}m" : "{$mm}m";
}
function fmt_num($n){
  if ($n === null) return '–';
  return number_format((float)$n, 0);
}
function fmt_km($m){
  if ($m === null) return '–';
  return number_format(((float)$m)/1000.0, 1);
}
function fmt_dt($dt){
  if (!$dt) return '–';
  $ts = strtotime($dt);
  if ($ts === false) return h($dt);
  return date('H:i', $ts);
}
function decode_json($s){
  if (!$s) return null;
  $d = json_decode($s, true);
  return is_array($d) ? $d : null;
}
function zone_minutes_from_payload($zones){
  // zones may be array of objects or keyed map. Return array zone=>minutes
  if (!is_array($zones)) return null;

  $out = [1=>0,2=>0,3=>0,4=>0,5=>0];

  // if it's list of {zone, minutes} or {index, seconds}
  if (isset($zones[0]) && is_array($zones[0])) {
    foreach ($zones as $z) {
      $zone = $z['zone'] ?? $z['index'] ?? $z['zone_id'] ?? null;
      $mins = $z['minutes'] ?? null;
      $secs = $z['seconds'] ?? $z['time_seconds'] ?? null;
      if ($mins === null && $secs !== null) $mins = (int)round(((int)$secs)/60);
      if ($zone !== null && $mins !== null && isset($out[(int)$zone])) $out[(int)$zone] += (int)$mins;
    }
    return $out;
  }

  // if keyed: { "zone1": 10, "zone2": 5 ... }
  foreach ($zones as $k=>$v){
    if (!is_numeric($v)) continue;
    if (preg_match('/(\d+)/', (string)$k, $m)) {
      $zone = (int)$m[1];
      if ($zone>=1 && $zone<=5) $out[$zone] += (int)round((float)$v);
    }
  }
  return $out;
}

$mode = $_GET['mode'] ?? 'daily';
if (!in_array($mode, ['daily','monthly'], true)) $mode = 'daily';

// For expanded workout card
$openId = $_GET['open'] ?? null;
?>
<!doctype html>
<html lang="en">
<head>
  <?php include __DIR__ . '/_app_head.php'; ?>
</head>
<body class="app">
  <main class="screen">

    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
      <a class="btn btn-small" href="/PolarPulse/today.php">←</a>

      <div style="text-align:center;flex:1;">
        <div class="h1" style="margin:0;"><?= $mode === 'daily' ? 'Activity' : 'Activity' ?></div>

        <div class="seg" style="margin-top:8px;">
          <a class="seg-btn <?= $mode==='daily'?'active':'' ?>" href="/PolarPulse/fitness.php?mode=daily&date=<?= h($selected) ?>">Daily</a>
          <a class="seg-btn <?= $mode==='monthly'?'active':'' ?>" href="/PolarPulse/fitness.php?mode=monthly&month=<?= h($month) ?>&date=<?= h($selected) ?>">Monthly</a>
        </div>
      </div>

      <a class="btn btn-small" href="/PolarPulse/profile.php">⚙︎</a>
    </div>

    <div style="height:12px;"></div>

    <?php if ($mode === 'daily'): ?>
      <!-- Date nav -->
      <div class="date-nav">
        <a class="btn btn-small" href="/PolarPulse/fitness.php?mode=daily&date=<?= h($prev) ?>">←</a>
        <div class="date-nav-mid">
          <div class="date-nav-top">Today</div>
          <div class="date-nav-sub"><?= h($selected) ?></div>
        </div>
        <a class="btn btn-small" href="/PolarPulse/fitness.php?mode=daily&date=<?= h($next) ?>">→</a>
      </div>

      <!-- Daily summary card -->
      <div class="card card-pad">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div class="sec-title">Today</div>
            <div class="sec-sub">Calories · Steps · Distance</div>
          </div>
          <span class="pill"><span class="dot green"></span><?= $activity ? 'Synced' : 'No data' ?></span>
        </div>

        <div style="height:10px;"></div>

        <div class="metric-list">
          <div class="metric-item">
            <div>
              <div class="metric-name">Calories</div>
              <div class="metric-meta">Total</div>
            </div>
            <div class="metric-val warn"><?= $activity ? fmt_num($activity['calories'] ?? 0).' kcal' : '–' ?></div>
          </div>

          <div class="metric-item">
            <div>
              <div class="metric-name">Steps</div>
              <div class="metric-meta">Total</div>
            </div>
            <div class="metric-val good"><?= $activity ? fmt_num($activity['steps'] ?? 0) : '–' ?></div>
          </div>

          <div class="metric-item">
            <div>
              <div class="metric-name">Distance</div>
              <div class="metric-meta">Total</div>
            </div>
            <div class="metric-val info"><?= $activity ? fmt_km($activity['distance_m'] ?? 0).' km' : '–' ?></div>
          </div>
        </div>
      </div>

      <!-- Training Sessions -->
      <div class="card card-pad">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div class="sec-title">Training Sessions</div>
            <div class="sec-sub"><?= count($exercises) ?> session<?= count($exercises)===1?'':'s' ?></div>
          </div>
          <span class="pill"><span class="dot blue"></span><?= h(date('D', strtotime($selected))) ?></span>
        </div>

        <div style="height:10px;"></div>

        <?php if (!$exercises): ?>
          <div class="empty">
            <div class="empty-icon">🏃</div>
            <div class="empty-title">No Training Sessions</div>
            <div class="empty-sub">No exercises recorded for this day</div>
          </div>
        <?php else: ?>
          <div class="stack">
            <?php foreach ($exercises as $ex): ?>
              <?php
                $eid = (string)($ex['exercise_id'] ?? '');
                $isOpen = ($openId && $eid === (string)$openId);

                $zones = decode_json($ex['hr_zones_json'] ?? null);
                $zoneMins = zone_minutes_from_payload($zones);

                $samples = decode_json($ex['samples_json'] ?? null);
                // Attempt to get HR series from samples
                $hrSeries = null;
                if (is_array($samples)) {
                  // if has hr list
                  $candidates = $samples['heart_rate'] ?? $samples['heart_rate_samples'] ?? $samples['hr'] ?? null;
                  if (is_array($candidates) && isset($candidates[0]) && is_numeric($candidates[0])) {
                    $hrSeries = array_map('floatval', $candidates);
                  }
                  if (!$hrSeries && isset($samples[0]) && is_numeric($samples[0])) {
                    $hrSeries = array_map('floatval', $samples);
                  }
                }

                $avgHr = $ex['avg_hr'] ?? null;
                $maxHr = $ex['max_hr'] ?? null;
                $cal = $ex['calories'] ?? null;
                $dur = $ex['duration_seconds'] ?? null;
                $sport = $ex['sport'] ?? 'Other';
              ?>

              <div class="session card-soft">
                <a class="session-head" href="/PolarPulse/fitness.php?mode=daily&date=<?= h($selected) ?>&open=<?= h($eid) ?>#ex-<?= h($eid) ?>">
                  <div class="session-icon">🏃</div>
                  <div class="session-mid">
                    <div class="session-title"><?= h($sport ?: 'Other') ?></div>
                    <div class="session-sub"><?= fmt_dt($ex['start_time'] ?? null) ?></div>
                  </div>
                  <div class="session-chevron"><?= $isOpen ? '▾' : '▸' ?></div>
                </a>

                <div class="session-badges">
                  <span class="badge-pill">⏱ <?= fmt_mins_from_s($dur) ?></span>
                  <span class="badge-pill">🔥 <?= $cal !== null ? fmt_num($cal).' kcal' : '–' ?></span>
                  <span class="badge-pill">❤ Avg <?= $avgHr !== null ? (int)$avgHr.' bpm' : '–' ?></span>
                </div>

                <?php if ($isOpen): ?>
                  <div id="ex-<?= h($eid) ?>"></div>

                  <div style="height:10px;"></div>

                  <div class="sec-title" style="font-size:1rem;">Heart Rate Over Time</div>
                  <div class="sec-sub">If samples are available, this chart will populate.</div>

                  <div class="chart-box" style="height:200px;margin-top:8px;">
                    <canvas id="hr_<?= h($eid) ?>"></canvas>
                  </div>

                  <div class="hr"></div>

                  <div class="sec-title" style="font-size:1rem;">Details</div>
                  <div class="metric-list" style="margin-top:8px;">
                    <div class="metric-item">
                      <div class="metric-name">Average HR</div>
                      <div class="metric-val"><?= $avgHr !== null ? (int)$avgHr.' bpm' : '–' ?></div>
                    </div>
                    <div class="metric-item">
                      <div class="metric-name">Maximum HR</div>
                      <div class="metric-val"><?= $maxHr !== null ? (int)$maxHr.' bpm' : '–' ?></div>
                    </div>
                    <div class="metric-item">
                      <div class="metric-name">Calories</div>
                      <div class="metric-val"><?= $cal !== null ? fmt_num($cal).' kcal' : '–' ?></div>
                    </div>
                    <div class="metric-item">
                      <div class="metric-name">Sport</div>
                      <div class="metric-val"><?= h($sport ?: 'Other') ?></div>
                    </div>
                    <div class="metric-item">
                      <div class="metric-name">Distance</div>
                      <div class="metric-val"><?= $ex['distance_m'] !== null ? fmt_km($ex['distance_m']).' km' : '–' ?></div>
                    </div>
                  </div>

                  <div class="hr"></div>

                  <div class="sec-title" style="font-size:1rem;">Heart Rate Zones</div>
                  <div class="sec-sub">Minutes in each zone</div>

                  <div style="height:10px;"></div>

                  <?php if (!$zoneMins): ?>
                    <div class="sub">No zone data available for this session yet.</div>
                  <?php else: ?>
                    <?php
                      $zTotal = array_sum($zoneMins);
                      $zPct = function($m) use ($zTotal){
                        if ($zTotal <= 0) return 0;
                        return (int)round(($m / $zTotal) * 100);
                      };
                    ?>
                    <div class="zones">
                      <?php for ($z=1;$z<=5;$z++): ?>
                        <?php $m = (int)($zoneMins[$z] ?? 0); $p = $zPct($m); ?>
                        <div class="zone-row">
                          <div class="zone-left">
                            <div class="zone-dot z<?= $z ?>"></div>
                            <div class="zone-name">Zone <?= $z ?></div>
                          </div>
                          <div class="zone-bar">
                            <div class="zone-fill z<?= $z ?>" style="width: <?= $p ?>%;"></div>
                          </div>
                          <div class="zone-right"><?= $m > 0 ? $m.'m' : '0' ?></div>
                        </div>
                      <?php endfor; ?>
                    </div>
                  <?php endif; ?>

                  <div style="height:8px;"></div>
                  <a class="btn btn-small" href="/PolarPulse/fitness.php?mode=daily&date=<?= h($selected) ?>">Close</a>

                  <script>
                    (function(){
                      const el = document.getElementById('hr_<?= h($eid) ?>');
                      if (!el) return;

                      const series = <?= json_encode($hrSeries ? array_values($hrSeries) : null) ?>;

                      if (!series || series.length < 6) {
                        // Render a subtle empty state line
                        new Chart(el, {
                          type: 'line',
                          data: { labels: [0,1,2,3,4], datasets:[{ data:[0,0,0,0,0], tension:.35, borderWidth:2, pointRadius:0 }] },
                          options: {
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { display:false }, tooltip: { enabled:false } },
                            scales: { x: { display:false }, y: { display:false } }
                          }
                        });
                        return;
                      }

                      const labels = series.map((_,i)=>i);
                      new Chart(el, {
                        type: 'line',
                        data: {
                          labels,
                          datasets: [{
                            data: series,
                            tension: 0.35,
                            borderWidth: 3,
                            pointRadius: 0,
                            fill: true
                          }]
                        },
                        options: {
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                          scales: {
                            x: { ticks: { display: false }, grid: { display: false } },
                            y: { ticks: { color: 'rgba(233,238,247,.55)' }, grid: { color: 'rgba(255,255,255,.06)' } }
                          }
                        }
                      });
                    })();
                  </script>
                <?php endif; ?>
              </div>

            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </div>

      <!-- Trends -->
      <div class="card card-pad">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div class="sec-title">Workout Trends</div>
            <div class="sec-sub">Last 14 days</div>
          </div>
          <span class="pill"><span class="dot green"></span>14d</span>
        </div>

        <div style="height:10px;"></div>

        <div class="sec-title" style="font-size:1rem;">Workout Calories</div>
        <div class="chart-box" style="height:220px;margin-top:8px;"><canvas id="trendCalories"></canvas></div>

        <div style="height:14px;"></div>

        <div class="sec-title" style="font-size:1rem;">Workout Duration</div>
        <div class="chart-box" style="height:220px;margin-top:8px;"><canvas id="trendDuration"></canvas></div>

        <div style="height:14px;"></div>

        <div class="sec-title" style="font-size:1rem;">Workout Distance</div>
        <div class="chart-box" style="height:220px;margin-top:8px;"><canvas id="trendDistance"></canvas></div>
      </div>

    <?php else: ?>
      <!-- Monthly view -->
      <?php
        $prevMonth = date('Y-m', strtotime($monthStart.' -1 month'));
        $nextMonth = date('Y-m', strtotime($monthStart.' +1 month'));
      ?>
      <div class="date-nav">
        <a class="btn btn-small" href="/PolarPulse/fitness.php?mode=monthly&month=<?= h($prevMonth) ?>&date=<?= h($selected) ?>">←</a>
        <div class="date-nav-mid">
          <div class="date-nav-top"><?= h(date('F Y', strtotime($monthStart))) ?></div>
          <div class="date-nav-sub">Select month</div>
        </div>
        <a class="btn btn-small" href="/PolarPulse/fitness.php?mode=monthly&month=<?= h($nextMonth) ?>&date=<?= h($selected) ?>">→</a>
      </div>

      <div class="card card-pad">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div class="sec-title">Monthly Overview</div>
            <div class="sec-sub"><?= h(date('F Y', strtotime($monthStart))) ?></div>
          </div>
          <span class="pill"><span class="dot purple"></span>Month</span>
        </div>

        <div style="height:12px;"></div>

        <div class="grid2">
          <div class="mini">
            <div class="mini-lab">Total Sessions</div>
            <div class="mini-val"><?= (int)($monthAgg['sessions'] ?? 0) ?></div>
          </div>
          <div class="mini">
            <div class="mini-lab">Total Duration</div>
            <div class="mini-val"><?= fmt_mins_from_s((int)($monthAgg['duration_s'] ?? 0)) ?></div>
          </div>
          <div class="mini">
            <div class="mini-lab">Total Distance</div>
            <div class="mini-val"><?= number_format(((float)($monthAgg['distance_m'] ?? 0))/1000.0, 1) ?> km</div>
          </div>
          <div class="mini">
            <div class="mini-lab">Total Calories</div>
            <div class="mini-val"><?= fmt_num((int)($monthAgg['calories'] ?? 0)) ?></div>
          </div>
        </div>
      </div>

      <div class="card card-pad">
        <div class="sec-title">Activity Types</div>
        <div class="sec-sub">Grouped by sport (this month)</div>

        <?php
          $typeStmt = db()->prepare("
            SELECT COALESCE(NULLIF(sport,''),'Other') AS sport,
                   COUNT(*) AS sessions,
                   COALESCE(SUM(duration_seconds),0) AS dur_s
            FROM polar_exercises
            WHERE polar_user_id = ?
              AND DATE(start_time) BETWEEN ? AND ?
            GROUP BY COALESCE(NULLIF(sport,''),'Other')
            ORDER BY sessions DESC
            LIMIT 12
          ");
          $typeStmt->execute([$polarUserId, $monthStart, $monthEnd]);
          $types = $typeStmt->fetchAll();
        ?>

        <div style="height:10px;"></div>

        <?php if (!$types): ?>
          <div class="empty">
            <div class="empty-icon">🏃</div>
            <div class="empty-title">No activity yet</div>
            <div class="empty-sub">No exercises recorded for this month</div>
          </div>
        <?php else: ?>
          <div class="stack">
            <?php foreach ($types as $t): ?>
              <div class="type-card card-soft">
                <div class="type-ic">🏋︎</div>
                <div class="type-mid">
                  <div class="type-title"><?= h($t['sport']) ?></div>
                  <div class="type-sub"><?= (int)$t['sessions'] ?> sessions · <?= fmt_mins_from_s((int)$t['dur_s']) ?></div>
                </div>
                <div class="type-chevron">›</div>
              </div>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </div>

    <?php endif; ?>

  </main>

  <?php include __DIR__ . '/_tabbar.php'; ?>

  <script>
    // Trend charts (only needed in daily mode)
    <?php if ($mode === 'daily'): ?>
    const tLabels = <?= json_encode($trendLabels) ?>;
    const tCalories = <?= json_encode($trendCalories) ?>;
    const tDuration = <?= json_encode($trendDurationMin) ?>;
    const tDistance = <?= json_encode($trendDistanceKm) ?>;

    function buildLine(id, dataArr){
      const el = document.getElementById(id);
      if (!el) return;
      new Chart(el, {
        type: 'line',
        data: {
          labels: tLabels,
          datasets: [{
            data: dataArr,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 0,
            fill: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: 'rgba(233,238,247,.55)' }, grid: { display: false } },
            y: { ticks: { color: 'rgba(233,238,247,.55)' }, grid: { color: 'rgba(255,255,255,.06)' } }
          }
        }
      });
    }

    buildLine('trendCalories', tCalories);
    buildLine('trendDuration', tDuration);
    buildLine('trendDistance', tDistance);
    <?php endif; ?>
  </script>
</body>
</html>