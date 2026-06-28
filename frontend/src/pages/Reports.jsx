import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Users, Truck, Droplets } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const COLORS = ["#14532D", "#0284C7", "#CA8A04", "#C2410C", "#15803D", "#475569", "#7C3AED", "#DB2777"];
const LEGEND_STYLE = { fontSize: 11 };

const BU_TABS = [
  { value: "all", label: "All BUs", bu: null },
  { value: "1", label: "Feed (BU1)", bu: 1 },
  { value: "2", label: "Hatchery (BU2)", bu: 2 },
  { value: "3", label: "Farm (BU3)", bu: 3 },
  { value: "4", label: "Water (BU4)", bu: 4 },
];

const PERIODS = [
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

function periodToMonthFilter(period, date) {
  // Backend pnl supports `month` as a regex prefix of the date string (YYYY, YYYY-MM, or YYYY-MM-DD)
  if (!date) return "";
  if (period === "yearly") return date.slice(0, 4);
  if (period === "monthly") return date.slice(0, 7);
  return date; // daily — full YYYY-MM-DD
}

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState("all");
  const [period, setPeriod] = useState("monthly");
  const [date, setDate] = useState(today);

  const currentTab = BU_TABS.find((t) => t.value === tab) || BU_TABS[0];
  const monthFilter = periodToMonthFilter(period, date);

  const pnlKey = ["reports-pnl", currentTab.bu, monthFilter];
  const pnl = useQuery({
    queryKey: pnlKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentTab.bu) params.set("bu", currentTab.bu);
      if (monthFilter) params.set("month", monthFilter);
      const qs = params.toString();
      return (await api.get(`/finance/pnl${qs ? "?" + qs : ""}`)).data;
    },
  });

  const outstanding = useQuery({
    queryKey: ["reports-outstanding"],
    queryFn: async () => (await api.get("/reports/outstanding")).data,
  });

  const lowStock = useQuery({
    queryKey: ["reports-low-stock"],
    queryFn: async () => (await api.get("/reports/low-stock")).data,
    enabled: currentTab.bu === 1 || currentTab.bu === null,
  });

  const waterSales = useQuery({
    queryKey: ["reports-water-sales"],
    queryFn: async () => (await api.get("/water/sales")).data,
    enabled: currentTab.bu === 4 || currentTab.bu === null,
  });

  const expenseData = useMemo(
    () => Object.entries(pnl.data?.expense_by_category || {}).map(([name, value]) => ({ name, value })),
    [pnl.data]
  );

  const pendingWaterSales = useMemo(
    () => (waterSales.data || []).filter((s) => Number(s.pending || 0) > 0),
    [waterSales.data]
  );

  const dateInputType = period === "yearly" ? "number" : period === "monthly" ? "month" : "date";
  const dateInputValue =
    period === "yearly" ? date.slice(0, 4) : period === "monthly" ? date.slice(0, 7) : date;

  const handleDateChange = (val) => {
    if (period === "yearly") {
      setDate(`${val}-01-01`);
    } else if (period === "monthly") {
      setDate(`${val}-01`);
    } else {
      setDate(val);
    }
  };

  return (
    <div data-testid="reports-page">
      <PageHeader
        title="Reports"
        subtitle="P&L, expense breakdown, outstanding balances and stock alerts"
        action={
          <div className="flex gap-2 items-center">
            <select
              data-testid="report-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-md border border-border bg-white px-3 py-2 text-sm capitalize"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <input
              data-testid="report-date"
              type={dateInputType}
              value={dateInputValue}
              min={dateInputType === "number" ? 2000 : undefined}
              max={dateInputType === "number" ? 2100 : undefined}
              onChange={(e) => handleDateChange(e.target.value)}
              className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </div>
        }
      />

      {/* BU Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto" data-testid="report-bu-tabs">
        {BU_TABS.map((t) => (
          <button
            key={t.value}
            data-testid={`tab-bu-${t.value}`}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${
              tab === t.value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* P&L cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" data-testid="pnl-cards">
        <div className="bg-white border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-[#15803D]" />
            <div className="kpi-label">Income</div>
          </div>
          <div className="kpi-value" style={{ color: "#15803D" }} data-testid="pnl-income">
            {currency(pnl.data?.income)}
          </div>
        </div>
        <div className="bg-white border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-4 w-4 text-[#C2410C]" />
            <div className="kpi-label">Expense</div>
          </div>
          <div className="kpi-value" style={{ color: "#C2410C" }} data-testid="pnl-expense">
            {currency(pnl.data?.expense)}
          </div>
        </div>
        <div className="bg-white border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="h-4 w-4 text-primary" />
            <div className="kpi-label">Profit</div>
          </div>
          <div className="kpi-value" data-testid="pnl-profit">{currency(pnl.data?.profit)}</div>
        </div>
      </div>

      {/* Expense pie */}
      <div className="bg-white border border-border rounded-lg p-5 mb-6">
        <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>
          Expense Breakdown {currentTab.bu ? `— ${currentTab.label}` : ""}
        </h3>
        {expenseData.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
            No expenses for selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={expenseData} dataKey="value" nameKey="name" outerRadius={90} label>
                {expenseData.map((entry, idx) => (
                  <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => currency(v)} />
              <Legend wrapperStyle={LEGEND_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Outstanding tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-border rounded-lg overflow-hidden" data-testid="customers-outstanding">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-base" style={{ fontFamily: "var(--font-heading)" }}>
              Customer Receivables
            </h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {(outstanding.data?.customers || []).length} parties
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr className="text-[10px] uppercase tracking-wider">
                <th className="text-left py-2 px-4">Name</th>
                <th className="text-left">Phone</th>
                <th className="text-right px-4">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {(outstanding.data?.customers || []).map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-background/60">
                  <td className="py-2 px-4 font-medium">{c.name}</td>
                  <td className="text-xs text-muted-foreground">{c.phone || "—"}</td>
                  <td className="text-right px-4 font-semibold text-[#C2410C]">{currency(c.outstanding)}</td>
                </tr>
              ))}
              {(outstanding.data?.customers || []).length === 0 && (
                <tr><td colSpan={3} className="py-8 text-center text-sm text-muted-foreground">No receivables</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-border rounded-lg overflow-hidden" data-testid="suppliers-outstanding">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-base" style={{ fontFamily: "var(--font-heading)" }}>
              Supplier Payables
            </h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {(outstanding.data?.suppliers || []).length} parties
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr className="text-[10px] uppercase tracking-wider">
                <th className="text-left py-2 px-4">Name</th>
                <th className="text-left">Phone</th>
                <th className="text-right px-4">Payable</th>
              </tr>
            </thead>
            <tbody>
              {(outstanding.data?.suppliers || []).map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-background/60">
                  <td className="py-2 px-4 font-medium">{s.name}</td>
                  <td className="text-xs text-muted-foreground">{s.phone || "—"}</td>
                  <td className="text-right px-4 font-semibold text-[#C2410C]">{currency(s.outstanding)}</td>
                </tr>
              ))}
              {(outstanding.data?.suppliers || []).length === 0 && (
                <tr><td colSpan={3} className="py-8 text-center text-sm text-muted-foreground">No payables</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low stock — BU1 only */}
      {(currentTab.bu === 1 || currentTab.bu === null) && (
        <div className="bg-white border border-border rounded-lg overflow-hidden mb-6" data-testid="low-stock-table">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-[#C2410C]" />
            <h3 className="font-bold text-base" style={{ fontFamily: "var(--font-heading)" }}>
              Low Feed Stock (&lt; 100)
            </h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {(lowStock.data || []).length} items
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr className="text-[10px] uppercase tracking-wider">
                <th className="text-left py-2 px-4">Name</th>
                <th className="text-left">Brand</th>
                <th className="text-left">Category</th>
                <th className="text-right">Stock</th>
                <th className="text-right px-4">Avg Cost</th>
              </tr>
            </thead>
            <tbody>
              {(lowStock.data || []).map((f) => (
                <tr key={f.id} className="border-t border-border hover:bg-background/60">
                  <td className="py-2 px-4 font-medium">{f.name}</td>
                  <td className="text-muted-foreground">{f.brand || "—"}</td>
                  <td className="text-muted-foreground capitalize">{f.category || "—"}</td>
                  <td className="text-right font-semibold text-[#C2410C]">
                    {Number(f.current_stock || 0).toFixed(2)} {f.unit || ""}
                  </td>
                  <td className="text-right px-4">{currency(f.weighted_avg_cost)}</td>
                </tr>
              ))}
              {(lowStock.data || []).length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">All feed items above threshold</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pending water sales — BU4 only */}
      {(currentTab.bu === 4 || currentTab.bu === null) && (
        <div className="bg-white border border-border rounded-lg overflow-hidden mb-6" data-testid="water-pending-table">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Droplets className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-base" style={{ fontFamily: "var(--font-heading)" }}>
              Customer Pending Water Sales
            </h3>
            <span className="ml-auto text-xs text-muted-foreground">
              {pendingWaterSales.length} sales
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-secondary text-muted-foreground">
              <tr className="text-[10px] uppercase tracking-wider">
                <th className="text-left py-2 px-4">Date</th>
                <th className="text-left">Customer</th>
                <th className="text-right">Liters</th>
                <th className="text-right">Total</th>
                <th className="text-right">Received</th>
                <th className="text-right px-4">Pending</th>
              </tr>
            </thead>
            <tbody>
              {pendingWaterSales.map((s) => (
                <tr key={s.id} className="border-t border-border hover:bg-background/60">
                  <td className="py-2 px-4 text-xs">{s.date}</td>
                  <td className="font-medium">{s.customer_name}</td>
                  <td className="text-right">{Number(s.liters || 0).toLocaleString("en-IN")}</td>
                  <td className="text-right">{currency(s.total)}</td>
                  <td className="text-right text-[#15803D]">{currency(s.received)}</td>
                  <td className="text-right px-4 font-semibold text-[#C2410C]">{currency(s.pending)}</td>
                </tr>
              ))}
              {pendingWaterSales.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No pending water sales</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
