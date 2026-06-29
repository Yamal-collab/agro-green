import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

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
                <td className="py-3 px-4 font-semibold">
                  <Link to={`/customers/${c.id}`} className="text-primary hover:underline" data-testid={`customer-link-${c.id}`}>{c.name}</Link>
                </td>
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
                    onClick={() => navigate(`/customers/${c.id}`)}
                    className="p-1.5 rounded hover:bg-secondary text-primary"
                    title="View account, invoices and statement"
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
    </div>
  );
}
