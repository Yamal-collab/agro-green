import React from "react";

const ACCENT_COLORS = {
  water: "#0284C7",
  warn: "#CA8A04",
  danger: "#C2410C",
  success: "#15803D",
};

function resolveColor(accent) {
  return ACCENT_COLORS[accent] || "var(--agri-primary)";
}

export default function KpiCard({ label, value, hint, accent, testid }) {
  const color = resolveColor(accent);
  return (
    <div
      data-testid={testid}
      className="bg-white border border-border rounded-lg p-5 hover:-translate-y-0.5 hover:shadow-md transition-all"
    >
      <div className="kpi-label mb-3">{label}</div>
      <div className="kpi-value" style={{ color }}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-2">{hint}</div>}
    </div>
  );
}
