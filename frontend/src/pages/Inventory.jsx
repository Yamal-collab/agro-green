import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Plus, X, Package, AlertTriangle } from "lucide-react";
import { Field, SelectField } from "@/pages/Poultry";

export default function Inventory() {
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null); // "item" | "move"
  const [form, setForm] = useState({});
  const [error, setError] = useState("");

  const items = useQuery({ queryKey: ["inventory"], queryFn: async () => (await api.get("/inventory/items")).data });
  const moves = useQuery({ queryKey: ["inventory-moves"], queryFn: async () => (await api.get("/inventory/movements")).data });

  const open = (type, defaults = {}) => { setDialog(type); setForm(defaults); setError(""); };
  const close = () => { setDialog(null); setForm({}); setError(""); };

  const create = useMutation({
    mutationFn: async ({ url, payload }) => (await api.post(url, payload)).data,
    onSuccess: () => { qc.invalidateQueries(); close(); },
    onError: (e) => setError(formatApiError(e.response?.data?.detail)),
  });

  const submit = (e) => {
    e.preventDefault();
    if (dialog === "item") {
      create.mutate({ url: "/inventory/items", payload: {
        name: form.name, category: form.category, unit: form.unit || "kg",
        stock: parseFloat(form.stock || 0), threshold: parseFloat(form.threshold || 0)
      }});
    } else if (dialog === "move") {
      create.mutate({ url: "/inventory/move", payload: {
        item_id: form.item_id, type: form.type,
        quantity: parseFloat(form.quantity), reason: form.reason || ""
      }});
    }
  };

  return (
    <div data-testid="inventory-page">
      <PageHeader
        title="Inventory"
        subtitle="Track feed, medicine, vaccine and water stock with low-stock alerts"
        action={
          <div className="flex gap-2">
            <button data-testid="btn-add-item" onClick={() => open("item", { category: "feed", unit: "kg" })}
              className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-secondary">
              <Plus className="h-4 w-4" /> Item
            </button>
            <button data-testid="btn-move-stock" onClick={() => open("move", { type: "in" })}
              className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-[#166534]">
              <Plus className="h-4 w-4" /> Stock Movement
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6" data-testid="inventory-grid">
        {(items.data || []).map((i) => {
          const low = i.threshold > 0 && i.stock <= i.threshold;
          return (
            <div key={i.id} className={`bg-white border rounded-lg p-5 ${low ? "border-[#C2410C]" : "border-border"}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{i.category}</div>
                  <div className="font-bold text-lg" style={{ fontFamily: "var(--font-heading)" }}>{i.name}</div>
                </div>
                {low && <AlertTriangle className="h-5 w-5 text-[#C2410C]" />}
              </div>
              <div className="text-3xl font-bold mb-1" style={{ color: low ? "#C2410C" : "var(--agri-primary)", fontFamily: "var(--font-heading)" }}>
                {i.stock} <span className="text-sm text-muted-foreground font-normal">{i.unit}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Threshold: {i.threshold} {i.unit}
              </div>
            </div>
          );
        })}
        {(items.data || []).length === 0 && (
          <div className="col-span-full bg-white border border-dashed border-border rounded-lg p-12 text-center">
            <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <div className="text-sm text-muted-foreground">No inventory items yet</div>
          </div>
        )}
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="font-bold text-base" style={{ fontFamily: "var(--font-heading)" }}>Recent Movements</h3>
        </div>
        <table className="w-full text-sm" data-testid="inventory-moves-table">
          <thead className="bg-secondary text-muted-foreground">
            <tr className="text-[10px] uppercase tracking-wider">
              <th className="text-left py-3 px-4">Time</th><th className="text-left">Item</th>
              <th className="text-left">Type</th><th className="text-right">Qty</th>
              <th className="text-right">Prev</th><th className="text-right px-4">New</th>
            </tr>
          </thead>
          <tbody>
            {(moves.data || []).slice(0, 15).map(m => {
              const item = items.data?.find(i => i.id === m.item_id);
              return (
                <tr key={m.id} className="border-t border-border">
                  <td className="py-3 px-4 text-xs">{m.ts?.slice(0, 16).replace("T", " ")}</td>
                  <td>{item?.name || "—"}</td>
                  <td><span className={`uppercase text-[10px] font-semibold px-2 py-0.5 rounded ${
                    m.type === "in" ? "bg-[#15803D]/10 text-[#15803D]" : m.type === "out" ? "bg-[#C2410C]/10 text-[#C2410C]" : "bg-secondary text-primary"
                  }`}>{m.type}</span></td>
                  <td className="text-right">{m.quantity}</td>
                  <td className="text-right text-muted-foreground">{m.prev_stock}</td>
                  <td className="text-right px-4 font-semibold">{m.new_stock}</td>
                </tr>
              );
            })}
            {(moves.data || []).length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No movements yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" data-testid={`inv-${dialog}-dialog`}>
          <div className="bg-white rounded-lg w-full max-w-md p-6 border border-border">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold capitalize" style={{ fontFamily: "var(--font-heading)" }}>
                {dialog === "item" ? "Add Inventory Item" : "Stock Movement"}
              </h2>
              <button onClick={close}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              {dialog === "item" && (<>
                <Field label="Name *" testid="item-name" value={form.name || ""} onChange={(v) => setForm({...form, name: v})} required />
                <SelectField label="Category" testid="item-cat" value={form.category} onChange={(v) => setForm({...form, category: v})}
                  options={["feed", "medicine", "vaccine", "water", "other"].map(o => ({ value: o, label: o }))} required />
                <Field label="Unit" testid="item-unit" value={form.unit || "kg"} onChange={(v) => setForm({...form, unit: v})} />
                <Field label="Stock" type="number" testid="item-stock" value={form.stock || 0} onChange={(v) => setForm({...form, stock: v})} />
                <Field label="Low-stock Threshold" type="number" testid="item-threshold" value={form.threshold || 0} onChange={(v) => setForm({...form, threshold: v})} />
              </>)}
              {dialog === "move" && (<>
                <SelectField label="Item *" testid="move-item" value={form.item_id || ""} onChange={(v) => setForm({...form, item_id: v})}
                  options={(items.data || []).map(i => ({ value: i.id, label: `${i.name} (${i.stock} ${i.unit})` }))} required />
                <SelectField label="Type" testid="move-type" value={form.type} onChange={(v) => setForm({...form, type: v})}
                  options={["in", "out", "adjust"].map(o => ({ value: o, label: o }))} required />
                <Field label="Quantity *" type="number" testid="move-qty" value={form.quantity || ""} onChange={(v) => setForm({...form, quantity: v})} required />
                <Field label="Reason" testid="move-reason" value={form.reason || ""} onChange={(v) => setForm({...form, reason: v})} />
              </>)}
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
