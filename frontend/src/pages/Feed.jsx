import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Plus, X, ArrowRightLeft } from "lucide-react";
import { Field, SelectField } from "@/pages/Poultry";
import { paymentStatusBadge } from "@/lib/badges";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function Feed() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("items");
  const [dlg, setDlg] = useState(null);
  const [f, setF] = useState({});
  const [err, setErr] = useState("");
  const items = useQuery({ queryKey: ["feed-items"], queryFn: async () => (await api.get("/feed/items")).data });
  const purchases = useQuery({ queryKey: ["feed-purchases"], queryFn: async () => (await api.get("/feed/purchases")).data });
  const sales = useQuery({ queryKey: ["feed-sales"], queryFn: async () => (await api.get("/feed/sales")).data });
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: async () => (await api.get("/suppliers")).data });
  const customers = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });
  const post = useMutation({
    mutationFn: async ({ url, payload }) => (await api.post(url, payload)).data,
    onSuccess: () => { qc.invalidateQueries(); setDlg(null); setF({}); setErr(""); },
    onError: (e) => setErr(formatApiError(e.response?.data?.detail)),
  });
  const open = (d, defaults = {}) => { setDlg(d); setF(defaults); setErr(""); };
  const submit = (e) => {
    e.preventDefault();
    if (dlg === "item") post.mutate({ url: "/feed/items", payload: f });
    if (dlg === "purchase") post.mutate({ url: "/feed/purchases", payload: { ...f, quantity: +f.quantity, purchase_rate: +f.purchase_rate, transport: +(f.transport||0), other: +(f.other||0) }});
    if (dlg === "sale") post.mutate({ url: "/feed/sales", payload: { ...f, quantity: +f.quantity, unit_price: +f.unit_price, transport: +(f.transport||0), discount: +(f.discount||0) }});
    if (dlg === "transfer") post.mutate({ url: "/feed/transfer", payload: { ...f, quantity: +f.quantity }});
  };
  return (
    <div data-testid="feed-page">
      <PageHeader title="Feed Trading (BU1)" subtitle="Purchases from Tamil Nadu → inventory → sales / farm transfers"
        action={<div className="flex gap-2">
          <button data-testid="btn-feed-item" onClick={() => open("item", { unit: "kg" })} className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Item</button>
          <button data-testid="btn-feed-purchase" onClick={() => open("purchase", { date: today(), payment_status: "pending" })} className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Purchase</button>
          <button data-testid="btn-feed-sale" onClick={() => open("sale", { date: today(), payment_status: "pending" })} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Sale</button>
          <button data-testid="btn-feed-transfer" onClick={() => open("transfer", { date: today() })} className="flex items-center gap-2 rounded-md text-white px-3 py-2 text-sm font-semibold" style={{ backgroundColor: "#15803D" }}><ArrowRightLeft className="h-4 w-4" /> Transfer→Farm</button>
        </div>} />
      <div className="flex gap-2 mb-4 border-b border-border">{["items", "purchases", "sales"].map(t => <button key={t} data-testid={`tab-${t}`} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px capitalize ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{t}</button>)}</div>

      {tab === "items" && <div className="bg-white border border-border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-secondary text-muted-foreground"><tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-3 px-4">Name</th><th className="text-left">Brand</th><th className="text-left">Category</th><th className="text-right">Stock</th><th className="text-right">WAC</th><th className="text-right px-4">Stock Value</th></tr></thead><tbody>{(items.data||[]).map(i => <tr key={i.id} className="border-t border-border"><td className="py-3 px-4 font-semibold">{i.name}</td><td>{i.brand}</td><td>{i.category}</td><td className="text-right">{i.current_stock} {i.unit}</td><td className="text-right">{currency(i.weighted_avg_cost)}</td><td className="text-right px-4 font-semibold">{currency(i.current_stock * i.weighted_avg_cost)}</td></tr>)}{(items.data||[]).length === 0 && <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No feed items</td></tr>}</tbody></table></div>}

      {tab === "purchases" && <div className="bg-white border border-border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-secondary text-muted-foreground"><tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-3 px-4">Date</th><th className="text-left">Feed</th><th className="text-left">Supplier</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right px-4">Total</th></tr></thead><tbody>{(purchases.data||[]).map(p => { const it = items.data?.find(i => i.id === p.feed_item_id); const su = suppliers.data?.find(s => s.id === p.supplier_id); return <tr key={p.id} className="border-t border-border"><td className="py-3 px-4 text-xs">{p.date}</td><td>{it?.name||"—"}</td><td>{su?.name||"—"}</td><td className="text-right">{p.quantity}</td><td className="text-right">{currency(p.purchase_rate)}</td><td className="text-right px-4 font-semibold">{currency(p.total_cost)}</td></tr>; })}{(purchases.data||[]).length === 0 && <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No purchases</td></tr>}</tbody></table></div>}

      {tab === "sales" && <div className="bg-white border border-border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-secondary text-muted-foreground"><tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-3 px-4">Invoice</th><th className="text-left">Date</th><th className="text-left">Customer</th><th className="text-left">Feed</th><th className="text-right">Qty</th><th className="text-right">Total</th><th className="text-right px-4">Status</th></tr></thead><tbody>{(sales.data||[]).map(s => <tr key={s.id} className="border-t border-border"><td className="py-3 px-4 font-mono text-xs">{s.invoice_no}</td><td className="text-xs">{s.date}</td><td>{s.customer_name}</td><td>{s.feed_name}</td><td className="text-right">{s.quantity}</td><td className="text-right font-semibold">{currency(s.total)}</td><td className="text-right px-4"><span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${paymentStatusBadge(s.payment_status)}`}>{s.payment_status}</span></td></tr>)}{(sales.data||[]).length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No sales</td></tr>}</tbody></table></div>}

      {dlg && <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"><div className="bg-white rounded-lg w-full max-w-md p-6 border border-border max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4"><h2 className="text-xl font-bold capitalize" style={{ fontFamily: "var(--font-heading)" }}>Add Feed {dlg}</h2><button onClick={() => setDlg(null)}><X className="h-5 w-5" /></button></div>
        <form onSubmit={submit} className="space-y-3">
          {dlg === "item" && <><Field label="Name *" testid="fi-name" value={f.name||""} onChange={v=>setF({...f,name:v})} required /><Field label="Brand" testid="fi-brand" value={f.brand||""} onChange={v=>setF({...f,brand:v})} /><Field label="Category" testid="fi-cat" value={f.category||""} onChange={v=>setF({...f,category:v})} /><Field label="Unit" testid="fi-unit" value={f.unit||"kg"} onChange={v=>setF({...f,unit:v})} /></>}
          {dlg === "purchase" && <><SelectField label="Supplier *" testid="fp-sup" value={f.supplier_id||""} onChange={v=>setF({...f,supplier_id:v})} options={(suppliers.data||[]).map(s=>({value:s.id,label:s.name}))} required /><SelectField label="Feed *" testid="fp-item" value={f.feed_item_id||""} onChange={v=>setF({...f,feed_item_id:v})} options={(items.data||[]).map(i=>({value:i.id,label:i.name}))} required /><Field label="Date" type="date" testid="fp-date" value={f.date} onChange={v=>setF({...f,date:v})} required /><Field label="Quantity *" type="number" testid="fp-qty" value={f.quantity||""} onChange={v=>setF({...f,quantity:v})} required /><Field label="Rate *" type="number" testid="fp-rate" value={f.purchase_rate||""} onChange={v=>setF({...f,purchase_rate:v})} required /><Field label="Transport" type="number" testid="fp-tran" value={f.transport||0} onChange={v=>setF({...f,transport:v})} /><Field label="Other" type="number" testid="fp-other" value={f.other||0} onChange={v=>setF({...f,other:v})} /><SelectField label="Payment" testid="fp-pay" value={f.payment_status} onChange={v=>setF({...f,payment_status:v})} options={["pending","partial","paid"].map(o=>({value:o,label:o}))} /></>}
          {dlg === "sale" && <><SelectField label="Customer *" testid="fs-cus" value={f.customer_id||""} onChange={v=>setF({...f,customer_id:v})} options={(customers.data||[]).map(c=>({value:c.id,label:c.name}))} required /><SelectField label="Feed *" testid="fs-item" value={f.feed_item_id||""} onChange={v=>setF({...f,feed_item_id:v})} options={(items.data||[]).map(i=>({value:i.id,label:`${i.name} (${i.current_stock} ${i.unit})`}))} required /><Field label="Date" type="date" testid="fs-date" value={f.date} onChange={v=>setF({...f,date:v})} required /><Field label="Quantity *" type="number" testid="fs-qty" value={f.quantity||""} onChange={v=>setF({...f,quantity:v})} required /><Field label="Unit Price *" type="number" testid="fs-price" value={f.unit_price||""} onChange={v=>setF({...f,unit_price:v})} required /><Field label="Transport" type="number" testid="fs-tran" value={f.transport||0} onChange={v=>setF({...f,transport:v})} /><Field label="Discount" type="number" testid="fs-disc" value={f.discount||0} onChange={v=>setF({...f,discount:v})} /><SelectField label="Payment" testid="fs-pay" value={f.payment_status} onChange={v=>setF({...f,payment_status:v})} options={["pending","partial","paid"].map(o=>({value:o,label:o}))} /></>}
          {dlg === "transfer" && <><SelectField label="Feed *" testid="ft-item" value={f.feed_item_id||""} onChange={v=>setF({...f,feed_item_id:v})} options={(items.data||[]).map(i=>({value:i.id,label:`${i.name} (${i.current_stock} ${i.unit})`}))} required /><Field label="Date" type="date" testid="ft-date" value={f.date} onChange={v=>setF({...f,date:v})} required /><Field label="Quantity *" type="number" testid="ft-qty" value={f.quantity||""} onChange={v=>setF({...f,quantity:v})} required /><Field label="Notes" testid="ft-notes" value={f.notes||""} onChange={v=>setF({...f,notes:v})} /></>}
          {err && <div className="text-xs text-destructive">{err}</div>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setDlg(null)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button><button data-testid={`submit-feed-${dlg}`} type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Save</button></div>
        </form>
      </div></div>}
    </div>
  );
}
