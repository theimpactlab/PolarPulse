<?php
// _app_head.php
if (!isset($page_title)) $page_title = 'PolarPulse';
?>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>

<!-- iOS “web app” presentation -->
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<meta name="apple-mobile-web-app-title" content="PolarPulse"/>
<meta name="theme-color" content="#070A0F"/>

<title><?= htmlspecialchars($page_title, ENT_QUOTES, 'UTF-8') ?></title>

<link rel="stylesheet" href="/PolarPulse/assets/app.css"/>
<link rel="manifest" href="/PolarPulse/manifest.webmanifest">
<link rel="apple-touch-icon" href="/PolarPulse/assets/logo.png">
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script src="/PolarPulse/assets/charts.js"></script>