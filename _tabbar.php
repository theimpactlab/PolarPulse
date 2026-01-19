<?php
// _tabbar.php
$cur = basename($_SERVER['SCRIPT_NAME'] ?? '');
function tab_active(string $file, string $cur): string {
  return $file === $cur ? 'active' : '';
}
?>
<nav class="tabbar" role="navigation" aria-label="Bottom navigation">
  <div class="tabs">
    <a class="tab <?= tab_active('today.php', $cur) ?>" href="/PolarPulse/today.php">
      <div class="ico">▮▮▮</div>
      <div class="lbl">Dashboard</div>
    </a>
    <a class="tab <?= tab_active('sleep.php', $cur) ?>" href="/PolarPulse/sleep.php">
      <div class="ico">🛏️</div>
      <div class="lbl">Sleep</div>
    </a>
    <a class="tab <?= tab_active('activity.php', $cur) ?>" href="/PolarPulse/activity.php">
      <div class="ico">🏃</div>
      <div class="lbl">Activity</div>
    </a>
    <a class="tab <?= tab_active('profile.php', $cur) ?>" href="/PolarPulse/profile.php">
      <div class="ico">👤</div>
      <div class="lbl">Profile</div>
    </a>
  </div>
</nav>