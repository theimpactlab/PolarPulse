<?php
// _ring.php
// Expects: $val (0-100), $label (string)
// Optional: $size (px), $color (css color)
$val = isset($val) ? (int)$val : 0;
$val = max(0, min(100, $val));

$label = isset($label) ? (string)$label : '';
$size  = isset($size) ? (int)$size : 240;

// Whoop-ish green default
$color = isset($color) ? (string)$color : 'rgba(55,242,154,0.95)';

$stroke = 16;
$radius = ($size - $stroke) / 2;
$circ   = 2 * M_PI * $radius;
$offset = $circ * (1 - ($val / 100));

// subtle track
$track = 'rgba(255,255,255,0.10)';
?>
<div class="ring" style="width:<?= $size ?>px;height:<?= $size ?>px;">
  <svg width="<?= $size ?>" height="<?= $size ?>" viewBox="0 0 <?= $size ?> <?= $size ?>" aria-label="<?= htmlspecialchars($label, ENT_QUOTES) ?>">
    <defs>
      <filter id="ppGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- Track -->
    <circle
      cx="<?= $size/2 ?>"
      cy="<?= $size/2 ?>"
      r="<?= $radius ?>"
      fill="none"
      stroke="<?= $track ?>"
      stroke-width="<?= $stroke ?>"
    />

    <!-- Progress -->
    <circle
      cx="<?= $size/2 ?>"
      cy="<?= $size/2 ?>"
      r="<?= $radius ?>"
      fill="none"
      stroke="<?= $color ?>"
      stroke-width="<?= $stroke ?>"
      stroke-linecap="round"
      stroke-dasharray="<?= $circ ?>"
      stroke-dashoffset="<?= $offset ?>"
      transform="rotate(-90 <?= $size/2 ?> <?= $size/2 ?>)"
      filter="url(#ppGlow)"
    />

    <!-- Center text -->
    <text x="50%" y="48%" text-anchor="middle" dominant-baseline="middle"
      fill="rgba(233,238,247,0.95)" font-size="<?= (int)($size*0.28) ?>"
      font-weight="950" style="letter-spacing:-1px;">
      <?= $val ?>
    </text>

    <text x="50%" y="63%" text-anchor="middle" dominant-baseline="middle"
      fill="rgba(233,238,247,0.55)" font-size="<?= (int)($size*0.075) ?>"
      font-weight="800">
      <?= htmlspecialchars($label, ENT_QUOTES) ?>
    </text>
  </svg>
</div>