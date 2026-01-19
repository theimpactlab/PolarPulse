<?php
require_once __DIR__ . '/lib_polar.php';
require_basic_auth();

$page_title = "Recovery";

// active user
$u = db()->query("SELECT * FROM polar_users WHERE is_active=1 ORDER BY id DESC LIMIT 1")->fetch();
$polarUserId = $u['polar_user_id'] ?? '';

$today = date('Y-m-d');
$yday  = date('Y-m-d', strtotime('-1 day'));

// Default to yesterday (recovery is usually for the night that just happened)
$selected = $_GET['date'] ?? $yday;
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $selected)) $selected = $yday;

$prev = date('Y-m-d', strtotime($selected.' -1 day'));
$next = date('Y-m-d', strtotime($selected.' +1 day'));

// Load nightly recharge row
$nrStmt = db()->prepare("
  SELECT * FROM polar_nightly_recharge
  WHERE polar_user_id = ? AND recharge_date = ?
  LIMIT 1
");
$nrStmt->execute([$polarUserId, $selected]);
$nr = $nrStmt->fetch();

// Fallback: if not found, try +/- 1 day
if (!$nr) {
  $nrStmt->execute([$polarUserId, $prev]);
  $nr = $nrStmt->fetch();
  if (!$nr) {
    $nrStmt->execute([$polarUserId, $next]);
    $nr = $nrStmt->fetch();
  }
}

// 7-day trends
$start7 = date('Y-m-d', strtotime($selected.' -6 day'));

$trendStmt = db()->prepare("
  SELECT recharge_date AS d, ans_charge, hrv_avg_ms, rhr_avg, recharge_status
  FROM polar_nightly_recharge
  WHERE polar_user_id = ? AND recharge_date BETWEEN ? AND ?
  ORDER BY recharge_date ASC
");
$trendStmt->execute([$polarUserId, $start7, $selected]);
$trendRows = $trendStmt->fetchAll();

$trendMap = [];
foreach ($trendRows as $r) $trendMap[$r['d']] = $r;

$labels7 = [];
$ans7 = [];
$hrv7 = [];
$rhr7 = [];
$status7 = [];

for ($i=6; $i>=0; $i--){
  $d = date('Y-m-d', strtotime($selected." -{$i} day"));
  $labels7[] = date('D', strtotime($d));

  $row = $trendMap[$d] ?? null;
  $ans7[] = $row && $row['ans_charge'] !== null ? (float)$row['ans_charge'] : null;
  $hrv7[] = $row && $row['hrv_avg_ms'] !== null ? (float)$row['hrv_avg_ms'] : null;
  $rhr7[] = $row && $row['rhr_avg'] !== null ? (float)$row['rhr_avg'] : null;
  $status7[] = $row['recharge_status'] ?? null;
}

// Recovery score approximation
// If ans_charge looks like 0..100, use it. If it looks like -10..+10, map it.
$recoveryScore = null;
$ansVal = null;
if ($nr && $nr['ans_charge'] !== null && $nr['ans_charge'] !== '') {
  $ansVal = (float)$nr['ans_charge'];
  $recoveryScore = ($ansVal > 20)
    ? (int)round(max(0, min(100, $ansVal)))
    : (int)round(max(0, min(100, (($ansVal + 10) / 20) * 100)));
} elseif ($nr && $nr['hrv_avg_ms'] !== null) {
  $hrv = (float)$nr['hrv_avg_ms'];
  // rough mapping 20ms->0, 80ms->100
  $recoveryScore = (int)round(max(0, min(100, (($hrv - 20) / 60) * 100)));
}

// Other key metrics
$hrvAvg = $nr['hrv_avg_ms'] ?? null;
$rhrAvg = $nr['rhr_avg'] ?? null;
$rechargeStatus = $nr['recharge_status'] ?? null;

// Read a richer raw payload (optional) to later add more whoop-like metrics
$rawPayload = null;
if ($polarUserId) {
  $rawStmt = db()->prepare("
    SELECT payload_json
    FROM polar_raw_objects
    WHERE polar_user_id = ?
      AND data_type = 'nightly_recharge'
      AND object_date = ?
    ORDER BY updated_at DESC
    LIMIT 1
  ");
  $objDate = $nr ? ($nr['recharge_date'] ?? $selected) : $selected;
  $rawStmt->execute([$polarUserId, $objDate]);
  $raw = $rawStmt->fetch();
  if ($raw && !empty($raw['payload_json'])) {
    $tmp = json_decode($raw['payload_json'], true);
    if (is_array($tmp)) $rawPayload = $tmp;
  }
}

// A couple of common extra fields if present in raw payload
$extra = [
  'hrv_min' => null,
  'hrv_max' => null,
  'rhr_min' => null,
  'rhr_max' => null,
  'ans_status' => null,
];
if (is_array($rawPayload)) {
  $extra['hrv_min'] = $rawPayload['hrv_min'] ?? $rawPayload['hrvMinimum'] ?? null;
  $extra['hrv_max'] = $rawPayload['hrv_max'] ?? $rawPayload['hrvMaximum'] ?? null;
  $extra['rhr_min'] = $rawPayload['rhr_min'] ?? $rawPayload['rhrMinimum'] ?? null;
  $extra['rhr_max'] = $rawPayload['rhr_max'] ?? $rawPayload['rhrMaximum'] ?? null;
  $extra['ans_status'] = $rawPayload['ans_status'] ?? $rawPayload['ANSStatus'] ?? null;
}

// KPI stats for 7 days
function stats($arr){
  $vals = array_values(array_filter($arr, fn($v)=>$v !== null));
  if (!$vals) return [null,null,null];
  $avg = array_sum($vals)/count($vals);
  return [ (float)$avg, min($vals), max($vals) ];
}
[$ansAvg7, $ansMin7, $ansMax7] = stats($ans7);
[$hrvAvg7, $hrvMin7, $hrvMax7] = stats($hrv7);
[$rhrAvg7, $rhrMin7, $rhrMax7] = stats($rhr7);

// Helpers
function h($s){ return htmlspecialchars((string)$s); }
function fmt_1($n){
  if ($n === null || $n === '') return '–';
  return number_format((float)$n, 1);
}
function fmt_0($n){
  if ($n === null || $n === '') return '–';
  return number_format((float)$n, 0);
}
function score_color($score){
  if ($score === null) return 'var(--blue)';
  if ($score >= 67) return 'var(--green)';
  if ($score >= 34) return 'var(--orange)';
  return 'var(--red)';
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
        <div class="h1" style="margin:0;">Recovery</div>
        <div class="sub" style="margin-top:2px;"><strong><?= h($selected) ?></strong></div>
      </div>
      <a class="btn btn-small" href="/PolarPulse/recovery.php?date=<?= h($next) ?>">→</a>
    </div>

    <div style="height:12px;"></div>

    <div class="card card-pad">
      <div class="row row-2" style="align-items:center;">
        <div class="ring-wrap">
          <?php
            $rec = $recoveryScore === null ? 0 : max(0, min(100, (int)$recoveryScore));
            $recColor = score_color($recoveryScore);
          ?>
          <div class="ring" style="--pct:<?= $rec ?>; --ringColor: <?= h($recColor) ?>; width: 180px; height: 180px;">
            <div class="ring-center">
              <div class="ring-val" style="font-size:3.1rem;"><?= $recoveryScore === null ? '–' : (int)$recoveryScore ?></div>
              <div class="ring-lab" style="font-size:.9rem;">Recovery</div>
            </div>
          </div>
        </div>

        <div>
          <div class="sec-title">Readiness</div>
          <div class="sec-sub">ANS · HRV · Resting HR</div>

          <div style="height:12px;"></div>

          <div class="metric-item">
            <div>
              <div class="metric-name">Recovery Status</div>
              <div class="metric-meta">Polar nightly recharge</div>
            </div>
            <div class="metric-val info"><?= h($rechargeStatus ?? '–') ?></div>
          </div>

          <div class="metric-item">
            <div>
              <div class="metric-name">ANS Charge</div>
              <div class="metric-meta">Nightly</div>
            </div>
            <div class="metric-val good"><?= $ansVal === null ? '–' : fmt_1($ansVal) ?></div>
          </div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="sec-title">Key Metrics</div>
      <div class="sec-sub">These are the building blocks for Whoop-style recovery</div>

      <div style="height:10px;"></div>

      <div class="metric-list">
        <div class="metric-item">
          <div>
            <div class="metric-name">HRV (avg)</div>
            <div class="metric-meta">Nightly average</div>
          </div>
          <div class="metric-val"><?= $hrvAvg === null ? '–' : fmt_0($hrvAvg).' ms' ?></div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">Resting HR (avg)</div>
            <div class="metric-meta">Nightly average</div>
          </div>
          <div class="metric-val"><?= $rhrAvg === null ? '–' : fmt_0($rhrAvg).' bpm' ?></div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">HRV Range</div>
            <div class="metric-meta">If available in raw payload</div>
          </div>
          <div class="metric-val">
            <?php if ($extra['hrv_min'] !== null || $extra['hrv_max'] !== null): ?>
              <?= fmt_0($extra['hrv_min']) ?>–<?= fmt_0($extra['hrv_max']) ?> ms
            <?php else: ?>
              –
            <?php endif; ?>
          </div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">RHR Range</div>
            <div class="metric-meta">If available in raw payload</div>
          </div>
          <div class="metric-val">
            <?php if ($extra['rhr_min'] !== null || $extra['rhr_max'] !== null): ?>
              <?= fmt_0($extra['rhr_min']) ?>–<?= fmt_0($extra['rhr_max']) ?> bpm
            <?php else: ?>
              –
            <?php endif; ?>
          </div>
        </div>
      </div>
    </div>

    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="sec-title">Recovery Trends</div>
          <div class="sec-sub">Last 7 days</div>
        </div>
        <span class="pill"><span class="dot green"></span>7d</span>
      </div>

      <div style="height:10px;"></div>

      <div class="sec-title" style="font-size:1rem;">ANS Charge</div>
      <div class="chart-box" style="height:210px;margin-top:8px;">
        <canvas id="chartAns"></canvas>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;color:var(--muted);font-weight:800;">
        <div>AVG<br><span style="color:var(--text);font-weight:950;"><?= $ansAvg7 === null ? '–' : fmt_1($ansAvg7) ?></span></div>
        <div style="text-align:center;">MAX<br><span style="color:var(--text);font-weight:950;"><?= $ansMax7 === null ? '–' : fmt_1($ansMax7) ?></span></div>
        <div style="text-align:right;">MIN<br><span style="color:var(--text);font-weight:950;"><?= $ansMin7 === null ? '–' : fmt_1($ansMin7) ?></span></div>
      </div>

      <div style="height:14px;"></div>

      <div class="sec-title" style="font-size:1rem;">HRV (ms)</div>
      <div class="chart-box" style="height:210px;margin-top:8px;">
        <canvas id="chartHrv"></canvas>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;color:var(--muted);font-weight:800;">
        <div>AVG<br><span style="color:var(--text);font-weight:950;"><?= $hrvAvg7 === null ? '–' : fmt_0($hrvAvg7) ?></span></div>
        <div style="text-align:center;">MAX<br><span style="color:var(--text);font-weight:950;"><?= $hrvMax7 === null ? '–' : fmt_0($hrvMax7) ?></span></div>
        <div style="text-align:right;">MIN<br><span style="color:var(--text);font-weight:950;"><?= $hrvMin7 === null ? '–' : fmt_0($hrvMin7) ?></span></div>
      </div>

      <div style="height:14px;"></div>

      <div class="sec-title" style="font-size:1rem;">Resting HR (bpm)</div>
      <div class="chart-box" style="height:210px;margin-top:8px;">
        <canvas id="chartRhr"></canvas>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;color:var(--muted);font-weight:800;">
        <div>AVG<br><span style="color:var(--text);font-weight:950;"><?= $rhrAvg7 === null ? '–' : fmt_0($rhrAvg7) ?></span></div>
        <div style="text-align:center;">MAX<br><span style="color:var(--text);font-weight:950;"><?= $rhrMax7 === null ? '–' : fmt_0($rhrMax7) ?></span></div>
        <div style="text-align:right;">MIN<br><span style="color:var(--text);font-weight:950;"><?= $rhrMin7 === null ? '–' : fmt_0($rhrMin7) ?></span></div>
      </div>
    </div>

  </main>

  <?php include __DIR__ . '/_tabbar.php'; ?>

  <script>
    const labels7 = <?= json_encode($labels7) ?>;

    const ans7 = <?= json_encode($ans7) ?>;
    const hrv7 = <?= json_encode($hrv7) ?>;
    const rhr7 = <?= json_encode($rhr7) ?>;

    function lineChart(id, dataArr, yMax=null){
      const el = document.getElementById(id);
      if (!el) return;

      new Chart(el, {
        type: 'line',
        data: {
          labels: labels7,
          datasets: [{
            data: dataArr,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 2,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: 'rgba(233,238,247,.55)' }, grid: { display: false } },
            y: {
              beginAtZero: false,
              max: yMax ?? undefined,
              ticks: { color: 'rgba(233,238,247,.55)' },
              grid: { color: 'rgba(255,255,255,.06)' }
            }
          }
        }
      });
    }

    lineChart('chartAns', ans7);
    lineChart('chartHrv', hrv7);
    lineChart('chartRhr', rhr7);
  </script>
</body>
</html>