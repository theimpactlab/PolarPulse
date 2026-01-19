<?php
// _nav.php
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
$csrf = $_SESSION['csrf'];
?>
<nav class="pp-nav">
  <div class="container pp-nav-inner">
    <a class="pp-brand" href="/PolarPulse/index.php">
      <span class="pp-dot"></span>
      PolarPulse
    </a>

    <div class="pp-links">
      <a class="pp-link" href="/PolarPulse/today.php">Today</a>
      <a class="pp-link" href="/PolarPulse/fitness.php">Fitness</a>
      <a class="pp-link" href="/PolarPulse/sleep.php">Sleep</a>
      <a class="pp-link" href="/PolarPulse/recovery.php">Recovery</a>
      <a class="pp-link pp-muted" href="/PolarPulse/connect.php">Connect</a>
    </div>

    <form class="pp-sync" method="post" action="/PolarPulse/manual_sync.php">
      <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
      <button class="pp-btn" type="submit" title="Run a manual sync now">
        Sync now
      </button>
    </form>
  </div>
</nav>