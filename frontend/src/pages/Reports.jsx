import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api, { API } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Users, Truck, Droplets, Download, Printer } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const COLORS = ["#14532D", "#0284C7", "#CA8A04", "#C2410C", "#15803D", "#475569", "#7C3AED", "#DB2777"];
const LEGEND_STYLE = { fontSize: 11 };
const BU_LABEL = { 1: "Feed", 2: "Hatchery", 3: "Farm", 4: "Water" };
const statusBadge = (s) =>
  s === "paid" ? "bg-[#15803D]/10 text-[#15803D]"
  : s === "partial" ? "bg-[#CA8A04]/10 text-[#CA8A04]"
  : "bg-[#C2410C]/10 text-[#C2410C]";

const REPORTS = [
  { value: "pnl", label: "P&L" },
  { value: "sales", label: "Sales" },
  { value: "purchases", label: "Purchases" },
  { value: "outstanding", label: "Outstanding" },
  { value: "payments", label: "Payments" },
  { value: "stock", label: "Stock" },
  { value: "bu-summary", label: "BU Summary" },
];

const BU_TABS = [
  { value: "all", label: "All BUs", bu: null },
  { value: "1", label: "Feed (BU1)", bu: 1 },
  { value: "2", label: "Hatchery (BU2)", bu: 2 },
  { value: "3", label: "Farm (BU3)", bu: 3 },
  { value: "4", label: "Water (BU4)", bu: 4 },
];

