<?php
require_once __DIR__ . '/lib_polar.php';
require_basic_auth();

$page_title = "Profile";

// Active user
$u = db()->query("SELECT * FROM polar_users WHERE is_active=1 ORDER BY id DESC LIMIT 1")->fetch();
$polarUserId = $u['polar_user_id'] ?? '';
$appUserKey  = $u['app_user_key'] ?? '';
$isActive    = (int)($u['is_active'] ?? 0);

// Counts + last timestamps
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
    (SELECT MAX(updated_at) FROM polar_raw_objects) AS last_raw_update,
    (SELECT MAX(start_time) FROM polar_exercises) AS last_workout,
    (SELECT MAX(activity_date) FROM polar_daily_activity) AS last_activity_day,
    (SELECT MAX(sleep_date) FROM polar_sleep) AS last_sleep_day,
    (SELECT MAX(recharge_date) FROM polar_nightly_recharge) AS last_recharge_day
")->fetch();

// Logs
$lastLog = db()->query("SELECT * FROM polar_sync_log ORDER BY id DESC LIMIT 1")->fetch();
$recentLogs = db()->query("SELECT ran_at, level, polar_user_id, message FROM polar_sync_log ORDER BY id DESC LIMIT 30")->fetchAll();

function h($s){ return htmlspecialchars((string)$s); }
function fmt_int($n){ return number_format((int)$n); }
function lvl_dot($lvl){
  if ($lvl === 'ERROR') return 'red';
  if ($lvl === 'WARN') return 'orange';
  return 'green';
}

// Manual sync endpoint (we’ll call sync.php with a secret stored in config.php)
$syncUrl = '/PolarPulse/sync.php';

