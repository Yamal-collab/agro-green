import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Plus, X, Droplet, Truck } from "lucide-react";
import { Field, SelectField } from "@/pages/Poultry";
import { paymentStatusBadge, lorryStatusBadge } from "@/lib/badges";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function Water() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("tanks");
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");

  const tanks = useQuery({ queryKey: ["tanks"], queryFn: async () => (await api.get("/water/tanks")).data });
  const lorries = useQuery({ queryKey: ["lorries"], queryFn: async () => (await api.get("/water/lorries")).data });
  const sales = useQuery({ queryKey: ["water-sales"], queryFn: async () => (await api.get("/water/sales")).data });
  const expenses = useQuery({ queryKey: ["water-expenses"], queryFn: async () => (await api.get("/water/expenses")).data });
  const customers = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });

  const open = (type, defaults = {}) => { setDialog(type); setForm(defaults); setError(""); };
  const close = () => { setDialog(null); setForm({}); setError(""); };

  const create = useMutation({
    mutationFn: async ({ url, payload }) => (await api.post(url, payload)).data,
    onSuccess: () => { qc.invalidateQueries(); close(); },
    onError: (e) => setError(formatApiError(e.response?.data?.detail)),
  });
  const adjust = useMutation({
    mutationFn: async ({ tid, delta }) => (await api.post(`/water/tanks/${tid}/adjust`, { delta, reason: "manual" })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tanks"] }),
  });

  const submit = (e) => {
    e.preventDefault();
    if (dialog === "tank") {
      create.mutate({ url: "/water/tanks", payload: {
        name: form.name, capacity: parseFloat(form.capacity), current_liters: parseFloat(form.current_liters || 0)
      }});
    } else if (dialog === "lorry") {
      create.mutate({ url: "/water/lorries", payload: {
        registration_no: form.registration_no, capacity: parseFloat(form.capacity),
        driver_name: form.driver_name || "", status: form.status || "idle"
      }});
    } else if (dialog === "sale") {
      const cust = customers.data?.find(c => c.id === form.customer_id);
      create.mutate({ url: "/water/sales", payload: {
        customer_id: form.customer_id, customer_name: cust?.name || "",
        date: form.date, liters: parseFloat(form.liters), rate: parseFloat(form.rate),
        delivery: parseFloat(form.delivery || 0), payment_status: form.payment_status || "pending",
        lorry_id: form.lorry_id || null,
      }});
    } else if (dialog === "expense") {
      create.mutate({ url: "/water/expenses", payload: {
        category: form.category, amount: parseFloat(form.amount),
        date: form.date, notes: form.notes || "", lorry_id: form.lorry_id || null,
      }});
    }
  };

  return (
    <div data-testid="water-page">
      <PageHeader
        title="Water Distribution"
        subtitle="Tanks, lorry fleet, sales and operating expenses"
        action={
          <div className="flex gap-2">
            <button data-testid="btn-add-tank" onClick={() => open("tank")}
              className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-secondary">
              <Plus className="h-4 w-4" /> Tank
            </button>
            <button data-testid="btn-add-lorry" onClick={() => open("lorry", { status: "idle" })}
              className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-secondary">
              <Plus className="h-4 w-4" /> Lorry
            </button>
            <button data-testid="btn-add-water-sale" onClick={() => open("sale", { date: new Date().toISOString().slice(0,10), payment_status: "pending" })}
              className="flex items-center gap-2 rounded-md text-white px-3 py-2 text-sm font-semibold" style={{ backgroundColor: "#0284C7" }}>
              <Plus className="h-4 w-4" /> Sale
            </button>
            <button data-testid="btn-add-water-expense" onClick={() => open("expense", { date: new Date().toISOString().slice(0,10), category: "Fuel" })}
              className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-secondary">
              <Plus className="h-4 w-4" /> Expense
            </button>
          </div>
        }
      />

      <div className="flex gap-2 mb-4 border-b border-border" data-testid="water-tabs">
        {["tanks", "lorries", "sales", "expenses"].map((t) => (
          <button key={t} data-testid={`tab-water-${t}`} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px capitalize ${
              tab === t ? "text-[#0284C7]" : "border-transparent text-muted-foreground hover:text-foreground"
            }`} style={tab === t ? { borderColor: "#0284C7" } : {}}>{t}</button>
        ))}
      </div>

      {tab === "tanks" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="tanks-grid">
          {(tanks.data || []).map((t) => {
            const pct = t.capacity > 0 ? (t.current_liters / t.capacity) * 100 : 0;
            return (
              <div key={t.id} className="bg-white border border-border rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Droplet className="h-5 w-5" style={{ color: "#0284C7" }} />
                  <div className="font-bold text-lg" style={{ fontFamily: "var(--font-heading)" }}>{t.name}</div>
                </div>
                <div className="text-3xl font-bold mb-1" style={{ color: "#0284C7", fontFamily: "var(--font-heading)" }}>
                  {Math.round(t.current_liters).toLocaleString()}<span className="text-sm text-muted-foreground font-normal"> / {t.capacity.toLocaleString()} L</span>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-3">
                  <div className="h-full transition-all" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: "#0284C7" }} />
                </div>
                <div className="flex gap-2">
                  <button data-testid={`tank-add-${t.id}`} onClick={() => adjust.mutate({ tid: t.id, delta: 1000 })}
                    className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs font-semibold hover:bg-secondary">+1000 L</button>
                  <button data-testid={`tank-sub-${t.id}`} onClick={() => adjust.mutate({ tid: t.id, delta: -1000 })}
                    className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs font-semibold hover:bg-secondary">-1000 L</button>
                </div>
              </div>
            );
          })}
          {(tanks.data || []).length === 0 && (
            <div className="col-span-full bg-white border border-dashed border-border rounded-lg p-12 text-center">
              <Droplet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <div className="text-sm text-muted-foreground">No tanks configured</div>
            </div>
          )}
        </div>
      )}

      {tab === "lorries" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="lorries-grid">
          {(lorries.data || []).map((l) => (
            <div key={l.id} className="bg-white border border-border rounded-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5" style={{ color: "#0284C7" }} />
                  <div className="font-bold text-lg font-mono">{l.registration_no}</div>
                </div>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${lorryStatusBadge(l.status)}`}>{l.status}</span>
              </div>
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">Capacity:</span> <span className="font-semibold">{l.capacity} L</span></div>
                <div><span className="text-muted-foreground">Driver:</span> <span className="font-semibold">{l.driver_name || "Unassigned"}</span></div>
              </div>
            </div>
          ))}
          {(lorries.data || []).length === 0 && (
            <div className="col-span-full bg-white border border-dashed border-border rounded-lg p-12 text-center">
              <Truck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <div className="text-sm text-muted-foreground">No lorries registered</div>
            </div>
          )}
        </div>
      )}

      {tab === "sales" && (
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="water-sales-table">
            <thead className="bg-secondary text-muted-foreground">
              <tr className="text-[10px] uppercase tracking-wider">
                <th className="text-left py-3 px-4">Invoice</th><th className="text-left">Customer</th>
                <th className="text-left">Date</th><th className="text-right">Liters</th>
                <th className="text-right">Rate</th><th className="text-right">Total</th>
                <th className="text-right px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {(sales.data || []).map(s => (
                <tr key={s.id} className="border-t border-border hover:bg-background/60">
                  <td className="py-3 px-4 font-mono text-xs">{s.invoice_no}</td>
                  <td>{s.customer_name}</td><td className="text-xs">{s.date}</td>
                  <td className="text-right">{s.liters}</td>
                  <td className="text-right">{currency(s.rate)}</td>
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
          <table className="w-full text-sm" data-testid="water-expenses-table">
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
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" data-testid={`water-${dialog}-dialog`}>
          <div className="bg-white rounded-lg w-full max-w-md p-6 border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold capitalize" style={{ fontFamily: "var(--font-heading)" }}>Add {dialog}</h2>
              <button onClick={close}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              {dialog === "tank" && (<>
                <Field label="Name *" testid="tank-name" value={form.name || ""} onChange={(v) => setForm({...form, name: v})} required />
                <Field label="Capacity (L) *" type="number" testid="tank-cap" value={form.capacity || ""} onChange={(v) => setForm({...form, capacity: v})} required />
                <Field label="Current Liters" type="number" testid="tank-curr" value={form.current_liters || 0} onChange={(v) => setForm({...form, current_liters: v})} />
              </>)}
              {dialog === "lorry" && (<>
                <Field label="Registration No *" testid="lorry-reg" value={form.registration_no || ""} onChange={(v) => setForm({...form, registration_no: v})} required />
                <Field label="Capacity (L) *" type="number" testid="lorry-cap" value={form.capacity || ""} onChange={(v) => setForm({...form, capacity: v})} required />
                <Field label="Driver Name" testid="lorry-driver" value={form.driver_name || ""} onChange={(v) => setForm({...form, driver_name: v})} />
                <SelectField label="Status" testid="lorry-status" value={form.status} onChange={(v) => setForm({...form, status: v})}
                  options={["idle", "transit", "maintenance"].map(o => ({ value: o, label: o }))} />
              </>)}
              {dialog === "sale" && (<>
                <SelectField label="Customer *" testid="wsale-cust" value={form.customer_id || ""} onChange={(v) => setForm({...form, customer_id: v})}
                  options={(customers.data || []).map(c => ({ value: c.id, label: c.name }))} required />
                <Field label="Date" type="date" testid="wsale-date" value={form.date} onChange={(v) => setForm({...form, date: v})} required />
                <Field label="Liters *" type="number" testid="wsale-liters" value={form.liters || ""} onChange={(v) => setForm({...form, liters: v})} required />
                <Field label="Rate (₹/L) *" type="number" testid="wsale-rate" value={form.rate || ""} onChange={(v) => setForm({...form, rate: v})} required />
                <Field label="Delivery" type="number" testid="wsale-delivery" value={form.delivery || 0} onChange={(v) => setForm({...form, delivery: v})} />
                <SelectField label="Lorry" testid="wsale-lorry" value={form.lorry_id || ""} onChange={(v) => setForm({...form, lorry_id: v})}
                  options={(lorries.data || []).map(l => ({ value: l.id, label: l.registration_no }))} />
                <SelectField label="Payment" testid="wsale-payment" value={form.payment_status} onChange={(v) => setForm({...form, payment_status: v})}
                  options={["pending", "partial", "paid"].map(o => ({ value: o, label: o }))} />
              </>)}
              {dialog === "expense" && (<>
                <SelectField label="Category" testid="wexp-cat" value={form.category} onChange={(v) => setForm({...form, category: v})}
                  options={["Fuel", "Driver Salary", "Maintenance", "Repairs", "Helper Wages", "Misc"].map(o => ({ value: o, label: o }))} required />
                <Field label="Date" type="date" testid="wexp-date" value={form.date} onChange={(v) => setForm({...form, date: v})} required />
                <Field label="Amount *" type="number" testid="wexp-amount" value={form.amount || ""} onChange={(v) => setForm({...form, amount: v})} required />
                <SelectField label="Lorry" testid="wexp-lorry" value={form.lorry_id || ""} onChange={(v) => setForm({...form, lorry_id: v})}
                  options={(lorries.data || []).map(l => ({ value: l.id, label: l.registration_no }))} />
                <Field label="Notes" testid="wexp-notes" value={form.notes || ""} onChange={(v) => setForm({...form, notes: v})} />
              </>)}
              {error && <div className="text-xs text-destructive">{error}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={close} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary">Cancel</button>
                <button type="submit" data-testid={`submit-water-${dialog}`}
                  className="rounded-md text-white px-4 py-2 text-sm font-semibold" style={{ backgroundColor: "#0284C7" }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
