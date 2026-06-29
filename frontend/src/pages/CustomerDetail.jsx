import React, { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api, { API } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { ArrowLeft, FileText, Printer, Share2, User, Phone, MapPin, CreditCard, Calendar, Eye } from "lucide-react";
import { openInvoice, printInvoice, shareInvoice } from "@/lib/invoice";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const BU_LABEL = { 1: "Feed", 2: "Hatchery", 3: "Farm", 4: "Water" };
const BU_COLOR = { 1: "#14532D", 2: "#CA8A04", 3: "#15803D", 4: "#0284C7" };
const SALE_TYPE = { feed_sales: "feed", chick_sales: "chick", farm_sales: "farm", water_sales: "water" };
const statusBadge = (s) =>
  s === "paid" ? "bg-[#15803D]/10 text-[#15803D]"
  : s === "partial" ? "bg-[#CA8A04]/10 text-[#CA8A04]"
  : "bg-[#C2410C]/10 text-[#C2410C]";

const TABS = [
  { value: "summary", label: "Summary" },
  { value: "purchases", label: "Purchases" },
  { value: "payments", label: "Payments" },
  { value: "ledger", label: "Ledger" },
];

export default function CustomerDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState("summary");
  const [dfrom, setDfrom] = useState("");
  const [dto, setDto] = useState("");

  const details = useQuery({
    queryKey: ["customer-details", id],
    queryFn: async () => (await api.get(`/customers/${id}/details`)).data,
  });

  const ledger = useQuery({
    queryKey: ["customer-ledger", id, dfrom, dto],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (dfrom) qs.set("dfrom", dfrom);
      if (dto) qs.set("dto", dto);
      const s = qs.toString();
      return (await api.get(`/customers/${id}/ledger${s ? "?" + s : ""}`)).data;
    },
    enabled: !!id,
  });

  const customer = details.data?.customer;
  const summary = details.data?.summary;
  const invoices = useMemo(
  () => details.data?.invoices ?? [],
  [details.data?.invoices]
);

