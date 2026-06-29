import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Plus, X, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Field, SelectField } from "@/pages/Poultry";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const COLORS = ["#14532D", "#0284C7", "#CA8A04", "#C2410C", "#15803D", "#475569"];
const LEGEND_STYLE = { fontSize: 11 };

const MAX_TRANSACTIONS_DISPLAYED = 30;
const MAX_PAYMENTS_DISPLAYED = 8;

export default function Finance() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const pnl = useQuery({ queryKey: ["pnl", month], queryFn: async () => (await api.get(`/finance/pnl?month=${month}`)).data });
  const txs = useQuery({ queryKey: ["txs"], queryFn: async () => (await api.get("/finance/transactions")).data });
  const customers = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });
  const payments = useQuery({ queryKey: ["payments"], queryFn: async () => (await api.get("/payments")).data });

  const recordPay = useMutation({
    mutationFn: async (p) => (await api.post("/payments", p)).data,
    onSuccess: (data) => {
      qc.invalidateQueries();
      setDialog(false);
      setForm({});
      setError("");
      const allocs = data?.allocations || [];
      const msg = allocs.length
        ? `Payment ₹${data.applied_amount} applied to ${allocs.length} invoice(s)${data.advance_amount > 0 ? ` · ₹${data.advance_amount} advance` : ""}`
        : `Payment ₹${data.amount} recorded`;
      setSuccess(msg);
      setTimeout(() => setSuccess(""), 4000);
    },
    onError: (e) => setError(formatApiError(e.response?.data?.detail)),
  });

  const submit = (e) => {
    e.preventDefault();
    setError("");
    if (!form.customer_id) { setError("Please select a customer"); return; }
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setError("Amount must be greater than 0"); return; }
    recordPay.mutate({
      customer_id: form.customer_id, amount: amt,
      date: form.date, method: form.method || "cash", notes: form.notes || "",
    });
  };

  const expenseData = Object.entries(pnl.data?.expense_by_category || {}).map(([name, value]) => ({ name, value }));

  return (
    <div data-testid="finance-page">
      <PageHeader
        title="Finance"
        subtitle="Profit & loss, cash flow and receivables"
        action={
          <div className="flex gap-2 items-center">
            <input data-testid="finance-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              className="rounded-md border border-border bg-white px-3 py-2 text-sm" />
            <button data-testid="btn-record-payment" onClick={() => { setDialog(true); setForm({ date: new Date().toISOString().slice(0,10), method: "cash" }); setError(""); }}
              className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-[#166534]">
              <Plus className="h-4 w-4" /> Record Payment
            </button>
          </div>
        }
      />

      {success && (
        <div data-testid="payment-success" className="mb-4 rounded-md border border-[#15803D]/30 bg-[#15803D]/10 text-[#15803D] px-4 py-2 text-sm font-medium">
          ✓ {success}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" data-testid="pnl-summary">
        <div className="bg-white border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-[#15803D]" />
            <div className="kpi-label">Income</div>
          </div>
          <div className="kpi-value" style={{ color: "#15803D" }}>{currency(pnl.data?.income)}</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-4 w-4 text-[#C2410C]" />
            <div className="kpi-label">Expense</div>
          </div>
          <div className="kpi-value" style={{ color: "#C2410C" }}>{currency(pnl.data?.expense)}</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="h-4 w-4 text-primary" />
            <div className="kpi-label">Net Profit</div>
          </div>
          <div className="kpi-value">{currency(pnl.data?.profit)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-border rounded-lg p-5">
          <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>Expense Breakdown</h3>
          {expenseData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No expenses in selected month</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={expenseData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {expenseData.map((entry) => <Cell key={entry.name} fill={COLORS[expenseData.indexOf(entry) % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={LEGEND_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border border-border rounded-lg p-5">
          <h3 className="text-base font-bold mb-3" style={{ fontFamily: "var(--font-heading)" }}>Recent Payments</h3>
          <table className="w-full text-sm" data-testid="payments-table">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left py-2">Date</th><th className="text-left">Customer</th>
                <th className="text-left">Method</th><th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(payments.data || []).slice(0, MAX_PAYMENTS_DISPLAYED).map(p => {
                const c = customers.data?.find(x => x.id === (p.customer_id || p.party_id));
                const allocLabel = (p.allocations || []).length
                  ? `${p.allocations.length} invoice${p.allocations.length > 1 ? "s" : ""}`
                  : "";
                return (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-2 text-xs">{p.date}</td>
                    <td>{c?.name || p.party_name || "—"}{allocLabel && <span className="block text-[10px] text-muted-foreground">{allocLabel}{p.advance_amount > 0 ? ` · ₹${p.advance_amount} advance` : ""}</span>}</td>
                    <td className="capitalize text-xs text-muted-foreground">{p.method}</td>
                    <td className="text-right font-semibold text-[#15803D]">{currency(p.amount)}</td>
                  </tr>
                );
              })}
              {(payments.data || []).length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">No payments recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="font-bold text-base" style={{ fontFamily: "var(--font-heading)" }}>All Transactions</h3>
        </div>
        <table className="w-full text-sm" data-testid="txs-table">
          <thead className="bg-secondary text-muted-foreground">
            <tr className="text-[10px] uppercase tracking-wider">
              <th className="text-left py-3 px-4">Date</th><th className="text-left">Type</th>
              <th className="text-left">Category</th><th className="text-left">Source</th>
              <th className="text-left">Notes</th><th className="text-right px-4">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(txs.data || []).slice(0, MAX_TRANSACTIONS_DISPLAYED).map(t => (
              <tr key={t.id} className="border-t border-border hover:bg-background/60">
                <td className="py-3 px-4 text-xs">{t.date}</td>
                <td><span className={`uppercase text-[10px] font-semibold px-2 py-0.5 rounded ${
                  t.type === "income" ? "bg-[#15803D]/10 text-[#15803D]" : "bg-[#C2410C]/10 text-[#C2410C]"
                }`}>{t.type}</span></td>                <td className="capitalize">{t.category}</td>
                <td className="capitalize text-muted-foreground text-xs">{t.source}</td>
                <td className="text-muted-foreground text-xs">{t.notes || "—"}</td>
                <td className={`text-right px-4 font-semibold ${t.type === "income" ? "text-[#15803D]" : "text-[#C2410C]"}`}>
                  {t.type === "income" ? "+" : "-"}{currency(t.amount)}
                </td>
              </tr>
            ))}
            {(txs.data || []).length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No transactions</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" data-testid="payment-dialog">
          <div className="bg-white rounded-lg w-full max-w-md p-6 border border-border">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Record Payment</h2>
              <button onClick={() => setDialog(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <SelectField label="Customer *" testid="pay-customer" value={form.customer_id || ""} onChange={(v) => setForm({...form, customer_id: v})}
                options={(customers.data || []).slice().sort((a,b) => (b.outstanding||0) - (a.outstanding||0)).map(c => ({ value: c.id, label: `${c.name} (${currency(c.outstanding)} Due)` }))} required />
              <Field label="Amount *" type="number" testid="pay-amount" value={form.amount || ""} onChange={(v) => setForm({...form, amount: v})} required />
              <Field label="Date" type="date" testid="pay-date" value={form.date} onChange={(v) => setForm({...form, date: v})} required />
              <SelectField label="Method" testid="pay-method" value={form.method} onChange={(v) => setForm({...form, method: v})}
                options={["cash", "bank", "upi", "cheque"].map(o => ({ value: o, label: o }))} />
              <Field label="Notes" testid="pay-notes" value={form.notes || ""} onChange={(v) => setForm({...form, notes: v})} />
              {error && <div className="text-xs text-destructive">{error}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setDialog(false)} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary">Cancel</button>
                <button data-testid="submit-payment" type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#166534]">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