// IMPORTANT:
// Put this in config.php (or hardcode, but config is better):
// define('SYNC_SECRET', '...strong random...');
// and set sync.php to check against SYNC_SECRET constant instead of a literal string.
$syncSecret = defined('SYNC_SECRET') ? SYNC_SECRET : '';
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
        <div class="h1" style="margin:0;">Profile</div>
        <div class="sub" style="margin-top:2px;">PolarPulse settings and sync</div>
      </div>
      <span class="pill"><span class="dot blue"></span>v1</span>
    </div>

    <div style="height:12px;"></div>

    <!-- User card -->
    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div>
          <div class="sec-title">Account</div>
          <div class="sec-sub">Connected Polar user</div>
        </div>
        <span class="pill"><span class="dot <?= $isActive ? 'green' : 'red' ?>"></span><?= $isActive ? 'Active' : 'Inactive' ?></span>
      </div>

      <div style="height:10px;"></div>

      <div class="metric-list">
        <div class="metric-item">
          <div>
            <div class="metric-name">Polar User ID</div>
            <div class="metric-meta">Stored in polar_users</div>
          </div>
          <div class="metric-val"><?= $polarUserId ? h($polarUserId) : '–' ?></div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">App User Key</div>
            <div class="metric-meta">Local identifier</div>
          </div>
          <div class="metric-val"><?= $appUserKey ? h($appUserKey) : '–' ?></div>
        </div>
      </div>
    </div>

    <!-- Manual Sync -->
    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="sec-title">Sync</div>
          <div class="sec-sub">Pull latest data from Polar into MySQL</div>
        </div>
        <span class="pill">
          <span class="dot <?= $lastLog ? lvl_dot($lastLog['level'] ?? '') : 'blue' ?>"></span>
          <?= $lastLog ? h($lastLog['level'] ?? '') : 'No logs' ?>
        </span>
      </div>

      <div style="height:10px;"></div>

      <div class="metric-item">
        <div>
          <div class="metric-name">Last raw update</div>
          <div class="metric-meta">polar_raw_objects.updated_at</div>
        </div>
        <div class="metric-val info"><?= h($latest['last_raw_update'] ?? '–') ?></div>
      </div>

      <div style="height:12px;"></div>

      <button id="btnSync" class="btn btn-primary" style="width:100%;">
        <span id="syncLabel">Sync now</span>
      </button>

      <div id="syncToast" class="sub" style="margin-top:10px;display:none;"></div>

      <div class="sub" style="margin-top:10px;">
        Tip: keep your cron running every 30 minutes and use this for “pull now”.
      </div>
    </div>

    <!-- Storage -->
    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="sec-title">Data stored</div>
          <div class="sec-sub">Your local data lake and summaries</div>
        </div>
        <span class="pill"><span class="dot blue"></span><?= fmt_int($counts['raw_objects'] ?? 0) ?> raw</span>
      </div>

      <div class="metric-list">
        <div class="metric-item">
          <div>
            <div class="metric-name">Workouts</div>
            <div class="metric-meta">polar_exercises</div>
          </div>
          <div class="metric-val"><?= fmt_int($counts['exercises'] ?? 0) ?></div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">Activity days</div>
            <div class="metric-meta">polar_daily_activity</div>
          </div>
          <div class="metric-val"><?= fmt_int($counts['activities'] ?? 0) ?></div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">Sleep nights</div>
            <div class="metric-meta">polar_sleep</div>
          </div>
          <div class="metric-val"><?= fmt_int($counts['sleep'] ?? 0) ?></div>
        </div>

        <div class="metric-item">
          <div>
            <div class="metric-name">Recovery nights</div>
            <div class="metric-meta">polar_nightly_recharge</div>
          </div>
          <div class="metric-val"><?= fmt_int($counts['recharge'] ?? 0) ?></div>
        </div>
      </div>

      <div class="hr"></div>

      <div class="sec-title" style="font-size:1rem;">Latest data</div>
      <div class="sec-sub">Quick sanity check</div>

      <div style="height:10px;"></div>

      <div class="metric-list">
        <div class="metric-item">
          <div>
            <div class="metric-name">Last workout</div>
            <div class="metric-meta">polar_exercises.start_time</div>
          </div>
          <div class="metric-val"><?= h($latest['last_workout'] ?? '–') ?></div>
        </div>
        <div class="metric-item">
          <div>
            <div class="metric-name">Last activity day</div>
            <div class="metric-meta">polar_daily_activity.activity_date</div>
          </div>
          <div class="metric-val"><?= h($latest['last_activity_day'] ?? '–') ?></div>
        </div>
        <div class="metric-item">
          <div>
            <div class="metric-name">Last sleep day</div>
            <div class="metric-meta">polar_sleep.sleep_date</div>
          </div>
          <div class="metric-val"><?= h($latest['last_sleep_day'] ?? '–') ?></div>
        </div>
        <div class="metric-item">
          <div>
            <div class="metric-name">Last recovery day</div>
            <div class="metric-meta">polar_nightly_recharge.recharge_date</div>
          </div>
          <div class="metric-val"><?= h($latest['last_recharge_day'] ?? '–') ?></div>
        </div>
      </div>
    </div>

    <!-- Logs -->
    <div class="card card-pad">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="sec-title">Sync logs</div>
          <div class="sec-sub">Latest 30 entries</div>
        </div>
        <?php if ($lastLog): ?>
          <span class="pill"><span class="dot <?= lvl_dot($lastLog['level'] ?? '') ?>"></span><?= h($lastLog['level'] ?? '') ?></span>
        <?php endif; ?>
      </div>

      <div style="height:10px;"></div>

      <?php if (!$recentLogs): ?>
        <div class="sub">No logs yet.</div>
      <?php else: ?>
        <div style="display:grid;gap:10px;">
          <?php foreach ($recentLogs as $r): ?>
            <div class="metric-item">
              <div style="min-width:0;">
                <div class="metric-name"><?= h($r['level'] ?? '') ?> · <?= h($r['ran_at'] ?? '') ?></div>
                <div class="metric-meta"><?= h($r['polar_user_id'] ?? '') ?></div>
                <div class="metric-meta" style="margin-top:6px;white-space:normal;line-height:1.3;">
                  <?= h($r['message'] ?? '') ?>
                </div>
              </div>
              <div class="dot <?= lvl_dot($r['level'] ?? '') ?>"></div>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>

  </main>

  <?php include __DIR__ . '/_tabbar.php'; ?>

  <script>
    const btn = document.getElementById('btnSync');
    const label = document.getElementById('syncLabel');
    const toast = document.getElementById('syncToast');

    function showToast(msg, ok=true){
      toast.style.display = 'block';
      toast.style.color = ok ? 'rgba(55,242,154,.95)' : 'rgba(255,84,112,.95)';
      toast.textContent = msg;
    }

    btn?.addEventListener('click', async () => {
      btn.disabled = true;
      label.textContent = 'Syncing...';
      toast.style.display = 'none';

      try {
        const url = '<?= h($syncUrl) ?>' + '?secret=' + encodeURIComponent('<?= h($syncSecret) ?>');
        const res = await fetch(url, { method: 'GET', cache: 'no-store' });
        const text = await res.text();

        if (!res.ok) {
          showToast('Sync failed: HTTP ' + res.status + ' · ' + text.slice(0,120), false);
        } else {
          showToast('Sync complete. Refreshing...', true);
          setTimeout(() => location.reload(), 800);
        }
      } catch (e) {
        showToast('Sync failed: ' + (e?.message || e), false);
      } finally {
        btn.disabled = false;
        label.textContent = 'Sync now';
      }
    });
  </script>
</body>
</html>