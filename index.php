<?php
require_once __DIR__ . '/lib_polar.php';
require_basic_auth();

$u = db()->query("SELECT * FROM polar_users WHERE is_active=1 ORDER BY id DESC LIMIT 1")->fetch();
$polarUserId = $u['polar_user_id'] ?? '';

$lastLog = db()->query("SELECT * FROM polar_sync_log ORDER BY id DESC LIMIT 1")->fetch();
$lastOk  = db()->query("SELECT * FROM polar_sync_log WHERE level='INFO' AND message LIKE '%Sync finished%' ORDER BY id DESC LIMIT 1")->fetch();

$counts = db()->query("
  SELECT
    (SELECT COUNT(*) FROM polar_exercises) AS exercises,
    (SELECT COUNT(*) FROM polar_daily_activity) AS activities,
    (SELECT COUNT(*) FROM polar_sleep) AS sleep,
    (SELECT COUNT(*) FROM polar_nightly_recharge) AS recharge,
    (SELECT COUNT(*) FROM polar_raw_objects) AS raw_objects
")->fetch();

$latest = db()->query("
  SELECT
    (SELECT MAX(start_time) FROM polar_exercises) AS last_workout,
    (SELECT MAX(activity_date) FROM polar_daily_activity) AS last_activity_day,
    (SELECT MAX(sleep_date) FROM polar_sleep) AS last_sleep_day,
    (SELECT MAX(recharge_date) FROM polar_nightly_recharge) AS last_recharge_day
")->fetch();

function h($s){ return htmlspecialchars((string)$s); }
function fmt_int($n){ return number_format((int)$n); }
function badge_class($lvl){
  if ($lvl === 'ERROR') return 'bad';
  if ($lvl === 'WARN') return 'warn';
  return 'ok';
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>PolarPulse</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">

  <style>
    :root{
      --bg0:#070A0F;
      --bg1:#0B1020;
      --card:rgba(255,255,255,.04);
      --card2:rgba(255,255,255,.06);
      --stroke:rgba(255,255,255,.10);
      --text:#E9EEF7;
      --muted:rgba(233,238,247,.65);
      --accent:#37F29A;
      --accent2:#69D2FF;
      --danger:#FF5470;
      --warn:#FFC857;
      --shadow: 0 12px 40px rgba(0,0,0,.35);
      --r:16px;
    }

    body{
      background: radial-gradient(1200px 600px at 20% 0%, rgba(55,242,154,.10), transparent 60%),
                  radial-gradient(900px 500px at 90% 0%, rgba(105,210,255,.10), transparent 55%),
                  linear-gradient(180deg, var(--bg1), var(--bg0));
      color: var(--text);
    }

    .pp-card{
      background: linear-gradient(180deg, var(--card2), var(--card));
      border: 1px solid var(--stroke);
      border-radius: var(--r);
      box-shadow: var(--shadow);
    }
    .pp-card .card-body{ padding: 14px; }

    .pp-title{ font-size: 1.2rem; font-weight: 900; letter-spacing:.2px; margin:0; }
    .pp-sub{ color: var(--muted); font-size: .9rem; }

    .chip{
      display:inline-flex; align-items:center; gap:8px;
      padding: 6px 10px; border-radius: 999px;
      border: 1px solid var(--stroke);
      background: rgba(255,255,255,.03);
      color: var(--muted);
      font-size: .82rem;
      font-weight: 800;
      white-space: nowrap;
    }
    .dot{ width:8px; height:8px; border-radius:50%; display:inline-block; }
    .dot.ok{ background: var(--accent); box-shadow: 0 0 18px rgba(55,242,154,.45); }
    .dot.warn{ background: var(--warn); box-shadow: 0 0 18px rgba(255,200,87,.35); }
    .dot.bad{ background: var(--danger); box-shadow: 0 0 18px rgba(255,84,112,.35); }
    .dot.info{ background: var(--accent2); box-shadow: 0 0 18px rgba(105,210,255,.35); }

    .tile{
      padding: 14px;
      border-radius: var(--r);
      border: 1px solid var(--stroke);
      background: rgba(255,255,255,.035);
      height: 100%;
    }
    .tile-label{ color: var(--muted); font-size: .78rem; }
    .tile-value{ font-size: 1.7rem; font-weight: 950; line-height: 1.05; margin-top: 6px; }

    .pp-btn{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap: 12px;
      text-decoration:none;
      border-radius: 16px;
      border: 1px solid var(--stroke);
      background: rgba(255,255,255,.03);
      padding: 14px;
      color: var(--text);
      font-weight: 900;
    }
    .pp-btn:hover{ background: rgba(255,255,255,.05); color: var(--text); }
    .pp-btn small{ color: var(--muted); font-weight: 800; }
    .arrow{ color: rgba(105,210,255,.85); font-weight: 900; }

    pre{ white-space: pre-wrap; word-break: break-word; color: rgba(233,238,247,.85); margin: 0; }
    details summary{ cursor:pointer; color: rgba(105,210,255,.85); font-size: .86rem; }
  </style>
</head>
<body>
<?php include __DIR__ . '/_nav.php'; ?>

<main class="container py-4">

  <div class="d-flex align-items-end justify-content-between flex-wrap gap-2 mb-3">
    <div>
      <h1 class="pp-title">PolarPulse</h1>
      <div class="pp-sub">Dashboard backed by MySQL, with full raw payload storage for future features.</div>
    </div>

    <div class="d-flex gap-2 flex-wrap">
      <span class="chip"><span class="dot info"></span><?= $polarUserId ? 'User ' . h($polarUserId) : 'No active user' ?></span>

      <?php
        $lvl = $lastLog['level'] ?? '';
        $cls = badge_class($lvl);
        $dot = $cls === 'ok' ? 'ok' : ($cls === 'warn' ? 'warn' : 'bad');
      ?>
      <span class="chip"><span class="dot <?= $dot ?>"></span><?= h($lvl ?: 'NO LOGS') ?></span>
    </div>
  </div>

  <!-- Quick links -->
  <div class="row g-3 mb-3">
    <div class="col-12 col-md-6 col-lg-3">
      <a class="pp-btn" href="/PolarPulse/today.php">
        <div>
          Today<br><small>Sleep + Recovery + Activity</small>
        </div>
        <div class="arrow">›</div>
      </a>
    </div>
    <div class="col-12 col-md-6 col-lg-3">
      <a class="pp-btn" href="/PolarPulse/fitness.php">
        <div>
          Fitness<br><small>Workouts + trends</small>
        </div>
        <div class="arrow">›</div>
      </a>
    </div>
    <div class="col-12 col-md-6 col-lg-3">
      <a class="pp-btn" href="/PolarPulse/sleep.php">
        <div>
          Sleep<br><small>Nights + charts</small>
        </div>
        <div class="arrow">›</div>
      </a>
    </div>
    <div class="col-12 col-md-6 col-lg-3">
      <a class="pp-btn" href="/PolarPulse/recovery.php">
        <div>
          Recovery<br><small>ANS + HRV + RHR</small>
        </div>
        <div class="arrow">›</div>
      </a>
    </div>
  </div>

  <!-- Totals -->
  <div class="row g-3 mb-3">
    <div class="col-6 col-lg-3">
      <div class="tile">
        <div class="tile-label">Workouts stored</div>
        <div class="tile-value"><?= fmt_int($counts['exercises'] ?? 0) ?></div>
        <div class="pp-sub mt-2">Last: <?= h($latest['last_workout'] ?? '–') ?></div>
      </div>
    </div>
    <div class="col-6 col-lg-3">
      <div class="tile">
        <div class="tile-label">Activity days</div>
        <div class="tile-value"><?= fmt_int($counts['activities'] ?? 0) ?></div>
        <div class="pp-sub mt-2">Last: <?= h($latest['last_activity_day'] ?? '–') ?></div>
      </div>
    </div>
    <div class="col-6 col-lg-3">
      <div class="tile">
        <div class="tile-label">Sleep nights</div>
        <div class="tile-value"><?= fmt_int($counts['sleep'] ?? 0) ?></div>
        <div class="pp-sub mt-2">Last: <?= h($latest['last_sleep_day'] ?? '–') ?></div>
      </div>
    </div>
    <div class="col-6 col-lg-3">
      <div class="tile">
        <div class="tile-label">Recovery nights</div>
        <div class="tile-value"><?= fmt_int($counts['recharge'] ?? 0) ?></div>
        <div class="pp-sub mt-2">Last: <?= h($latest['last_recharge_day'] ?? '–') ?></div>
      </div>
    </div>
  </div>

  <!-- Raw storage + Sync status -->
  <div class="row g-3">
    <div class="col-12 col-lg-5">
      <div class="pp-card h-100">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center">
            <div class="pp-title" style="font-size:1rem;">Raw data lake</div>
            <span class="chip"><span class="dot info"></span><?= fmt_int($counts['raw_objects'] ?? 0) ?> objects</span>
          </div>
          <div class="pp-sub mt-2">
            Every API payload is stored in <code>polar_raw_objects</code> so you can build features later without changing ingestion.
          </div>
          <div class="pp-sub mt-3">
            Next: we can add a “Raw Explorer” page that filters raw objects by type/date and shows payloads.
          </div>
        </div>
      </div>
    </div>

    <div class="col-12 col-lg-7">
      <div class="pp-card h-100">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center">
            <div class="pp-title" style="font-size:1rem;">Sync status</div>
            <span class="chip">
              <span class="dot <?= ($lastOk ? 'ok' : 'bad') ?>"></span>
              <?= $lastOk ? 'Last finished ' . h($lastOk['ran_at'] ?? '') : 'No successful sync yet' ?>
            </span>
          </div>

          <?php if ($lastLog): ?>
            <div class="pp-sub mt-2">
              Latest log entry: <strong><?= h($lastLog['level'] ?? '') ?></strong>
              · <?= h($lastLog['ran_at'] ?? '') ?>
            </div>

            <details class="mt-3">
              <summary>Show latest message</summary>
              <div class="mt-2">
                <pre class="small"><?= h($lastLog['message'] ?? '') ?></pre>
              </div>
            </details>

            <details class="mt-2">
              <summary>Show last 20 log rows</summary>
              <div class="mt-2">
                <?php
                  $logs = db()->query("SELECT ran_at, level, polar_user_id, message FROM polar_sync_log ORDER BY id DESC LIMIT 20")->fetchAll();
                ?>
                <div class="table-responsive">
                  <table class="table table-sm table-hover mb-0" style="color: var(--text);">
                    <thead>
                      <tr>
                        <th style="color: var(--muted);">Time</th>
                        <th style="color: var(--muted);">Level</th>
                        <th style="color: var(--muted);">User</th>
                        <th style="color: var(--muted);">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php foreach ($logs as $r): ?>
                        <tr>
                          <td><?= h($r['ran_at'] ?? '') ?></td>
                          <td><?= h($r['level'] ?? '') ?></td>
                          <td><?= h($r['polar_user_id'] ?? '') ?></td>
                          <td><?= h($r['message'] ?? '') ?></td>
                        </tr>
                      <?php endforeach; ?>
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          <?php else: ?>
            <div class="pp-sub mt-2">No logs yet. Use “Sync now” in the nav.</div>
          <?php endif; ?>

        </div>
      </div>
    </div>
  </div>

</main>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>