import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import {
  Wheat, Egg, Bird, Droplets,
  TrendingUp, TrendingDown, Wallet, AlertTriangle, Package,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const compactCurrency = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
};

const BU_INFO = {
  bu1: { label: "Feed Trading", icon: Wheat, color: "#14532D" },
  bu2: { label: "Egg Hatchery", icon: Egg, color: "#CA8A04" },
  bu3: { label: "Own Farm", icon: Bird, color: "#15803D" },
  bu4: { label: "Water", icon: Droplets, color: "#0284C7" },
};

const PIE_COLORS = ["#14532D", "#CA8A04", "#15803D", "#0284C7", "#C2410C", "#7C3AED", "#DB2777", "#475569"];

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";
  const [dfrom, setDfrom] = useState(firstOfMonth);
  const [dto, setDto] = useState(today);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (dfrom) p.set("dfrom", dfrom);
    if (dto) p.set("dto", dto);
    return p.toString();
  }, [dfrom, dto]);

  const exec = useQuery({
    queryKey: ["exec-dashboard", dfrom, dto],
    queryFn: async () => (await api.get(`/reports/exec-dashboard?${params}`)).data,
  });

  const data = exec.data;
  const totals = data?.totals || { revenue: 0, expenses: 0, profit: 0, outstanding: 0, stock_value: 0 };
  const perBu = data?.per_bu || {};

  const revByBu = useMemo(() => Object.entries(perBu).map(([k, v]) => ({
    name: v.label, revenue: v.revenue, color: BU_INFO[k]?.color,
  })), [perBu]);

  const profitByBu = useMemo(() => Object.entries(perBu).map(([k, v]) => ({
    name: v.label, revenue: v.revenue, expenses: v.expenses, profit: v.profit, color: BU_INFO[k]?.color,
  })), [perBu]);

  const outByBu = useMemo(() => Object.entries(perBu).map(([k, v]) => ({
    name: v.label, outstanding: v.outstanding, color: BU_INFO[k]?.color,
  })), [perBu]);

  const trend = data?.monthly_trend || [];
  const expenseBreakdown = data?.expense_breakdown || [];

  return (
    <div data-testid="reports-page">
      <PageHeader
        title="Executive Dashboard"
        subtitle="High-level business analytics across all units"
      />

      {/* Date filter */}
      <div className="bg-white border border-border rounded-md p-3 mb-6 flex flex-wrap gap-3 items-center" data-testid="report-filters">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Period</div>
        <input
          type="date" data-testid="filter-dfrom" value={dfrom} onChange={(e) => setDfrom(e.target.value)}
          className="rounded-md border border-border bg-white px-3 py-1.5 text-sm"
        />
        <span className="text-muted-foreground text-sm">to</span>
        <input
          type="date" data-testid="filter-dto" value={dto} onChange={(e) => setDto(e.target.value)}
          className="rounded-md border border-border bg-white px-3 py-1.5 text-sm"
        />
        {(dfrom !== firstOfMonth || dto !== today) && (
          <button
            data-testid="filter-reset"
            onClick={() => { setDfrom(firstOfMonth); setDto(today); }}
            className="text-xs text-muted-foreground hover:text-primary underline"
          >Reset to this month</button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{dfrom || "Start"}</span> → <span className="font-semibold text-foreground">{dto || "Today"}</span>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6" data-testid="exec-kpis">
        <Kpi icon={TrendingUp} label="Revenue" value={currency(totals.revenue)} color="#15803D" testid="kpi-revenue" />
        <Kpi icon={TrendingDown} label="Expenses" value={currency(totals.expenses)} color="#C2410C" testid="kpi-expenses" />
        <Kpi icon={Wallet} label="Profit"
             value={currency(totals.profit)}
             color={totals.profit >= 0 ? "#15803D" : "#C2410C"}
             testid="kpi-profit" />
        <Kpi icon={AlertTriangle} label="Outstanding" value={currency(totals.outstanding)} color="#CA8A04" testid="kpi-outstanding" />
        <Kpi icon={Package} label="Stock Value" value={currency(totals.stock_value)} color="#0284C7" testid="kpi-stock" />
      </div>

      {/* BU Cards */}
      <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>Business Units</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8" data-testid="exec-bu-cards">
        {Object.entries(perBu).map(([k, v]) => (
          <BuCard key={k} buKey={k} data={v} />
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Revenue by Business Unit">
          {revByBu.every(r => !r.revenue) ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revByBu} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={compactCurrency} />
                <Tooltip formatter={(v) => currency(v)} />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {revByBu.map((entry, idx) => <Cell key={entry.name} fill={entry.color || PIE_COLORS[idx % PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Monthly Revenue Trend (last 6 months)">
          {trend.every(t => !t.revenue && !t.expenses) ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={compactCurrency} />
                <Tooltip formatter={(v) => currency(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" stroke="#15803D" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="expenses" stroke="#C2410C" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="profit" stroke="#0284C7" strokeWidth={2.5} dot={{ r: 3 }} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card title="Expense Breakdown">
          {expenseBreakdown.length === 0 ? (
            <EmptyChart message="No expenses in this period" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={expenseBreakdown} dataKey="amount" nameKey="category"
                  outerRadius={90} label={(d) => `${d.category}: ${compactCurrency(d.amount)}`}
                  labelLine={false}
                >
                  {expenseBreakdown.map((entry, idx) => (
                    <Cell key={entry.category} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => currency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Profit Comparison by Business Unit">
          {profitByBu.every(r => !r.revenue && !r.expenses) ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={profitByBu} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={compactCurrency} />
                <Tooltip formatter={(v) => currency(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#15803D" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#C2410C" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="#0284C7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 gap-4">
        <Card title="Outstanding by Business Unit">
          {outByBu.every(r => !r.outstanding) ? (
            <EmptyChart message="No outstanding dues" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={outByBu} layout="vertical" margin={{ top: 10, right: 16, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={compactCurrency} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v) => currency(v)} />
                <Bar dataKey="outstanding" radius={[0, 6, 6, 0]}>
                  {outByBu.map((entry, idx) => <Cell key={entry.name} fill={entry.color || PIE_COLORS[idx % PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, color, testid }) {
  return (
    <div className="bg-white border border-border rounded-lg p-4" data-testid={testid}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4" style={{ color }} />
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      </div>
      <div className="text-2xl font-bold" style={{ color, fontFamily: "var(--font-heading)" }}>{value}</div>
    </div>
  );
}

function BuCard({ buKey, data }) {
  const info = BU_INFO[buKey] || { label: data.label, icon: Package, color: "#475569" };
  const Icon = info.icon;
  const profitPositive = data.profit >= 0;
  return (
    <div className="bg-white border border-border rounded-lg overflow-hidden" data-testid={`bu-card-${buKey}`}>
      <div className="px-4 py-3 border-b border-border flex items-center gap-2"
           style={{ background: `${info.color}10` }}>
        <Icon className="h-5 w-5" style={{ color: info.color }} />
        <div>
          <div className="font-bold text-sm" style={{ color: info.color, fontFamily: "var(--font-heading)" }}>{info.label}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{data.sales_count} sales</div>
        </div>
      </div>
      <div className="p-4 space-y-2 text-sm">
        <Row label="Revenue" value={currency(data.revenue)} color="#15803D" />
        <Row label="Expenses" value={currency(data.expenses)} color="#C2410C" />
        <Row label="Profit" value={currency(data.profit)} color={profitPositive ? "#15803D" : "#C2410C"} bold />
        <Row label="Outstanding" value={currency(data.outstanding)} color="#CA8A04" />
        <Row
          label="Stock"
          value={data.stock_value > 0
            ? currency(data.stock_value)
            : `${Number(data.stock_units || 0).toLocaleString("en-IN")} ${data.stock_unit_label}`}
          color="#0284C7"
        />
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

function Card({ title, children }) {
  return (
    <div className="bg-white border border-border rounded-lg p-5">
      <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart({ message = "No data in this period" }) {
  return (
    <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