const payments = useMemo(
  () => details.data?.payments ?? [],
  [details.data?.payments]
);
  const ledgerData = ledger.data;

  const lastPurchase = useMemo(() =>
    invoices.length ? invoices.reduce((a, b) => (a.date > b.date ? a : b)).date : "—",
    [invoices]
  );
  const lastPayment = useMemo(() =>
    payments.length ? payments.reduce((a, b) => (a.date > b.date ? a : b)).date : "—",
    [payments]
  );

  const buildStatementParams = () => {
    const qs = new URLSearchParams();
    if (dfrom) qs.set("dfrom", dfrom);
    if (dto) qs.set("dto", dto);
    const s = qs.toString();
    return s ? "?" + s : "";
  };

  const onViewStatement = () => {
    window.open(`${API}/customers/${id}/statement/pdf${buildStatementParams()}`, "_blank", "noopener,noreferrer");
  };
  const onPrintStatement = () => {
    window.open(`${API}/customers/${id}/statement/print${buildStatementParams()}`, "_blank", "noopener,noreferrer");
  };
  const onShareStatement = async () => {
    try {
      const qs = new URLSearchParams();
      if (dfrom) qs.set("dfrom", dfrom);
      if (dto) qs.set("dto", dto);
      const s = qs.toString();
      const url = `/customers/${id}/statement/share${s ? "?" + s : ""}`;
      const { data } = await api.post(url);
      if (data?.whatsapp_url) window.open(data.whatsapp_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      alert("Failed to prepare share link");
    }
  };

  if (details.isLoading || !customer) {
    return <div data-testid="customer-detail-loading" className="h-32 bg-secondary rounded animate-pulse" />;
  }

  return (
    <div data-testid="customer-detail-page">
      <div className="mb-3">
        <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to Customers
        </Link>
      </div>

      <PageHeader
        title={customer.name}
        subtitle={customer.business_name || customer.farm_name || "Customer Account"}
        action={
          <div className="flex gap-2">
            <button data-testid="stmt-view" onClick={onViewStatement} className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-border rounded-md hover:bg-secondary">
              <FileText className="h-4 w-4" /> View Statement
            </button>
            <button data-testid="stmt-print" onClick={onPrintStatement} className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-border rounded-md hover:bg-secondary">
              <Printer className="h-4 w-4" /> Print
            </button>
            <button data-testid="stmt-share" onClick={onShareStatement} className="inline-flex items-center gap-1 px-3 py-2 text-sm bg-primary text-white rounded-md hover:opacity-90">
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        }
      />

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <InfoCard icon={User} label="Customer" value={customer.name} sub={customer.phone || ""} />
        <InfoCard icon={MapPin} label="Address" value={customer.address || "—"} sub={customer.gst ? `GSTIN ${customer.gst}` : ""} />
        <InfoCard icon={CreditCard} label="Credit Limit" value={currency(customer.credit_limit)} sub={`Outstanding: ${currency(customer.outstanding)}`} subColor="#C2410C" />
        <InfoCard icon={Calendar} label="Last Activity"
          value={`Sale: ${lastPurchase}`}
          sub={`Payment: ${lastPayment}`} />
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Kpi label="Total Purchases" value={currency(summary?.total_billed)} color="#0F172A" />
        <Kpi label="Total Payments" value={currency(summary?.total_paid)} color="#15803D" />
        <Kpi label="Outstanding" value={currency(summary?.total_due)} color="#C2410C" />
        <Kpi label="Invoices" value={invoices.length} color="#14532D" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto" data-testid="customer-tabs">
        {TABS.map((t) => (
          <button key={t.value} data-testid={`tab-${t.value}`} onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${
              tab === t.value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Date filter (for ledger / statement) */}
      {(tab === "ledger" || tab === "summary") && (
        <div className="mb-4 flex flex-wrap gap-3 items-center bg-white border border-border rounded-md p-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Period</div>
          <input type="date" data-testid="dfrom" value={dfrom} onChange={(e) => setDfrom(e.target.value)}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm" />
          <span className="text-muted-foreground">to</span>
          <input type="date" data-testid="dto" value={dto} onChange={(e) => setDto(e.target.value)}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-sm" />
          {(dfrom || dto) && (
            <button onClick={() => { setDfrom(""); setDto(""); }} className="text-xs text-muted-foreground hover:text-primary underline">Clear</button>
          )}
        </div>
      )}

      {tab === "summary" && (
        <SummaryTab summary={summary} ledger={ledgerData} invoices={invoices} payments={payments} />
      )}

      {tab === "purchases" && <PurchasesTab invoices={invoices} />}

      {tab === "payments" && <PaymentsTab payments={payments} />}

      {tab === "ledger" && <LedgerTab ledger={ledgerData} />}
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, sub, subColor }) {
  return (
    <div className="bg-white border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        <Icon className="h-3.5 w-3.5" />{label}
      </div>
      <div className="font-bold text-sm">{value}</div>
      {sub && <div className="text-xs mt-1" style={subColor ? { color: subColor } : { color: "#64748b" }}>{sub}</div>}
    </div>
  );
}

function Kpi({ label, value, color }) {
  return (
    <div className="bg-white border border-border rounded-lg p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="text-xl font-bold mt-1" style={{ color, fontFamily: "var(--font-heading)" }}>{value}</div>
    </div>
  );
}

function SummaryTab({ summary, ledger, invoices, payments }) {
  const recentInvoices = invoices.slice(0, 5);
  const recentPayments = payments.slice(0, 5);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="Recent Purchases">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-muted-foreground">
            <tr className="text-[10px] uppercase tracking-wider">
              <th className="text-left py-2 px-3">Invoice</th><th>Date</th><th>BU</th>
              <th className="text-right">Total</th><th className="text-center px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentInvoices.map(i => (
              <tr key={i.id} className="border-t border-border">
                <td className="py-2 px-3 font-mono text-xs">{i.invoice_no || "—"}</td>
                <td className="text-xs">{i.date}</td>
                <td className="text-xs" style={{ color: BU_COLOR[i.business_unit] }}>{BU_LABEL[i.business_unit]}</td>
                <td className="text-right font-semibold">{currency(i.total)}</td>
                <td className="text-center px-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${statusBadge(i.payment_status)}`}>{i.payment_status}</span>
                </td>
              </tr>
            ))}
            {recentInvoices.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">No invoices yet</td></tr>}
          </tbody>
        </table>
      </Card>
      <Card title="Recent Payments">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-muted-foreground">
            <tr className="text-[10px] uppercase tracking-wider">
              <th className="text-left py-2 px-3">Date</th><th>Method</th>
              <th>Notes</th><th className="text-right px-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {recentPayments.map(p => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-2 px-3 text-xs">{p.date}</td>
                <td className="capitalize text-xs">{p.method}</td>
                <td className="text-xs text-muted-foreground">{p.notes || "—"}</td>
                <td className="text-right px-3 font-semibold text-[#15803D]">{currency(p.amount)}</td>
              </tr>
            ))}
            {recentPayments.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">No payments yet</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function PurchasesTab({ invoices }) {
  return (
    <Card title={`Purchases (${invoices.length})`}>
      <table className="w-full text-sm" data-testid="customer-purchases-table">
        <thead className="bg-secondary text-muted-foreground">
          <tr className="text-[10px] uppercase tracking-wider">
            <th className="text-left py-2 px-3">Invoice</th>
            <th className="text-left">Date</th>
            <th className="text-left">BU</th>
            <th className="text-right">Amount</th>
            <th className="text-right">Paid</th>
            <th className="text-right">Due</th>
            <th className="text-center">Status</th>
            <th className="text-center px-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(i => {
            const t = SALE_TYPE[i.sale_type];
            return (
              <tr key={i.id} className="border-t border-border">
                <td className="py-2 px-3 font-mono text-xs">{i.invoice_no || "—"}</td>
                <td className="text-xs">{i.date}</td>
                <td className="text-xs font-semibold" style={{ color: BU_COLOR[i.business_unit] }}>{BU_LABEL[i.business_unit]}</td>
                <td className="text-right font-semibold">{currency(i.total)}</td>
                <td className="text-right text-[#15803D]">{currency(i.amount_paid)}</td>
                <td className="text-right text-[#C2410C] font-semibold">{currency(i.balance_due)}</td>
                <td className="text-center"><span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${statusBadge(i.payment_status)}`}>{i.payment_status}</span></td>
                <td className="text-center px-3">
                  {t ? (
                    <div className="inline-flex items-center gap-1">
                      <button data-testid={`invoice-view-${i.id}`} onClick={() => openInvoice(t, i.id)} title="View" className="p-1.5 rounded hover:bg-secondary text-primary"><Eye className="h-4 w-4" /></button>
                      <button data-testid={`invoice-print-${i.id}`} onClick={() => printInvoice(t, i.id)} title="Print" className="p-1.5 rounded hover:bg-secondary text-primary"><Printer className="h-4 w-4" /></button>
                      <button data-testid={`invoice-share-${i.id}`} onClick={() => shareInvoice(t, i.id)} title="Share" className="p-1.5 rounded hover:bg-secondary text-primary"><Share2 className="h-4 w-4" /></button>
                    </div>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
              </tr>
            );
          })}
          {invoices.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No purchases</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function PaymentsTab({ payments }) {
  return (
    <Card title={`Payments (${payments.length})`}>
      <table className="w-full text-sm" data-testid="customer-payments-table">
        <thead className="bg-secondary text-muted-foreground">
          <tr className="text-[10px] uppercase tracking-wider">
            <th className="text-left py-2 px-3">Date</th>
            <th className="text-right">Amount</th>
            <th className="text-left">Method</th>
            <th className="text-left">Notes</th>
            <th className="text-left px-3">FIFO Allocation</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id} className="border-t border-border align-top">
              <td className="py-2 px-3 text-xs">{p.date}</td>
              <td className="text-right font-semibold text-[#15803D]">{currency(p.amount)}</td>
              <td className="capitalize text-xs">{p.method}</td>
              <td className="text-xs text-muted-foreground">{p.notes || "—"}</td>
              <td className="text-xs px-3">
                {(p.allocations || []).map(a => (
                  <div key={a.sale_id}>
                    <span className="font-mono">{a.invoice_no}</span>
                    <span className="text-muted-foreground"> · {currency(a.amount_applied)} → {a.new_status}</span>
                  </div>
                ))}
                {p.advance_amount > 0 && <div className="text-[#0284C7]">Advance: {currency(p.advance_amount)}</div>}
                {(!p.allocations || p.allocations.length === 0) && <span className="text-muted-foreground">—</span>}
              </td>
            </tr>
          ))}
          {payments.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No payments yet</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function LedgerTab({ ledger }) {
  if (!ledger) return <div className="text-sm text-muted-foreground">Loading ledger…</div>;
  return (
    <Card title={`Ledger · Opening ${currency(ledger.opening_balance)} · Closing ${currency(ledger.closing_balance)}`}>
      <table className="w-full text-sm" data-testid="customer-ledger-table">
        <thead className="bg-secondary text-muted-foreground">
          <tr className="text-[10px] uppercase tracking-wider">
            <th className="text-left py-2 px-3">Date</th>
            <th className="text-left">Description</th>
            <th className="text-right">Debit (Sale)</th>
            <th className="text-right">Credit (Payment)</th>
            <th className="text-right px-3">Running Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border bg-secondary/40">
            <td className="py-2 px-3 italic text-xs">{ledger.from || "—"}</td>
            <td className="italic">Opening Balance</td>
            <td></td><td></td>
            <td className="text-right px-3 font-semibold">{currency(ledger.opening_balance)}</td>
          </tr>
          {ledger.entries.map((e, idx) => (
            <tr key={e.reference_id + idx} className="border-t border-border">
              <td className="py-2 px-3 text-xs">{e.date}</td>
              <td className="text-xs">{e.description}</td>
              <td className="text-right text-[#C2410C]">{e.debit > 0 ? currency(e.debit) : ""}</td>
              <td className="text-right text-[#15803D]">{e.credit > 0 ? currency(e.credit) : ""}</td>
              <td className="text-right px-3 font-semibold">{currency(e.running_balance)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-border bg-secondary/60 font-bold">
            <td className="py-2 px-3"></td>
            <td>Closing Balance</td>
            <td className="text-right text-[#C2410C]">{currency(ledger.total_debit)}</td>
            <td className="text-right text-[#15803D]">{currency(ledger.total_credit)}</td>
            <td className="text-right px-3" style={{ color: ledger.closing_balance > 0 ? "#C2410C" : "#15803D" }}>{currency(ledger.closing_balance)}</td>
          </tr>
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
