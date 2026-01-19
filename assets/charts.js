// Whoop-ish defaults for Chart.js
Chart.defaults.animation.duration = 650;
Chart.defaults.font.family = "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
Chart.defaults.font.weight = "700";
Chart.defaults.color = "rgba(233,238,247,.70)";

Chart.defaults.elements.line.borderWidth = 3;
Chart.defaults.elements.line.tension = 0.35;

Chart.defaults.elements.point.radius = 0;
Chart.defaults.elements.point.hitRadius = 14;

Chart.defaults.plugins.legend.display = false;

Chart.defaults.plugins.tooltip.backgroundColor = "rgba(10,14,26,.92)";
Chart.defaults.plugins.tooltip.borderColor = "rgba(255,255,255,.10)";
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.titleColor = "rgba(233,238,247,.92)";
Chart.defaults.plugins.tooltip.bodyColor = "rgba(233,238,247,.78)";
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.displayColors = false;

function whoopScales(maxY) {
  return {
    x: {
      grid: { display: false },
      ticks: {
        color: "rgba(233,238,247,.50)",
        font: { weight: "800" }
      }
    },
    y: {
      beginAtZero: true,
      max: (typeof maxY === "number") ? maxY : undefined,
      grid: { color: "rgba(255,255,255,.06)" },
      ticks: {
        color: "rgba(233,238,247,.50)",
        font: { weight: "800" }
      }
    }
  };
}

// Optional helper for gradient fills
function lineGradient(ctx, area) {
  const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, "rgba(105,210,255,.22)");
  g.addColorStop(1, "rgba(105,210,255,0)");
  return g;
}

window.PPCharts = { whoopScales, lineGradient };