function downloadExcel(kind, params) {
  const qs = new URLSearchParams({ kind, ...params });
  const url = `${API}/reports/excel?${qs.toString()}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export default function Reports() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + "01";
  const [kind, setKind] = useState("pnl");
  const [tab, setTab] = useState("all");
  const [dfrom, setDfrom] = useState(firstOfMonth);
  const [dto, setDto] = useState(today);
  const [customerId, setCustomerId] = useState("");

  const currentTab = BU_TABS.find((t) => t.value === tab) || BU_TABS[0];

  const customers = useQuery({
    queryKey: ["customers-light"],
    queryFn: async () => (await api.get("/customers")).data,
  });

  const params = useMemo(() => {
    const p = {};
    if (dfrom) p.dfrom = dfrom;
    if (dto) p.dto = dto;
    if (customerId) p.customer_id = customerId;
    if (currentTab.bu) p.business_unit = currentTab.bu;
    return p;
  }, [dfrom, dto, customerId, currentTab.bu]);

  return (
    <div data-testid="reports-page">
      <PageHeader
        title="Reports"
        subtitle="Sales, purchases, payments, outstanding, stock and P&L across business units"
        action={
          <div className="flex gap-2 items-center flex-wrap">
            <select data-testid="report-kind" value={kind} onChange={(e) => setKind(e.target.value)}
              className="rounded-md border border-border bg-white px-3 py-2 text-sm">
              {REPORTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button data-testid="report-print" onClick={() => window.print()}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-border rounded-md hover:bg-secondary">
              <Printer className="h-4 w-4" /> Print / PDF
            </button>
            <button data-testid="report-excel" onClick={() => downloadExcel(kind, params)}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-primary text-white rounded-md hover:opacity-90">
              <Download className="h-4 w-4" /> Excel
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="bg-white border border-border rounded-md p-3 mb-4 flex flex-wrap gap-3 items-center" data-testid="report-filters">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Filters</div>
        <input type="date" data-testid="filter-dfrom" value={dfrom} onChange={(e) => setDfrom(e.target.value)}
          className="rounded-md border border-border bg-white px-3 py-1.5 text-sm" />
        <span className="text-muted-foreground text-sm">to</span>
        <input type="date" data-testid="filter-dto" value={dto} onChange={(e) => setDto(e.target.value)}
          className="rounded-md border border-border bg-white px-3 py-1.5 text-sm" />
        <select data-testid="filter-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
          className="rounded-md border border-border bg-white px-3 py-1.5 text-sm min-w-[180px]">
          <option value="">All Customers</option>
          {(customers.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(dfrom !== firstOfMonth || dto !== today || customerId) && (
          <button onClick={() => { setDfrom(firstOfMonth); setDto(today); setCustomerId(""); }}
            className="text-xs text-muted-foreground hover:text-primary underline">Reset</button>
        )}
      </div>

      {/* BU Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto" data-testid="report-bu-tabs">
        {BU_TABS.map((t) => (
          <button key={t.value} data-testid={`tab-bu-${t.value}`} onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${
              tab === t.value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>{t.label}</button>
        ))}
      </div>

      {kind === "pnl" && <PnlReport bu={currentTab.bu} dfrom={dfrom} dto={dto} />}
      {kind === "sales" && <SalesReport params={params} />}
      {kind === "purchases" && <PurchasesReport params={params} />}
      {kind === "outstanding" && <OutstandingReport />}
      {kind === "payments" && <PaymentsReport params={params} />}
      {kind === "stock" && <StockReport />}
      {kind === "bu-summary" && <BuSummaryReport params={params} />}
    </div>
  );
}

function PnlReport({ bu, dfrom, dto }) {
  // Reuse existing finance/pnl with month prefix derived from dfrom; simpler: take from→to range via reports/bu-summary
  const pnl = useQuery({
    queryKey: ["pnl-bu-summary", bu, dfrom, dto],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (dfrom) qs.set("dfrom", dfrom);
      if (dto) qs.set("dto", dto);
      return (await api.get(`/reports/bu-summary?${qs.toString()}`)).data;
    },
  });
  const finExpense = useQuery({
    queryKey: ["pnl-finance", bu, dfrom],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (bu) params.set("bu", bu);
      if (dfrom) params.set("month", dfrom.slice(0, 7));
      const qs = params.toString();
      return (await api.get(`/finance/pnl${qs ? "?" + qs : ""}`)).data;
    },
  });
  const expenseData = useMemo(() =>
    Object.entries(finExpense.data?.expense_by_category || {}).map(([name, value]) => ({ name, value })),
    [finExpense.data]
  );
  const combined = pnl.data?.combined || { income: 0, expense: 0, profit: 0 };
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" data-testid="pnl-cards">
        <KpiBox icon={TrendingUp} label="Income" value={currency(combined.income)} color="#15803D" testid="pnl-income" />
        <KpiBox icon={TrendingDown} label="Expense" value={currency(combined.expense)} color="#C2410C" testid="pnl-expense" />
        <KpiBox icon={Wallet} label="Profit" value={currency(combined.profit)} color="#15803D" testid="pnl-profit" />
      </div>
      <div className="bg-white border border-border rounded-lg p-5 mb-6">
        <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>Expense Breakdown</h3>
        {expenseData.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">No expenses</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={expenseData} dataKey="value" nameKey="name" outerRadius={90} label>
                {expenseData.map((entry, idx) => <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => currency(v)} />
              <Legend wrapperStyle={LEGEND_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
}

function SalesReport({ params }) {
  const q = useQuery({
    queryKey: ["report-sales", params],
    queryFn: async () => (await api.get(`/reports/sales?${new URLSearchParams(params).toString()}`)).data,
  });
  const d = q.data;
  return (
    <Card title={`Sales Report${d ? ` · ${d.summary.count} invoices · ${currency(d.summary.total)}` : ""}`}>
      <table className="w-full text-sm" data-testid="sales-report-table">
        <thead className="bg-secondary text-muted-foreground">
          <tr className="text-[10px] uppercase tracking-wider">
            <th className="text-left py-2 px-3">Invoice</th><th>Date</th><th>Customer</th><th>BU</th>
            <th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Due</th>
            <th className="text-center px-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {(d?.rows || []).map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="py-2 px-3 font-mono text-xs">{r.invoice_no || "—"}</td>
              <td className="text-xs">{r.date}</td>
              <td>{r.customer_name}</td>
              <td className="text-xs">{BU_LABEL[r.business_unit]}</td>
              <td className="text-right font-semibold">{currency(r.total)}</td>
              <td className="text-right text-[#15803D]">{currency(r.amount_paid)}</td>
              <td className="text-right text-[#C2410C]">{currency(r.balance_due)}</td>
              <td className="text-center px-3"><span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${statusBadge(r.payment_status)}`}>{r.payment_status}</span></td>
            </tr>
          ))}
          {(!d || d.rows.length === 0) && <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No sales in period</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function PurchasesReport({ params }) {
  const q = useQuery({
    queryKey: ["report-purchases", params],
    queryFn: async () => {
      const qs = new URLSearchParams(params);
      qs.delete("customer_id");
      return (await api.get(`/reports/purchases?${qs.toString()}`)).data;
    },
  });
  const d = q.data;
  return (
    <Card title={`Purchases Report${d ? ` · ${d.summary.count} entries · ${currency(d.summary.total)}` : ""}`}>
      <table className="w-full text-sm" data-testid="purchases-report-table">
        <thead className="bg-secondary text-muted-foreground">
          <tr className="text-[10px] uppercase tracking-wider">
            <th className="text-left py-2 px-3">Date</th><th>Supplier</th><th>BU</th>
            <th className="text-right">Qty</th><th className="text-right">Rate</th>
            <th className="text-right">Transport</th><th className="text-right px-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {(d?.rows || []).map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="py-2 px-3 text-xs">{r.date}</td>
              <td>{r.supplier_name}</td>
              <td className="text-xs">{BU_LABEL[r.business_unit]}</td>
              <td className="text-right">{r.quantity}</td>
              <td className="text-right">{currency(r.rate)}</td>
              <td className="text-right">{currency(r.transport)}</td>
              <td className="text-right px-3 font-semibold">{currency(r.total)}</td>
            </tr>
          ))}
          {(!d || d.rows.length === 0) && <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No purchases in period</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function OutstandingReport() {
  const q = useQuery({
    queryKey: ["report-outstanding"],
    queryFn: async () => (await api.get("/reports/outstanding")).data,
  });
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title={`Customer Receivables${q.data ? ` · ${q.data.customers.length}` : ""}`}>
        <div className="px-5 py-3 border-b border-border flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Sorted by outstanding</span></div>
        <table className="w-full text-sm" data-testid="customers-outstanding">
          <thead className="bg-secondary text-muted-foreground">
            <tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-2 px-3">Name</th><th>Phone</th><th className="text-right px-3">Outstanding</th></tr>
          </thead>
          <tbody>
            {(q.data?.customers || []).map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="py-2 px-3 font-medium">{c.name}</td>
                <td className="text-xs text-muted-foreground">{c.phone || "—"}</td>
                <td className="text-right px-3 font-semibold text-[#C2410C]">{currency(c.outstanding)}</td>
              </tr>
            ))}
            {(q.data?.customers || []).length === 0 && <tr><td colSpan={3} className="py-8 text-center text-sm text-muted-foreground">No receivables</td></tr>}
          </tbody>
        </table>
      </Card>
      <Card title={`Supplier Payables${q.data ? ` · ${q.data.suppliers.length}` : ""}`}>
        <div className="px-5 py-3 border-b border-border flex items-center gap-2"><Truck className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Sorted by payable</span></div>
        <table className="w-full text-sm" data-testid="suppliers-outstanding">
          <thead className="bg-secondary text-muted-foreground">
            <tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-2 px-3">Name</th><th>Phone</th><th className="text-right px-3">Payable</th></tr>
          </thead>
          <tbody>
            {(q.data?.suppliers || []).map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="py-2 px-3 font-medium">{s.name}</td>
                <td className="text-xs text-muted-foreground">{s.phone || "—"}</td>
                <td className="text-right px-3 font-semibold text-[#C2410C]">{currency(s.outstanding)}</td>
              </tr>
            ))}
            {(q.data?.suppliers || []).length === 0 && <tr><td colSpan={3} className="py-8 text-center text-sm text-muted-foreground">No payables</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function PaymentsReport({ params }) {
  const q = useQuery({
    queryKey: ["report-payments", params],
    queryFn: async () => {
      const qs = new URLSearchParams(params); qs.delete("business_unit");
      return (await api.get(`/reports/payments?${qs.toString()}`)).data;
    },
  });
  const d = q.data;
  return (
    <Card title={`Payments Report${d ? ` · ${d.summary.count} payments · ${currency(d.summary.total)}` : ""}`}>
      <table className="w-full text-sm" data-testid="payments-report-table">
        <thead className="bg-secondary text-muted-foreground">
          <tr className="text-[10px] uppercase tracking-wider">
            <th className="text-left py-2 px-3">Date</th><th>Customer</th><th>Method</th>
            <th className="text-right">Amount</th><th className="text-right">Applied</th>
            <th className="text-right">Advance</th><th className="text-left px-3">Notes</th>
          </tr>
        </thead>
        <tbody>
          {(d?.rows || []).map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="py-2 px-3 text-xs">{r.date}</td>
              <td>{r.customer_name}</td>
              <td className="capitalize text-xs">{r.method}</td>
              <td className="text-right font-semibold text-[#15803D]">{currency(r.amount)}</td>
              <td className="text-right">{currency(r.applied_amount)}</td>
              <td className="text-right text-[#0284C7]">{r.advance_amount > 0 ? currency(r.advance_amount) : "—"}</td>
              <td className="text-xs text-muted-foreground px-3">{r.notes || "—"}</td>
            </tr>
          ))}
          {(!d || d.rows.length === 0) && <tr><td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No payments in period</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function StockReport() {
  const q = useQuery({ queryKey: ["report-stock"], queryFn: async () => (await api.get("/reports/stock")).data });
  const d = q.data;
  if (!d) return <div className="text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Feed Stock Value" value={currency(d.summary.feed_value)} />
        <Kpi label="Available Chicks" value={d.summary.available_chicks} />
        <Kpi label="Farm Birds" value={d.summary.farm_birds} />
        <Kpi label="Water (Litres)" value={Number(d.summary.water_liters).toLocaleString()} />
      </div>
      <Card title={`Feed Items (${d.feed.length})`}>
        <table className="w-full text-sm" data-testid="stock-feed">
          <thead className="bg-secondary text-muted-foreground">
            <tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-2 px-3">Name</th><th>Brand</th><th className="text-right">Stock</th><th className="text-right">Avg Cost</th><th className="text-right px-3">Value</th></tr>
          </thead>
          <tbody>
            {d.feed.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-2 px-3 font-medium">{r.name}</td><td className="text-muted-foreground">{r.brand}</td>
                <td className="text-right">{r.current_stock} {r.unit}</td>
                <td className="text-right">{currency(r.weighted_avg_cost)}</td>
                <td className="text-right px-3 font-semibold">{currency(r.stock_value)}</td>
              </tr>
            ))}
            {d.feed.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No feed items</td></tr>}
          </tbody>
        </table>
      </Card>
      <Card title={`Hatchery Batches (${d.hatchery.length})`}>
        <table className="w-full text-sm">
          <thead className="bg-secondary text-muted-foreground">
            <tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-2 px-3">Batch</th><th className="text-right">Hatched</th><th className="text-right">Sold</th><th className="text-right">Transferred</th><th className="text-right">Available</th><th className="text-center px-3">Status</th></tr>
          </thead>
          <tbody>
            {d.hatchery.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-2 px-3 font-mono text-xs">{r.batch_no}</td>
                <td className="text-right">{r.hatched_chicks}</td><td className="text-right">{r.sold}</td>
                <td className="text-right">{r.transferred}</td><td className="text-right font-semibold">{r.available}</td>
                <td className="text-center px-3 text-xs uppercase">{r.status}</td>
              </tr>
            ))}
            {d.hatchery.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No batches</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function BuSummaryReport({ params }) {
  const q = useQuery({
    queryKey: ["report-bu-summary", params],
    queryFn: async () => {
      const qs = new URLSearchParams(params);
      qs.delete("customer_id"); qs.delete("business_unit");
      return (await api.get(`/reports/bu-summary?${qs.toString()}`)).data;
    },
  });
  const d = q.data || {};
  return (
    <Card title="Business Unit Summary">
      <table className="w-full text-sm" data-testid="bu-summary-table">
        <thead className="bg-secondary text-muted-foreground">
          <tr className="text-[10px] uppercase tracking-wider">
            <th className="text-left py-2 px-3">Business Unit</th><th className="text-right">Sales</th>
            <th className="text-right">Revenue</th><th className="text-right">Collected</th>
            <th className="text-right px-3">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4].map((bu) => {
            const v = d[`bu${bu}`] || { sales_count: 0, revenue: 0, collected: 0, outstanding: 0, label: BU_LABEL[bu] };
            return (
              <tr key={bu} className="border-t border-border">
                <td className="py-2 px-3 font-semibold">{v.label}</td>
                <td className="text-right">{v.sales_count}</td>
                <td className="text-right font-semibold">{currency(v.revenue)}</td>
                <td className="text-right text-[#15803D]">{currency(v.collected)}</td>
                <td className="text-right px-3 text-[#C2410C] font-semibold">{currency(v.outstanding)}</td>
              </tr>
            );
          })}
          {d.combined && (
            <tr className="border-t-2 border-border bg-secondary/40 font-bold">
              <td className="py-2 px-3">Combined Finance (Income − Expense)</td>
              <td></td>
              <td className="text-right">{currency(d.combined.income)}</td>
              <td className="text-right text-[#C2410C]">{currency(d.combined.expense)}</td>
              <td className="text-right px-3">{currency(d.combined.profit)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="font-bold text-base" style={{ fontFamily: "var(--font-heading)" }}>{title}</h3>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="bg-white border border-border rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="text-xl font-bold mt-1" style={{ fontFamily: "var(--font-heading)" }}>{value}</div>
    </div>
  );
}

function KpiBox({ icon: Icon, label, value, color, testid }) {
  return (
    <div className="bg-white border border-border rounded-lg p-5" data-testid={testid}>
      <div className="flex items-center gap-2 mb-3"><Icon className="h-4 w-4" style={{ color }} /><div className="kpi-label">{label}</div></div>
      <div className="kpi-value" style={{ color }}>{value}</div>
    </div>
  );
}

/* keep unused imports referenced to avoid lint warnings */
void AlertTriangle; void Droplets;
