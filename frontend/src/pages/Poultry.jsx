import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Plus, X, Egg } from "lucide-react";
import { paymentStatusBadge, mortalityColor } from "@/lib/badges";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function Poultry() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("batches");
  const [dialog, setDialog] = useState(null); // "batch" | "sale" | "expense"
  const [form, setForm] = useState({});
  const [error, setError] = useState("");

  const batches = useQuery({ queryKey: ["batches"], queryFn: async () => (await api.get("/poultry/batches")).data });
  const sales = useQuery({ queryKey: ["poultry-sales"], queryFn: async () => (await api.get("/poultry/sales")).data });
  const expenses = useQuery({ queryKey: ["poultry-expenses"], queryFn: async () => (await api.get("/poultry/expenses")).data });
  const customers = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });

  const open = (type, defaults = {}) => { setDialog(type); setForm(defaults); setError(""); };
  const close = () => { setDialog(null); setForm({}); setError(""); };

  const createBatch = useMutation({
    mutationFn: async (p) => (await api.post("/poultry/batches", p)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["batches"] }); close(); },
    onError: (e) => setError(formatApiError(e.response?.data?.detail)),
  });
  const createSale = useMutation({
    mutationFn: async (p) => (await api.post("/poultry/sales", p)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["poultry-sales", "customers", "dashboard"] }); close(); },
    onError: (e) => setError(formatApiError(e.response?.data?.detail)),
  });
  const createExpense = useMutation({
    mutationFn: async (p) => (await api.post("/poultry/expenses", p)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["poultry-expenses", "dashboard"] }); close(); },
    onError: (e) => setError(formatApiError(e.response?.data?.detail)),
  });

  const submit = (e) => {
    e.preventDefault();
    if (dialog === "batch") {
      createBatch.mutate({
        batch_no: form.batch_no, hatch_date: form.hatch_date,
        quantity: parseInt(form.quantity), mortality: parseInt(form.mortality || 0),
        feed_kg: parseFloat(form.feed_kg || 0), status: form.status || "active",
        notes: form.notes || "",
      });
    } else if (dialog === "sale") {
      const cust = customers.data?.find(c => c.id === form.customer_id);
      createSale.mutate({
        customer_id: form.customer_id, customer_name: cust?.name || "",
        date: form.date, product: form.product, quantity: parseFloat(form.quantity),
        unit_price: parseFloat(form.unit_price), transport: parseFloat(form.transport || 0),
        discount: parseFloat(form.discount || 0), payment_status: form.payment_status || "pending",
        batch_id: form.batch_id || null,
      });
    } else if (dialog === "expense") {
      createExpense.mutate({
        category: form.category, amount: parseFloat(form.amount),
        date: form.date, notes: form.notes || "", batch_id: form.batch_id || null,
      });
    }
  };

  return (
    <div data-testid="poultry-page">
      <PageHeader
        title="Poultry / Hatchery"
        subtitle="Batches, sales, invoices and expenses"
        action={
          <div className="flex gap-2">
            <button data-testid="btn-add-batch" onClick={() => open("batch", { hatch_date: new Date().toISOString().slice(0,10), status: "active" })}
              className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-secondary">
              <Plus className="h-4 w-4" /> Batch
            </button>
            <button data-testid="btn-add-poultry-sale" onClick={() => open("sale", { date: new Date().toISOString().slice(0,10), product: "eggs", payment_status: "pending" })}
              className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-[#166534]">
              <Plus className="h-4 w-4" /> Sale
            </button>
            <button data-testid="btn-add-poultry-expense" onClick={() => open("expense", { date: new Date().toISOString().slice(0,10), category: "Feed" })}
              className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-secondary">
              <Plus className="h-4 w-4" /> Expense
            </button>
          </div>
        }
      />

      <div className="flex gap-2 mb-4 border-b border-border" data-testid="poultry-tabs">
        {["batches", "sales", "expenses"].map((t) => (
          <button key={t} data-testid={`tab-${t}`} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px capitalize ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>{t}</button>
        ))}
      </div>

      {tab === "batches" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="batches-grid">
          {(batches.data || []).map((b) => {
            const mort = b.quantity > 0 ? (b.mortality / b.quantity) * 100 : 0;
            return (
              <div key={b.id} className="bg-white border border-border rounded-lg p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Batch</div>
                    <div className="font-bold text-lg" style={{ fontFamily: "var(--font-heading)" }}>{b.batch_no}</div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${
                    b.status === "active" ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"
                  }`}>{b.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Quantity</div><div className="font-semibold">{b.quantity}</div></div>
                  <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hatched</div><div className="font-semibold text-xs">{b.hatch_date}</div></div>
                  <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Mortality</div><div className="font-semibold">{b.mortality} ({mort.toFixed(1)}%)</div></div>
                  <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Feed (kg)</div><div className="font-semibold">{b.feed_kg}</div></div>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full transition-all" style={{
                    width: `${Math.min(100, mort)}%`,
                    backgroundColor: mortalityColor(mort)
                  }} />
                </div>
              </div>
            );
          })}
          {(batches.data || []).length === 0 && (
            <div className="col-span-full bg-white border border-dashed border-border rounded-lg p-12 text-center">
              <Egg className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <div className="text-sm text-muted-foreground">No batches yet. Create your first batch.</div>
            </div>
          )}
        </div>
      )}

      {tab === "sales" && (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="poultry-sales-table">
            <thead className="bg-secondary text-muted-foreground">
              <tr className="text-[10px] uppercase tracking-wider">
                <th className="text-left py-3 px-4">Invoice</th><th className="text-left">Customer</th>
                <th className="text-left">Date</th><th className="text-left">Product</th>
                <th className="text-right">Qty</th><th className="text-right">Total</th><th className="text-right px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {(sales.data || []).map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-background/60">
                  <td className="py-3 px-4 font-mono text-xs">{s.invoice_no}</td>
                  <td>{s.customer_name}</td><td className="text-xs">{s.date}</td>
                  <td className="capitalize">{s.product}</td>
                  <td className="text-right">{s.quantity}</td>
                  <td className="text-right font-semibold">{currency(s.total)}</td>
                  <td className="text-right px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${paymentStatusBadge(s.payment_status)}`}>{s.payment_status}</span>
                  </td>
                </tr>
              ))}
              {(sales.data || []).length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground text-sm">No sales recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "expenses" && (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="poultry-expenses-table">
            <thead className="bg-secondary text-muted-foreground">
              <tr className="text-[10px] uppercase tracking-wider">
                <th className="text-left py-3 px-4">Date</th><th className="text-left">Category</th>
                <th className="text-left">Notes</th><th className="text-right px-4">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(expenses.data || []).map(x => (
                <tr key={x.id} className="border-t border-border hover:bg-background/60">
                  <td className="py-3 px-4 text-xs">{x.date}</td>
                  <td className="font-medium">{x.category}</td>
                  <td className="text-muted-foreground">{x.notes || "—"}</td>
                  <td className="text-right px-4 font-semibold text-[#C2410C]">{currency(x.amount)}</td>
                </tr>
              ))}
              {(expenses.data || []).length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-muted-foreground text-sm">No expenses recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" data-testid={`${dialog}-dialog`}>
          <div className="bg-white rounded-lg w-full max-w-md p-6 border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold capitalize" style={{ fontFamily: "var(--font-heading)" }}>Add {dialog}</h2>
              <button onClick={close}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              {dialog === "batch" && (
                <>
                  <Field label="Batch No *" testid="batch-no" value={form.batch_no || ""} onChange={(v) => setForm({...form, batch_no: v})} required />
                  <Field label="Hatch Date" type="date" testid="batch-hatch-date" value={form.hatch_date || ""} onChange={(v) => setForm({...form, hatch_date: v})} required />
                  <Field label="Quantity *" type="number" testid="batch-qty" value={form.quantity || ""} onChange={(v) => setForm({...form, quantity: v})} required />
                  <Field label="Mortality" type="number" testid="batch-mortality" value={form.mortality || 0} onChange={(v) => setForm({...form, mortality: v})} />
                  <Field label="Feed (kg)" type="number" testid="batch-feed" value={form.feed_kg || 0} onChange={(v) => setForm({...form, feed_kg: v})} />
                  <Field label="Notes" testid="batch-notes" value={form.notes || ""} onChange={(v) => setForm({...form, notes: v})} />
                </>
              )}
              {dialog === "sale" && (
                <>
                  <SelectField label="Customer *" testid="sale-customer" value={form.customer_id || ""} onChange={(v) => setForm({...form, customer_id: v})}
                    options={(customers.data || []).map(c => ({ value: c.id, label: c.name }))} required />
                  <Field label="Date" type="date" testid="sale-date" value={form.date} onChange={(v) => setForm({...form, date: v})} required />
                  <SelectField label="Product" testid="sale-product" value={form.product} onChange={(v) => setForm({...form, product: v})}
                    options={["eggs", "chicks", "chickens", "hens"].map(o => ({ value: o, label: o }))} required />
                  <Field label="Quantity *" type="number" testid="sale-qty" value={form.quantity || ""} onChange={(v) => setForm({...form, quantity: v})} required />
                  <Field label="Unit Price *" type="number" testid="sale-price" value={form.unit_price || ""} onChange={(v) => setForm({...form, unit_price: v})} required />
                  <Field label="Transport" type="number" testid="sale-transport" value={form.transport || 0} onChange={(v) => setForm({...form, transport: v})} />
                  <Field label="Discount" type="number" testid="sale-discount" value={form.discount || 0} onChange={(v) => setForm({...form, discount: v})} />
                  <SelectField label="Payment" testid="sale-payment" value={form.payment_status} onChange={(v) => setForm({...form, payment_status: v})}
                    options={["pending", "partial", "paid"].map(o => ({ value: o, label: o }))} />
                </>
              )}
              {dialog === "expense" && (
                <>
                  <SelectField label="Category" testid="exp-cat" value={form.category} onChange={(v) => setForm({...form, category: v})}
                    options={["Feed", "Medicine", "Vaccination", "Labour", "Rent", "Electricity", "Transport", "Misc"].map(o => ({ value: o, label: o }))} required />
                  <Field label="Date" type="date" testid="exp-date" value={form.date} onChange={(v) => setForm({...form, date: v})} required />
                  <Field label="Amount *" type="number" testid="exp-amount" value={form.amount || ""} onChange={(v) => setForm({...form, amount: v})} required />
                  <Field label="Notes" testid="exp-notes" value={form.notes || ""} onChange={(v) => setForm({...form, notes: v})} />
                </>
              )}
              {error && <div className="text-xs text-destructive">{error}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={close} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary">Cancel</button>
                <button type="submit" data-testid={`submit-${dialog}`}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#166534]">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, testid }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input data-testid={testid} type={type} required={required} value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
    </div>
  );
}

function SelectField({ label, value, onChange, options, required, testid }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <select data-testid={testid} required={required} value={value || ""} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary capitalize">
        <option value="">Select…</option>
        {options.map(o => <option key={o.value} value={o.value} className="capitalize">{o.label}</option>)}
      </select>
    </div>
  );
}

export { Field, SelectField };
