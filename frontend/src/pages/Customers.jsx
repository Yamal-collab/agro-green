import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Plus, X, Search, Eye } from "lucide-react";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const BU_LABEL = { 1: "Feed", 2: "Hatchery", 3: "Farm", 4: "Water" };
const statusBadge = (s) =>
  s === "paid" ? "bg-[#15803D]/10 text-[#15803D]"
  : s === "partial" ? "bg-[#CA8A04]/10 text-[#CA8A04]"
  : "bg-[#C2410C]/10 text-[#C2410C]";

const empty = { name: "", business_name: "", phone: "", email: "", address: "", gst: "", credit_limit: 0, payment_terms: "Net 30", status: "active" };

export default function Customers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [detailId, setDetailId] = useState(null);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await api.get("/customers")).data,
  });

  const create = useMutation({
    mutationFn: async (payload) => (await api.post("/customers", payload)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); setOpen(false); setForm(empty); },
    onError: (e) => setError(formatApiError(e.response?.data?.detail)),
  });

  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.business_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").includes(search)
  );

  const submit = (e) => {
    e.preventDefault();
    setError("");
    create.mutate({ ...form, credit_limit: parseFloat(form.credit_limit) || 0 });
  };

  return (
    <div data-testid="customers-page">
      <PageHeader
        title="Customers"
        subtitle="Manage all your customers, credit limits and outstanding balances"
        action={
          <button data-testid="btn-add-customer" onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#166534] transition-colors">
            <Plus className="h-4 w-4" /> Add Customer
          </button>
        }
      />

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input data-testid="customers-search" placeholder="Search by name, business or phone…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-border bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm" data-testid="customers-table">
          <thead className="bg-secondary text-muted-foreground">
            <tr className="text-[10px] uppercase tracking-wider">
              <th className="text-left py-3 px-4">Name</th>
              <th className="text-left py-3">Business</th>
              <th className="text-left py-3">Phone</th>
              <th className="text-right py-3">Credit Limit</th>
              <th className="text-right py-3">Outstanding</th>
              <th className="text-center py-3 px-4">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-background/60" data-testid={`customer-row-${c.id}`}>
                <td className="py-3 px-4 font-semibold">{c.name}</td>
                <td className="text-muted-foreground">{c.business_name || c.farm_name || "—"}</td>
                <td className="font-mono text-xs">{c.phone || "—"}</td>
                <td className="text-right">{currency(c.credit_limit)}</td>
                <td className="text-right">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    c.outstanding > 0 ? "bg-[#C2410C]/10 text-[#C2410C]" : "bg-secondary text-primary"
                  }`}>{currency(c.outstanding)}</span>
                </td>
                <td className="text-center px-4">
                  <button
                    data-testid={`customer-details-${c.id}`}
                    onClick={() => setDetailId(c.id)}
                    className="p-1.5 rounded hover:bg-secondary text-primary"
                    title="View invoices and payment history"
                  ><Eye className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No customers found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" data-testid="customer-dialog">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 border border-border max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Add Customer</h2>
                <p className="text-xs text-muted-foreground mt-1">Create a new customer profile</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" data-testid="close-customer-dialog">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              {[
                ["name", "Name *", "text", true],
                ["business_name", "Business / Farm name", "text"],
                ["phone", "Phone", "text"],
                ["email", "Email", "email"],
                ["address", "Address", "text"],
                ["gst", "GST Number", "text"],
                ["credit_limit", "Credit Limit (₹)", "number"],
                ["payment_terms", "Payment Terms", "text"],
              ].map(([k, label, type, required]) => (
                <div key={k}>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
                  <input
                    data-testid={`customer-input-${k}`}
                    type={type} required={required} value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              ))}
              {error && <div className="text-xs text-destructive">{error}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary">Cancel</button>
                <button data-testid="submit-customer" type="submit" disabled={create.isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#166534] disabled:opacity-60">
                  {create.isPending ? "Saving…" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {detailId && <CustomerDetail customerId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function CustomerDetail({ customerId, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-details", customerId],
    queryFn: async () => (await api.get(`/customers/${customerId}/details`)).data,
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" data-testid="customer-detail-dialog">
      <div className="bg-white rounded-lg w-full max-w-3xl p-6 border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
              {data?.customer?.name || "Customer Details"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {data?.customer?.business_name || data?.customer?.farm_name || ""}
              {data?.customer?.phone ? ` · ${data.customer.phone}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading || !data ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <SummaryCard label="Total Billed" value={currency(data.summary.total_billed)} />
              <SummaryCard label="Total Paid" value={currency(data.summary.total_paid)} color="#15803D" />
              <SummaryCard label="Outstanding" value={currency(data.summary.total_due)} color="#C2410C" />
            </div>

            <h3 className="font-bold text-sm mb-2">Invoices</h3>
            <div className="border border-border rounded-md overflow-hidden mb-5">
              <table className="w-full text-sm" data-testid="customer-invoices-table">
                <thead className="bg-secondary text-muted-foreground">
                  <tr className="text-[10px] uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Invoice</th>
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">BU</th>
                    <th className="text-right py-2">Total</th>
                    <th className="text-right py-2">Paid</th>
                    <th className="text-right py-2">Due</th>
                    <th className="text-center py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map(i => (
                    <tr key={i.id} className="border-t border-border">
                      <td className="py-2 px-3 font-mono text-xs">{i.invoice_no || "—"}</td>
                      <td className="text-xs">{i.date}</td>
                      <td className="text-xs">{BU_LABEL[i.business_unit] || i.business_unit}</td>
                      <td className="text-right">{currency(i.total)}</td>
                      <td className="text-right text-[#15803D]">{currency(i.amount_paid)}</td>
                      <td className="text-right font-semibold text-[#C2410C]">{currency(i.balance_due)}</td>
                      <td className="text-center px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${statusBadge(i.payment_status)}`}>
                          {i.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.invoices.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-xs text-muted-foreground">No invoices</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <h3 className="font-bold text-sm mb-2">Payment History</h3>
            <div className="border border-border rounded-md overflow-hidden">
              <table className="w-full text-sm" data-testid="customer-payments-table">
                <thead className="bg-secondary text-muted-foreground">
                  <tr className="text-[10px] uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Date</th>
                    <th className="text-left py-2">Method</th>
                    <th className="text-left py-2">Notes</th>
                    <th className="text-left py-2">Applied To</th>
                    <th className="text-right py-2 px-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map(p => (
                    <tr key={p.id} className="border-t border-border align-top">
                      <td className="py-2 px-3 text-xs">{p.date}</td>
                      <td className="capitalize text-xs">{p.method}</td>
                      <td className="text-xs text-muted-foreground">{p.notes || "—"}</td>
                      <td className="text-xs">
                        {(p.allocations || []).map((a) => (
                          <div key={a.sale_id}>
                            <span className="font-mono">{a.invoice_no}</span>
                            <span className="text-muted-foreground"> · {currency(a.amount_applied)} → {a.new_status}</span>
                          </div>
                        ))}
                        {p.advance_amount > 0 && (
                          <div className="text-[#0284C7]">Advance: {currency(p.advance_amount)}</div>
                        )}
                      </td>
                      <td className="text-right px-3 font-semibold text-[#15803D]">{currency(p.amount)}</td>
                    </tr>
                  ))}
                  {data.payments.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">No payments yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="bg-white border border-border rounded-md p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="text-lg font-bold mt-1" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}
