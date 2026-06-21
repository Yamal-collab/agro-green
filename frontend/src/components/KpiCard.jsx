import React from "react";

export default function KpiCard({ label, value, hint, accent, testid }) {
  const color = accent === "water" ? "#0284C7"
    : accent === "warn" ? "#CA8A04"
    : accent === "danger" ? "#C2410C"
    : "var(--agri-primary)";
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
