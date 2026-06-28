import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Plus, X } from "lucide-react";
import { Field } from "@/pages/Poultry";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function Suppliers() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ business_unit: 1 });
  const [err, setErr] = useState("");
  const { data: items = [] } = useQuery({ queryKey: ["suppliers"], queryFn: async () => (await api.get("/suppliers")).data });
  const create = useMutation({
    mutationFn: async (p) => (await api.post("/suppliers", p)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); setOpen(false); setForm({ business_unit: 1 }); },
    onError: (e) => setErr(formatApiError(e.response?.data?.detail)),
  });
  return (
    <div data-testid="suppliers-page">
      <PageHeader title="Suppliers" subtitle="Vendor directory + outstanding balances"
        action={<button data-testid="btn-add-supplier" onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add Supplier</button>} />
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-muted-foreground"><tr className="text-[10px] uppercase tracking-wider">
            <th className="text-left py-3 px-4">Name</th><th className="text-left">Phone</th><th className="text-left">BU</th><th className="text-right px-4">Outstanding</th>
          </tr></thead>
          <tbody>{items.map(s => (
            <tr key={s.id} className="border-t border-border"><td className="py-3 px-4 font-semibold">{s.name}</td><td className="font-mono text-xs">{s.phone || "—"}</td><td>BU{s.business_unit}</td>
              <td className="text-right px-4"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${s.outstanding > 0 ? "bg-[#C2410C]/10 text-[#C2410C]" : "bg-secondary text-primary"}`}>{currency(s.outstanding)}</span></td>
            </tr>))}{items.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-muted-foreground text-sm">No suppliers yet</td></tr>}</tbody>
        </table>
      </div>
      {open && (<div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg w-full max-w-md p-6 border border-border">
          <div className="flex justify-between items-start mb-4"><h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Add Supplier</h2><button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button></div>
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="space-y-3">
            <Field label="Name *" testid="sup-name" value={form.name || ""} onChange={(v) => setForm({...form, name: v})} required />
            <Field label="Phone" testid="sup-phone" value={form.phone || ""} onChange={(v) => setForm({...form, phone: v})} />
            <Field label="Address" testid="sup-addr" value={form.address || ""} onChange={(v) => setForm({...form, address: v})} />
            <Field label="GST" testid="sup-gst" value={form.gst || ""} onChange={(v) => setForm({...form, gst: v})} />
            {err && <div className="text-xs text-destructive">{err}</div>}
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button><button data-testid="submit-supplier" type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Save</button></div>
          </form>
        </div></div>)}
    </div>
  );
}
