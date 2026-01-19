<?php
require_once __DIR__ . '/lib_polar.php';
require_basic_auth();

$page_title = "Sleep";

// active user
$u = db()->query("SELECT * FROM polar_users WHERE is_active=1 ORDER BY id DESC LIMIT 1")->fetch();
$polarUserId = $u['polar_user_id'] ?? '';

$today = date('Y-m-d');
$yday  = date('Y-m-d', strtotime('-1 day'));

// Selected date (defaults to yesterday, because sleep usually belongs to the night before)
$selected = $_GET['date'] ?? $yday;
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $selected)) $selected = $yday;

$prev = date('Y-m-d', strtotime($selected.' -1 day'));
$next = date('Y-m-d', strtotime($selected.' +1 day'));

// Load sleep row
$sleepStmt = db()->prepare("
  SELECT * FROM polar_sleep
  WHERE polar_user_id = ? AND sleep_date = ?
  LIMIT 1
");
$sleepStmt->execute([$polarUserId, $selected]);
$sleep = $sleepStmt->fetch();

// Fallback: if not found on that date, try +/- 1 day (API date alignment varies)
if (!$sleep) {
  $sleepStmt->execute([$polarUserId, $prev]);
  $sleep = $sleepStmt->fetch();
  if (!$sleep) {
    $sleepStmt->execute([$polarUserId, $next]);
    $sleep = $sleepStmt->fetch();
  }
}

// Extract stages
$stages = null;
if ($sleep && !empty($sleep['stages_json'])) {
  $stages = json_decode($sleep['stages_json'], true);
}

// Stage values (minutes)
$awakeMin = $remMin = $lightMin = $deepMin = null;
$totalSleepMin = $sleep ? (int)($sleep['total_sleep_minutes'] ?? 0) : null;

if (is_array($stages)) {
  // Support both common shapes:
  // 1) { "awake": 27, "rem": 100, "light": 332, "deep": 47 }
  // 2) { "Awake":..., "REM":..., ... } etc.
  $awakeMin = $stages['awake'] ?? $stages['Awake'] ?? null;
  $remMin   = $stages['rem']   ?? $stages['REM']   ?? null;
  $lightMin = $stages['light'] ?? $stages['Light'] ?? null;
  $deepMin  = $stages['deep']  ?? $stages['Deep']  ?? null;

  // If stages are in seconds, convert if it looks too large
  foreach (['awakeMin','remMin','lightMin','deepMin'] as $k) {
    if ($$k !== null && $$k > 1000) $$k = (int)round($$k / 60);
  }
}

// Derive time in bed and efficiency if possible
$timeInBedMin = $sleep ? ($sleep['time_in_bed_minutes'] ?? null) : null;
$sleepEfficiency = null;
if ($totalSleepMin && $timeInBedMin && $timeInBedMin > 0) {
  $sleepEfficiency = (int)round(($totalSleepMin / $timeInBedMin) * 100);
}

// Score
$sleepScore = $sleep ? (int)($sleep['sleep_score'] ?? 0) : null;

// Times
$sleepStart = $sleep['sleep_start'] ?? null;
$sleepEnd   = $sleep['sleep_end'] ?? null;

// 7-day sleep score bar chart
$start7 = date('Y-m-d', strtotime($selected.' -6 day'));
$sleep7Stmt = db()->prepare("
  SELECT sleep_date AS d, sleep_score AS v
  FROM polar_sleep
  WHERE polar_user_id = ? AND sleep_date BETWEEN ? AND ?
  ORDER BY sleep_date ASC
");
$sleep7Stmt->execute([$polarUserId, $start7, $selected]);
$sleep7 = $sleep7Stmt->fetchAll();

$labels7 = [];
$vals7 = [];
$map7 = [];
foreach ($sleep7 as $r) $map7[$r['d']] = (int)($r['v'] ?? 0);

for ($i=6; $i>=0; $i--){
  $d = date('Y-m-d', strtotime($selected." -{$i} day"));
  $labels7[] = date('D', strtotime($d));
  $vals7[] = $map7[$d] ?? null;
}

// Restorative sleep (REM + Deep) for week view
$restLabels = $labels7;
$remWeek = [];
$deepWeek = [];

$stgStmt = db()->prepare("
  SELECT sleep_date, stages_json
  FROM polar_sleep
  WHERE polar_user_id = ? AND sleep_date BETWEEN ? AND ?
  ORDER BY sleep_date ASC
");
$stgStmt->execute([$polarUserId, $start7, $selected]);
$stgRows = $stgStmt->fetchAll();

$stgMap = [];
foreach ($stgRows as $r){
  $sj = $r['stages_json'] ? json_decode($r['stages_json'], true) : null;
  if (!is_array($sj)) continue;

  $rem = $sj['rem'] ?? $sj['REM'] ?? null;
  $deep = $sj['deep'] ?? $sj['Deep'] ?? null;

  if ($rem !== null && $rem > 1000) $rem = (int)round($rem / 60);
  if ($deep !== null && $deep > 1000) $deep = (int)round($deep / 60);

  $stgMap[$r['sleep_date']] = ['rem'=>(int)($rem ?? 0), 'deep'=>(int)($deep ?? 0)];
}

for ($i=6; $i>=0; $i--){
  $d = date('Y-m-d', strtotime($selected." -{$i} day"));
  $remWeek[]  = $stgMap[$d]['rem']  ?? 0;
  $deepWeek[] = $stgMap[$d]['deep'] ?? 0;
}

// HR during sleep: attempt to read from raw lake if present
$hrSeries = null;
$hrMin = $hrAvg = $hrMax = null;

if ($polarUserId) {
  $rawStmt = db()->prepare("
    SELECT payload_json
    FROM polar_raw_objects
    WHERE polar_user_id = ?
      AND data_type = 'sleep'
      AND object_date = ?
    ORDER BY updated_at DESC
    LIMIT 1
  ");
  $rawStmt->execute([$polarUserId, $sleep ? ($sleep['sleep_date'] ?? $selected) : $selected]);
  $raw = $rawStmt->fetch();

  if ($raw && !empty($raw['payload_json'])) {
    $payload = json_decode($raw['payload_json'], true);

    // Try to locate HR samples in common keys
    // Shapes vary: some APIs have "heart_rate_samples": [..], some have "hr_samples": [..]
    $samples = $payload['heart_rate_samples'] ?? $payload['hr_samples'] ?? $payload['heart_rate'] ?? null;

    if (is_array($samples)) {
      // If it's already a list of bpm values
      if (isset($samples[0]) && is_numeric($samples[0])) {
        $hrSeries = array_map('floatval', $samples);
      }
      // If list of objects with bpm/value
      if (!$hrSeries && isset($samples[0]) && is_array($samples[0])) {
        $tmp = [];
        foreach ($samples as $s) {
          $v = $s['bpm'] ?? $s['value'] ?? $s['hr'] ?? null;
          if ($v !== null && is_numeric($v)) $tmp[] = (float)$v;
        }
        if ($tmp) $hrSeries = $tmp;
      }
    }
  }

  if ($hrSeries && count($hrSeries) > 5) {
    $hrMin = (int)floor(min($hrSeries));
    $hrMax = (int)ceil(max($hrSeries));
    $hrAvg = (int)round(array_sum($hrSeries)/count($hrSeries));
  }
}

// Sleep consistency: bedtime/wake time bars using last 7 days start and end times
$consBed = [];
$consWake = [];
$consHas = false;

$consStmt = db()->prepare("
  SELECT sleep_date, sleep_start, sleep_end
  FROM polar_sleep
  WHERE polar_user_id = ? AND sleep_date BETWEEN ? AND ?
  ORDER BY sleep_date ASC
");
$consStmt->execute([$polarUserId, $start7, $selected]);
$consRows = $consStmt->fetchAll();
$consMap = [];
foreach ($consRows as $r) $consMap[$r['sleep_date']] = $r;

for ($i=6; $i>=0; $i--){
  $d = date('Y-m-d', strtotime($selected." -{$i} day"));
  $r = $consMap[$d] ?? null;

  if ($r && $r['sleep_start'] && $r['sleep_end']) {
    $consHas = true;
    $st = strtotime($r['sleep_start']);
    $en = strtotime($r['sleep_end']);
    // Convert to "minutes since 00:00", with bedtime likely before midnight
    $stMin = (int)date('H', $st) * 60 + (int)date('i', $st);
    $enMin = (int)date('H', $en) * 60 + (int)date('i', $en);

    // If bedtime is evening, keep it as is. We want a chart where 21:00..09:00 maps nicely.
    // We'll shift times so that 12:00 is "0" (noon), making night times continuous.
    $shift = function($m){
      // shift by -12h to move noon to 0
      $x = $m - (12*60);
      if ($x < 0) $x += 24*60;
      return $x;
    };

    $consBed[] = $shift($stMin);
    $consWake[] = $shift($enMin);
  } else {
    $consBed[] = null;
    $consWake[] = null;
  }
}

// helpers
function h($s){ return htmlspecialchars((string)$s); }
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
function pct($part, $whole){
  if ($part === null || $whole === null || $whole <= 0) return null;
  return (int)round(($part / $whole) * 100);
}
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
      <div style="text-align:center;">
        <div class="h1" style="margin:0;">Sleep</div>
        <div class="sub" style="margin-top:2px;">
          <strong><?= h($selected) ?></strong>
        </div>
      </div>
      <a class="btn btn-small" href="/PolarPulse/sleep.php?date=<?= h($next) ?>">→</a>
    </div>

    <div style="height:12px;"></div>

    <div class="card card-pad">
      <div class="row row-2" style="align-items:center;">
        <div class="ring-wrap">
          <?php
            $val = $sleepScore === null ? 0 : max(0, min(100, (int)$sleepScore));
            $label = "Sleep Score";
            $size = 220; // tweak: 220-260 looks closest to your screenshots
            $color = 'rgba(55,242,154,0.95)';
            include __DIR__ . '/_ring.php';
          ?>
        </div>

        <div>
          <div class="sec-title">Sleep Quality</div>
          <div class="sec-sub">Hours vs Needed · Efficiency</div>

          <div style="height:12px;"></div>

          <div class="metric-item">
            <div>
              <div class="metric-name">Hours vs Needed</div>
              <div class="metric-meta"><?= fmt_time_short($sleepStart) ?> → <?= fmt_time_short($sleepEnd) ?></div>
            </div>
            <div class="metric-val good"><?= fmt_mins($totalSleepMin) ?></div>
          </div>

          <div class="metric-item">
            <div>
              <div class="metric-name">Sleep Efficiency</div>
              <div class="metric-meta">Actual sleep / time in bed</div>
            </div>
            <div class="metric-val info"><?= $sleepEfficiency === null ? '–' : $sleepEfficiency.'%' ?></div>
          </div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="sec-title">Sleep Stages</div>
      <div class="sec-sub">Awake · REM · Light · Deep</div>

      <div style="height:10px;"></div>

      <div class="metric-list">
        <div class="metric-item">
          <div>
            <div class="metric-name">Awake</div>
            <div class="metric-meta"><?= ($awakeMin !== null && $totalSleepMin) ? pct($awakeMin, ($timeInBedMin ?: ($totalSleepMin+$awakeMin))).'%' : '' ?></div>
          </div>
          <div class="metric-val"><?= $awakeMin === null ? '–' : fmt_mins($awakeMin) ?></div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">REM Sleep</div>
            <div class="metric-meta"><?= ($remMin !== null && $totalSleepMin) ? pct($remMin, $totalSleepMin).'%' : '' ?></div>
          </div>
          <div class="metric-val" style="color: var(--purple);"><?= $remMin === null ? '–' : fmt_mins($remMin) ?></div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">Light Sleep</div>
            <div class="metric-meta"><?= ($lightMin !== null && $totalSleepMin) ? pct($lightMin, $totalSleepMin).'%' : '' ?></div>
          </div>
          <div class="metric-val info"><?= $lightMin === null ? '–' : fmt_mins($lightMin) ?></div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">Deep Sleep</div>
            <div class="metric-meta"><?= ($deepMin !== null && $totalSleepMin) ? pct($deepMin, $totalSleepMin).'%' : '' ?></div>
          </div>
          <div class="metric-val" style="color: var(--red);"><?= $deepMin === null ? '–' : fmt_mins($deepMin) ?></div>
        </div>
      </div>
    </div>

    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="sec-title">Heart Rate During Sleep</div>
          <div class="sec-sub">Min · Avg · Max</div>
        </div>
        <span class="pill"><span class="dot blue"></span><?= $hrSeries ? 'Available' : 'Not yet' ?></span>
      </div>

      <?php if (!$hrSeries): ?>
        <div class="sub" style="margin-top:10px;">
          Heart rate series isn’t available yet from your stored payloads for this date.
          Once your raw sleep payload includes HR samples, this chart will automatically populate.
        </div>
      <?php else: ?>
        <div class="chart-box" style="height:200px;">
          <canvas id="chartHrSleep"></canvas>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;color:var(--muted);font-weight:800;">
          <div>Min<br><span style="color:var(--text);font-weight:950;"><?= (int)$hrMin ?> bpm</span></div>
          <div style="text-align:center;">Avg<br><span style="color:var(--text);font-weight:950;"><?= (int)$hrAvg ?> bpm</span></div>
          <div style="text-align:right;">Max<br><span style="color:var(--text);font-weight:950;"><?= (int)$hrMax ?> bpm</span></div>
        </div>
      <?php endif; ?>
    </div>

    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="sec-title">Sleep Consistency</div>
          <div class="sec-sub">Bedtime and wake time (7 days)</div>
        </div>
        <span class="pill"><span class="dot green"></span>7d</span>
      </div>

      <?php if (!$consHas): ?>
        <div class="sub" style="margin-top:10px;">
          Consistency needs at least a few days of sleep start/end times in the database.
        </div>
      <?php else: ?>
        <div class="chart-box" style="height:220px;">
          <canvas id="chartConsistency"></canvas>
        </div>
        <div class="sub" style="margin-top:8px;">
          Times are plotted on a night-friendly scale so late bedtimes remain continuous.
        </div>
      <?php endif; ?>
    </div>

    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="sec-title">Restorative Sleep</div>
          <div class="sec-sub">Deep + REM (week)</div>
        </div>
        <span class="pill"><span class="dot purple"></span>Week</span>
      </div>

      <div class="chart-box" style="height:220px;">
        <canvas id="chartRestorative"></canvas>
      </div>
      <div class="sub" style="margin-top:8px;">
        We can add your own target line once we decide a baseline.
      </div>
    </div>

    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="sec-title">Sleep Score</div>
          <div class="sec-sub">7-day trend</div>
        </div>
        <span class="pill"><span class="dot blue"></span>7d</span>
      </div>

      <div class="chart-box" style="height:220px;">
        <canvas id="chartSleepScore"></canvas>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;color:var(--muted);font-weight:800;">
        <?php
          $valsNonNull = array_values(array_filter($vals7, fn($v)=>$v !== null));
          $avg = $valsNonNull ? (int)round(array_sum($valsNonNull)/count($valsNonNull)) : null;
          $mx = $valsNonNull ? max($valsNonNull) : null;
          $mn = $valsNonNull ? min($valsNonNull) : null;
        ?>
        <div>AVG<br><span style="color:var(--text);font-weight:950;"><?= $avg ?? '–' ?></span></div>
        <div style="text-align:center;">MAX<br><span style="color:var(--text);font-weight:950;"><?= $mx ?? '–' ?></span></div>
        <div style="text-align:right;">MIN<br><span style="color:var(--text);font-weight:950;"><?= $mn ?? '–' ?></span></div>
      </div>
    </div>

  </main>

  <?php include __DIR__ . '/_tabbar.php'; ?>

  <script>
    // Sleep Score chart (bar)
    const labels7 = <?= json_encode($labels7) ?>;
    const vals7 = <?= json_encode($vals7) ?>;

    new Chart(document.getElementById('chartSleepScore'), {
      type: 'bar',
      data: {
        labels: labels7,
        datasets: [{
          label: 'Sleep Score',
          data: vals7,
          borderWidth: 0,
          borderRadius: 10,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true }
        },
        scales: {
          x: { ticks: { color: 'rgba(233,238,247,.55)' }, grid: { display: false } },
          y: { beginAtZero: true, max: 100, ticks: { color: 'rgba(233,238,247,.55)' }, grid: { color: 'rgba(255,255,255,.06)' } }
        }
      }
    });

    // Restorative Sleep stacked bars (Deep + REM)
    const remWeek = <?= json_encode($remWeek) ?>;
    const deepWeek = <?= json_encode($deepWeek) ?>;

    new Chart(document.getElementById('chartRestorative'), {
      type: 'bar',
      data: {
        labels: labels7,
        datasets: [
          { label: 'Deep', data: deepWeek, stack: 's', borderRadius: 10 },
          { label: 'REM', data: remWeek, stack: 's', borderRadius: 10 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: 'rgba(233,238,247,.75)' } }
        },
        scales: {
          x: { stacked: true, ticks: { color: 'rgba(233,238,247,.55)' }, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { color: 'rgba(233,238,247,.55)' }, grid: { color: 'rgba(255,255,255,.06)' } }
        }
      }
    });

    <?php if ($hrSeries && count($hrSeries) > 5): ?>
    // HR during sleep
    const hrSeries = <?= json_encode(array_values($hrSeries)) ?>;
    const hrLabels = hrSeries.map((_, i) => i);

    new Chart(document.getElementById('chartHrSleep'), {
      type: 'line',
      data: {
        labels: hrLabels,
        datasets: [{
          label: 'HR',
          data: hrSeries,
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
    <?php endif; ?>

    <?php if ($consHas): ?>
    // Consistency chart (bed + wake as bars)
    const bed = <?= json_encode($consBed) ?>;
    const wake = <?= json_encode($consWake) ?>;

    new Chart(document.getElementById('chartConsistency'), {
      type: 'bar',
      data: {
        labels: labels7,
        datasets: [
          { label: 'Bedtime', data: bed, borderRadius: 10 },
          { label: 'Wake', data: wake, borderRadius: 10 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: 'rgba(233,238,247,.75)' } } },
        scales: {
          x: { ticks: { color: 'rgba(233,238,247,.55)' }, grid: { display: false } },
          y: {
            beginAtZero: true,
            max: 24*60,
            ticks: {
              color: 'rgba(233,238,247,.55)',
              callback: (v) => {
                // invert the shift used in PHP (noon=0)
                let m = v + (12*60);
                m = m % (24*60);
                const hh = String(Math.floor(m/60)).padStart(2,'0');
                const mm = String(m%60).padStart(2,'0');
                return `${hh}:${mm}`;
              }
            },
            grid: { color: 'rgba(255,255,255,.06)' }
          }
        }
      }
    });
    <?php endif; ?>
  </script>
</body>
</html>