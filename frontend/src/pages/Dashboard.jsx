import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import KpiCard from "@/components/KpiCard";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";
import { AlertTriangle, TrendingUp, Egg, Droplets } from "lucide-react";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const AXIS_TICK = { fontSize: 11 };
const LINE_DOT = { r: 3 };
const SKELETON_KEYS = ["s1", "s2", "s3", "s4"];

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/dashboard/summary")).data,
  });

  if (isLoading || !data) {
    return (
      <div data-testid="dashboard-loading" className="space-y-4">
        <div className="h-8 w-48 bg-secondary rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {SKELETON_KEYS.map((k) => <div key={k} className="h-28 bg-secondary rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  const expenseCats = Object.entries(data.expense_by_category || {}).map(([name, value]) => ({ name, value }));

  return (
    <div data-testid="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle="Operations overview across poultry and water distribution"
        testid="dashboard-header"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard testid="kpi-today-sales" label="Today's Sales" value={currency(data.today_sales)} />
        <KpiCard testid="kpi-month-revenue" label="Month Revenue" value={currency(data.month_income)} />
        <KpiCard testid="kpi-month-expense" label="Month Expense" value={currency(data.month_expense)} accent="warn" />
        <KpiCard testid="kpi-net-profit" label="Net Profit (mo)" value={currency(data.net_profit)} accent="success" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard testid="kpi-outstanding" label="Outstanding" value={currency(data.outstanding)} accent="danger" />
        <KpiCard testid="kpi-active-batches" label="Active Batches" value={data.active_batches} />
        <KpiCard testid="kpi-lorries" label="Lorries" value={data.lorries_total} accent="water" />
        <KpiCard testid="kpi-low-stock" label="Low Stock Items" value={data.low_stock_count} accent="warn" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white border border-border rounded-lg p-5" data-testid="revenue-chart">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">7-day trend</div>
              <h3 className="text-lg font-bold mt-0.5" style={{ fontFamily: "var(--font-heading)" }}>Revenue</h3>
            </div>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.revenue_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={AXIS_TICK} stroke="#94a3b8" />
              <YAxis tick={AXIS_TICK} stroke="#94a3b8" />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#14532D" strokeWidth={2.5} dot={LINE_DOT} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-border rounded-lg p-5" data-testid="low-stock-panel">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-[#CA8A04]" />
            <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-heading)" }}>Low Stock Alerts</h3>
          </div>
          {data.low_stock.length === 0 ? (
            <div className="text-sm text-muted-foreground">All stocks healthy ✓</div>
          ) : (
            <ul className="space-y-2">
              {data.low_stock.slice(0, 6).map((i) => (
                <li key={i.id} className="flex justify-between items-center text-sm border-b border-border last:border-0 pb-2">
                  <div>
                    <div className="font-medium">{i.name}</div>
                    <div className="text-[11px] text-muted-foreground">{i.category}</div>
                  </div>
                  <span className="text-[#C2410C] font-semibold">{i.stock} {i.unit}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-border rounded-lg p-5" data-testid="recent-poultry">
          <div className="flex items-center gap-2 mb-3">
            <Egg className="h-4 w-4 text-primary" />
            <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-heading)" }}>Recent Poultry Sales</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2">Invoice</th><th className="text-left">Customer</th><th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_poultry_sales.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="py-2 font-mono text-xs">{s.invoice_no}</td>
                  <td>{s.customer_name}</td>
                  <td className="text-right font-semibold">{currency(s.total)}</td>
                </tr>
              ))}
              {data.recent_poultry_sales.length === 0 && (
                <tr><td colSpan={3} className="py-4 text-center text-muted-foreground text-xs">No sales yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-border rounded-lg p-5" data-testid="recent-water">
          <div className="flex items-center gap-2 mb-3">
            <Droplets className="h-4 w-4 text-[#0284C7]" />
            <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-heading)" }}>Recent Water Sales</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2">Invoice</th><th className="text-left">Customer</th><th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_water_sales.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="py-2 font-mono text-xs">{s.invoice_no}</td>
                  <td>{s.customer_name}</td>
                  <td className="text-right font-semibold">{currency(s.total)}</td>
                </tr>
              ))}
              {data.recent_water_sales.length === 0 && (
                <tr><td colSpan={3} className="py-4 text-center text-muted-foreground text-xs">No sales yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
