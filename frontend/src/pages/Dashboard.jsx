import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import KpiCard from "@/components/KpiCard";
import {
  AlertTriangle, Banknote, ShoppingCart, PackageX,
  Wheat, Egg, Bird, Droplets,
} from "lucide-react";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const BU_META = {
  bu1: { label: "Feed Trading", icon: Wheat, color: "#14532D", stockLabel: "Stock Value", stockFmt: (s) => currency(s?.stock_value) },
  bu2: { label: "Egg Hatchery", icon: Egg, color: "#CA8A04", stockLabel: "Active Batches", stockFmt: (s) => Number(s?.active_batches || 0).toLocaleString() },
  bu3: { label: "Own Farm", icon: Bird, color: "#15803D", stockLabel: "Current Birds", stockFmt: (s) => Number(s?.current_birds || 0).toLocaleString() },
  bu4: { label: "Water", icon: Droplets, color: "#0284C7", stockLabel: "Water Stock (L)", stockFmt: (s) => Number(s?.water_stock || 0).toLocaleString() },
};

export default function Dashboard() {
  const today = new Date().toISOString().slice(0, 10);

  // Existing dashboard summary (today's sales, outstanding, low feed stock, recent tx, BU stock fields)
  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => (await api.get("/dashboard/summary")).data,
  });

  // Per-BU today's sales + outstanding (reuse existing exec-dashboard endpoint with today range)
  const todayBu = useQuery({
    queryKey: ["dashboard-bu-today", today],
    queryFn: async () => (await api.get(`/reports/exec-dashboard?dfrom=${today}&dto=${today}`)).data,
  });

  // Today's purchases (reuse existing purchases report)
  const todayPurchases = useQuery({
    queryKey: ["dashboard-purchases-today", today],
    queryFn: async () => (await api.get(`/reports/purchases?dfrom=${today}&dto=${today}`)).data,
  });

  // Pending top customers (reuse existing endpoint)
  const pendingCustomers = useQuery({
    queryKey: ["dashboard-pending-customers"],
    queryFn: async () => (await api.get("/dashboard/top-customers?by=outstanding&limit=5")).data,
  });

  // Recent payments & recent sales
  const recentPay = useQuery({
    queryKey: ["dashboard-recent-payments"],
    queryFn: async () => (await api.get("/dashboard/recent-payments?limit=6")).data,
  });
  const recentSales = useQuery({
    queryKey: ["dashboard-recent-sales"],
    queryFn: async () => (await api.get("/dashboard/recent-sales?limit=6")).data,
  });

  const lowStock = useMemo(() => summary?.low_feed_stock || [], [summary]);
  const todaysPurchasesTotal = todayPurchases.data?.summary?.total || 0;
  const perBu = todayBu.data?.per_bu || {};

  if (isLoading || !summary) {
    return <div data-testid="dashboard-loading" className="h-32 bg-secondary rounded animate-pulse" />;
  }

  return (
    <div data-testid="dashboard-page">
      <PageHeader title="Dashboard" subtitle="Operational view across all four business units" />

      {/* Operational KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard testid="kpi-today-sales" label="Today's Sales" value={currency(summary.today_total_sales)} />
        <KpiCard testid="kpi-today-purchases" label="Today's Purchases" value={currency(todaysPurchasesTotal)} accent="warn" />
        <KpiCard testid="kpi-outstanding" label="Outstanding" value={currency(summary.outstanding)} accent="danger" />
        <KpiCard testid="kpi-low-stock" label="Low Stock Items" value={lowStock.length} accent={lowStock.length > 0 ? "danger" : undefined} />
      </div>

      {/* BU quick summary cards */}
      <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>Business Units · Today</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="bu-quick-cards">
        {(["bu1", "bu2", "bu3", "bu4"]).map((k) => {
          const meta = BU_META[k];
          const Icon = meta.icon;
          const today = perBu[k] || { revenue: 0, outstanding: 0 };
          const stockSrc = summary[k] || {};
          return (
            <div key={k} className="bg-white border border-border rounded-lg overflow-hidden" data-testid={`bu-quick-${k}`}>
              <div className="px-4 py-3 border-b border-border flex items-center gap-2" style={{ background: `${meta.color}10` }}>
                <Icon className="h-5 w-5" style={{ color: meta.color }} />
                <div className="font-bold text-sm" style={{ color: meta.color, fontFamily: "var(--font-heading)" }}>{meta.label}</div>
              </div>
              <div className="p-4 space-y-2 text-sm">
                <Row label="Today's Sales" value={currency(today.revenue)} color="#15803D" />
                <Row label={meta.stockLabel} value={meta.stockFmt(stockSrc)} color="#0284C7" />
                <Row label="Outstanding" value={currency(today.outstanding)} color="#C2410C" bold />
              </div>
            </div>
          );
        })}
      </div>

      {/* Alerts + Pending payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-border rounded-lg p-5" data-testid="alerts-card">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-[#CA8A04]" />
            <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-heading)" }}>Alerts</h3>
          </div>
          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Low Feed Stock</div>
          {lowStock.length === 0 ? (
            <div className="text-sm text-muted-foreground mb-3">All stocks healthy ✓</div>
          ) : (
            <ul className="text-sm mb-3 space-y-1">
              {lowStock.slice(0, 6).map((f) => (
                <li key={f.id} className="flex justify-between items-center border-b border-border pb-1 last:border-0">
                  <span className="flex items-center gap-2">
                    <PackageX className="h-3.5 w-3.5 text-[#C2410C]" />
                    {f.name}
                  </span>
                  <span className="text-[#C2410C] font-semibold">{f.current_stock} {f.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-border rounded-lg p-5" data-testid="pending-customers-card">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-[#C2410C]" />
            <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-heading)" }}>Pending Customer Payments (Top 5)</h3>
          </div>
          <ol className="text-sm space-y-2">
            {(pendingCustomers.data || []).map((c, idx) => (
              <li key={c.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                  <Link to={`/customers/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link>
                </span>
                <span className="font-semibold text-[#C2410C]">{currency(c.outstanding)}</span>
              </li>
            ))}
            {(pendingCustomers.data || []).length === 0 && (
              <li className="text-muted-foreground text-sm">No outstanding dues</li>
            )}
          </ol>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white border border-border rounded-lg p-5 mb-6">
        <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>Recent Transactions</h3>
        <table className="w-full text-sm" data-testid="recent-tx-table">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="text-left py-2">Date</th><th className="text-left">BU</th><th className="text-left">Type</th>
              <th className="text-left">Category</th><th className="text-left">Notes</th><th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {summary.recent_transactions.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="py-2 text-xs">{t.date}</td>
                <td>BU{t.business_unit}</td>
                <td>
                  <span className={`uppercase text-[10px] font-semibold px-2 py-0.5 rounded ${
                    t.type === "income" ? "bg-[#15803D]/10 text-[#15803D]" : "bg-[#C2410C]/10 text-[#C2410C]"
                  }`}>{t.type}</span>
                </td>
                <td>{t.category}</td>
                <td className="text-muted-foreground text-xs">{t.notes}</td>
                <td className={`text-right font-semibold ${t.type === "income" ? "text-[#15803D]" : "text-[#C2410C]"}`}>{currency(t.amount)}</td>
              </tr>
            ))}
            {summary.recent_transactions.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No transactions yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Payments + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-border rounded-lg p-5" data-testid="recent-payments-card">
          <div className="flex items-center gap-2 mb-3">
            <Banknote className="h-4 w-4 text-[#15803D]" />
            <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-heading)" }}>Recent Payments</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2">Date</th><th className="text-left">Customer</th>
                <th className="text-left">Method</th><th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(recentPay.data || []).map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="py-2 text-xs">{(p.date || "").slice(0, 10)}</td>
                  <td>{p.party_name || "—"}</td>
                  <td className="capitalize text-xs text-muted-foreground">{p.method}</td>
                  <td className="text-right font-semibold text-[#15803D]">{currency(p.amount)}</td>
                </tr>
              ))}
              {(recentPay.data || []).length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No payments yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-border rounded-lg p-5" data-testid="recent-sales-card">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="h-4 w-4 text-primary" />
            <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-heading)" }}>Recent Sales</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2">Date</th><th className="text-left">Invoice</th>
                <th className="text-left">Customer</th><th className="text-left">BU</th><th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(recentSales.data || []).map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="py-2 text-xs">{s.date}</td>
                  <td className="font-mono text-xs">{s.invoice_no}</td>
                  <td>{s.customer_name}</td>
                  <td className="text-xs">BU{s.business_unit}</td>
                  <td className="text-right font-semibold">{currency(s.total)}</td>
                </tr>
              ))}
              {(recentSales.data || []).length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No sales yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={bold ? "font-bold" : "font-semibold"} style={{ color }}>{value}</span>
    </div>
  );
}
