import React from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import KpiCard from "@/components/KpiCard";
import { Wheat, Egg, Bird, Droplets, AlertTriangle } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const AXIS = { fontSize: 11 };

const BU_META = [
  { key: "bu1", label: "Feed Trading", icon: Wheat, color: "#14532D", extraKey: "stock_value", extraLabel: "Stock Value", extraFmt: currency },
  { key: "bu2", label: "Egg Hatchery", icon: Egg, color: "#CA8A04", extraKey: "active_batches", extraLabel: "Active Batches", extraFmt: (n) => n },
  { key: "bu3", label: "Own Farm", icon: Bird, color: "#15803D", extraKey: "current_birds", extraLabel: "Current Birds", extraFmt: (n) => n },
  { key: "bu4", label: "Water", icon: Droplets, color: "#0284C7", extraKey: "water_stock", extraLabel: "Water Stock (L)", extraFmt: (n) => Number(n).toLocaleString() },
];

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: async () => (await api.get("/dashboard/summary")).data });
  if (isLoading || !data) return <div data-testid="dashboard-loading" className="h-32 bg-secondary rounded animate-pulse" />;

  return (
    <div data-testid="dashboard-page">
      <PageHeader title="Dashboard" subtitle="Combined view across all four business units" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {BU_META.map(({ key, label, icon: Icon, color, extraKey, extraLabel, extraFmt }) => {
          const bu = data[key] || {};
          return (
            <div key={key} className="bg-white border border-border rounded-lg p-5" data-testid={`bu-card-${key}`}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className="h-5 w-5" style={{ color }} />
                <div className="font-bold" style={{ fontFamily: "var(--font-heading)", color }}>{label}</div>
              </div>
              <div className="text-2xl font-bold mb-1" style={{ color, fontFamily: "var(--font-heading)" }}>{currency(bu.profit)}</div>
              <div className="text-xs text-muted-foreground mb-2">Net Profit (mo)</div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
                <div><span className="text-muted-foreground">Revenue:</span> <span className="font-semibold">{currency(bu.revenue)}</span></div>
                <div><span className="text-muted-foreground">Expense:</span> <span className="font-semibold">{currency(bu.expense)}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">{extraLabel}:</span> <span className="font-semibold">{extraFmt(bu[extraKey])}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <KpiCard testid="kpi-today" label="Today's Sales" value={currency(data.today_total_sales)} />
        <KpiCard testid="kpi-revenue" label="Month Revenue" value={currency(data.combined.revenue)} />
        <KpiCard testid="kpi-expense" label="Month Expense" value={currency(data.combined.expense)} accent="warn" />
        <KpiCard testid="kpi-outstanding" label="Outstanding" value={currency(data.outstanding)} accent="danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white border border-border rounded-lg p-5">
          <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>Revenue by Business Unit (6 months)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.revenue_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={AXIS} stroke="#94a3b8" />
              <YAxis tick={AXIS} stroke="#94a3b8" />
              <Tooltip />
              <Legend wrapperStyle={AXIS} />
              <Line type="monotone" dataKey="bu1" stroke="#14532D" name="Feed" strokeWidth={2} />
              <Line type="monotone" dataKey="bu2" stroke="#CA8A04" name="Hatchery" strokeWidth={2} />
              <Line type="monotone" dataKey="bu3" stroke="#15803D" name="Farm" strokeWidth={2} />
              <Line type="monotone" dataKey="bu4" stroke="#0284C7" name="Water" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3"><AlertTriangle className="h-4 w-4 text-[#CA8A04]" />
            <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-heading)" }}>Alerts</h3>
          </div>
          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Low Feed Stock</div>
          {data.low_feed_stock.length === 0 ? <div className="text-sm text-muted-foreground mb-3">All stocks healthy ✓</div> :
            <ul className="text-sm mb-3 space-y-1">{data.low_feed_stock.slice(0,4).map(f => (
              <li key={f.id} className="flex justify-between"><span>{f.name}</span><span className="text-[#C2410C] font-semibold">{f.current_stock} {f.unit}</span></li>
            ))}</ul>}
          <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Top Pending Customers</div>
          {data.top_customers.filter(c => c.outstanding > 0).length === 0 ? <div className="text-sm text-muted-foreground">No pending dues</div> :
            <ul className="text-sm space-y-1">{data.top_customers.filter(c => c.outstanding > 0).slice(0,4).map(c => (
              <li key={c.id} className="flex justify-between"><span>{c.name}</span><span className="text-[#C2410C] font-semibold">{currency(c.outstanding)}</span></li>
            ))}</ul>}
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg p-5">
        <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>Recent Transactions</h3>
        <table className="w-full text-sm" data-testid="recent-tx-table">
          <thead><tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <th className="text-left py-2">Date</th><th className="text-left">BU</th><th className="text-left">Type</th><th className="text-left">Category</th><th className="text-left">Notes</th><th className="text-right">Amount</th>
          </tr></thead>
          <tbody>{data.recent_transactions.map(t => (
            <tr key={t.id} className="border-b border-border last:border-0">
              <td className="py-2 text-xs">{t.date}</td>
              <td>BU{t.business_unit}</td>
              <td><span className={`uppercase text-[10px] font-semibold px-2 py-0.5 rounded ${t.type === "income" ? "bg-[#15803D]/10 text-[#15803D]" : "bg-[#C2410C]/10 text-[#C2410C]"}`}>{t.type}</span></td>
              <td>{t.category}</td>
              <td className="text-muted-foreground text-xs">{t.notes}</td>
              <td className={`text-right font-semibold ${t.type === "income" ? "text-[#15803D]" : "text-[#C2410C]"}`}>{currency(t.amount)}</td>
            </tr>
          ))}{data.recent_transactions.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No transactions yet</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}
