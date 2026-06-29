import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Plus, X, BarChart3, Eye, Printer, Share2 } from "lucide-react";
import { Field, SelectField } from "@/pages/Poultry";
import { paymentStatusBadge } from "@/lib/badges";
import { openInvoice, printInvoice, shareInvoice } from "@/lib/invoice";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function Hatchery() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("batches");
  const [dlg, setDlg] = useState(null);
  const [f, setF] = useState({});
  const [err, setErr] = useState("");
  const [pnlBatch, setPnlBatch] = useState(null);
  const batches = useQuery({ queryKey: ["batches"], queryFn: async () => (await api.get("/hatchery/batches")).data });
  const eggs = useQuery({ queryKey: ["egg-purchases"], queryFn: async () => (await api.get("/egg/purchases")).data });
  const exps = useQuery({ queryKey: ["batch-expenses"], queryFn: async () => (await api.get("/hatchery/expenses")).data });
  const sales = useQuery({ queryKey: ["chick-sales"], queryFn: async () => (await api.get("/hatchery/sales")).data });
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: async () => (await api.get("/suppliers")).data });
  const customers = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });
  const pnl = useQuery({ queryKey: ["pnl", pnlBatch], queryFn: async () => (await api.get(`/hatchery/batches/${pnlBatch}/pnl`)).data, enabled: !!pnlBatch });
  const post = useMutation({
    mutationFn: async ({ url, payload, method = "post" }) => (await api[method](url, payload)).data,
    onSuccess: () => { qc.invalidateQueries(); setDlg(null); setF({}); setErr(""); },
    onError: (e) => setErr(formatApiError(e.response?.data?.detail)),
  });
  const open = (d, defaults = {}) => { setDlg(d); setF(defaults); setErr(""); };
  const submit = (e) => {
    e.preventDefault();
    if (dlg === "egg") post.mutate({ url: "/egg/purchases", payload: { ...f, quantity: +f.quantity, rate: +f.rate, transport: +(f.transport||0) }});
    if (dlg === "update") post.mutate({ url: `/hatchery/batches/${f.batch_id}`, method: "patch", payload: { hatched_chicks: +f.hatched_chicks, dead_eggs: +f.dead_eggs, hatch_date: f.hatch_date, status: f.status }});
    if (dlg === "expense") post.mutate({ url: "/hatchery/expenses", payload: { ...f, amount: +f.amount }});
    if (dlg === "sale") post.mutate({ url: "/hatchery/sales", payload: { ...f, quantity: +f.quantity, unit_price: +f.unit_price, transport: +(f.transport||0), discount: +(f.discount||0) }});
    if (dlg === "transfer") post.mutate({ url: "/hatchery/transfer", payload: { ...f, quantity: +f.quantity }});
  };
  return (
    <div data-testid="hatchery-page">
      <PageHeader title="Egg Hatchery (BU2)" subtitle="Egg purchase → 21-day incubation → chick sales / farm transfer"
        action={<div className="flex gap-2 flex-wrap">
          <button data-testid="btn-egg" onClick={() => open("egg", { date: today(), incubation_start: today() })} className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Egg Purchase</button>
          <button data-testid="btn-exp" onClick={() => open("expense", { date: today() })} className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Expense</button>
          <button data-testid="btn-csale" onClick={() => open("sale", { date: today(), payment_status: "pending" })} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Chick Sale</button>
          <button data-testid="btn-ctransfer" onClick={() => open("transfer", { date: today() })} className="flex items-center gap-2 rounded-md text-white px-3 py-2 text-sm font-semibold" style={{ backgroundColor: "#15803D" }}><Plus className="h-4 w-4" /> Transfer→Farm</button>
        </div>} />
      <div className="flex gap-2 mb-4 border-b border-border">{["batches", "purchases", "expenses", "sales"].map(t => <button key={t} data-testid={`tab-h-${t}`} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px capitalize ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{t}</button>)}</div>

      {tab === "batches" && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{(batches.data||[]).map(b => { const avail = b.hatched_chicks - (b.sold||0) - (b.transferred||0); return <div key={b.id} className="bg-white border border-border rounded-lg p-5"><div className="flex items-start justify-between mb-3"><div><div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Batch</div><div className="font-bold text-lg" style={{ fontFamily: "var(--font-heading)" }}>{b.batch_no}</div></div><span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold bg-secondary text-primary">{b.status}</span></div><div className="grid grid-cols-2 gap-3 text-sm mb-3"><div><div className="text-[10px] uppercase text-muted-foreground">Eggs</div><div className="font-semibold">{b.egg_qty}</div></div><div><div className="text-[10px] uppercase text-muted-foreground">Hatched</div><div className="font-semibold">{b.hatched_chicks}</div></div><div><div className="text-[10px] uppercase text-muted-foreground">Sold</div><div className="font-semibold">{b.sold||0}</div></div><div><div className="text-[10px] uppercase text-muted-foreground">Transferred</div><div className="font-semibold">{b.transferred||0}</div></div><div className="col-span-2"><div className="text-[10px] uppercase text-muted-foreground">Available</div><div className="font-semibold text-primary">{avail}</div></div></div><div className="flex gap-2"><button data-testid={`btn-update-${b.id}`} onClick={() => open("update", { batch_id: b.id, hatched_chicks: b.hatched_chicks, dead_eggs: b.dead_eggs, hatch_date: b.hatch_date || today(), status: b.status })} className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs font-semibold">Update</button><button data-testid={`btn-pnl-${b.id}`} onClick={() => setPnlBatch(b.id)} className="flex-1 rounded-md bg-primary text-white px-2 py-1.5 text-xs font-semibold flex items-center justify-center gap-1"><BarChart3 className="h-3 w-3" />P&L</button></div></div>; })}{(batches.data||[]).length === 0 && <div className="col-span-full bg-white border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">No batches yet — start with an egg purchase</div>}</div>}

      {tab === "purchases" && <div className="bg-white border border-border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-secondary text-muted-foreground"><tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-3 px-4">Date</th><th className="text-left">Supplier</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right px-4">Total</th></tr></thead><tbody>{(eggs.data||[]).map(e => { const su = suppliers.data?.find(s => s.id === e.supplier_id); return <tr key={e.id} className="border-t border-border"><td className="py-3 px-4 text-xs">{e.date}</td><td>{su?.name||"—"}</td><td className="text-right">{e.quantity}</td><td className="text-right">{currency(e.rate)}</td><td className="text-right px-4 font-semibold">{currency(e.total_cost)}</td></tr>; })}{(eggs.data||[]).length === 0 && <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No egg purchases</td></tr>}</tbody></table></div>}

      {tab === "expenses" && <div className="bg-white border border-border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-secondary text-muted-foreground"><tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-3 px-4">Date</th><th className="text-left">Batch</th><th className="text-left">Category</th><th className="text-left">Notes</th><th className="text-right px-4">Amount</th></tr></thead><tbody>{(exps.data||[]).map(e => { const b = batches.data?.find(x => x.id === e.batch_id); return <tr key={e.id} className="border-t border-border"><td className="py-3 px-4 text-xs">{e.date}</td><td className="text-xs font-mono">{b?.batch_no||"—"}</td><td>{e.category}</td><td className="text-muted-foreground text-xs">{e.notes}</td><td className="text-right px-4 font-semibold text-[#C2410C]">{currency(e.amount)}</td></tr>; })}{(exps.data||[]).length === 0 && <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No expenses</td></tr>}</tbody></table></div>}

      {tab === "sales" && <div className="bg-white border border-border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-secondary text-muted-foreground"><tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-3 px-4">Invoice</th><th className="text-left">Date</th><th className="text-left">Batch</th><th className="text-left">Customer</th><th className="text-right">Qty</th><th className="text-right">Total</th><th className="text-right">Status</th><th className="text-center px-4">Actions</th></tr></thead><tbody>{(sales.data||[]).map(s => <tr key={s.id} className="border-t border-border"><td className="py-3 px-4 font-mono text-xs">{s.invoice_no}</td><td className="text-xs">{s.date}</td><td className="text-xs font-mono">{s.batch_no}</td><td>{s.customer_name}</td><td className="text-right">{s.quantity}</td><td className="text-right font-semibold">{currency(s.total)}</td><td className="text-right"><span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${paymentStatusBadge(s.payment_status)}`}>{s.payment_status}</span></td><td className="text-center px-4"><InvoiceActions type="chick" id={s.id} /></td></tr>)}{(sales.data||[]).length === 0 && <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">No sales</td></tr>}</tbody></table></div>}

      {pnlBatch && pnl.data && <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"><div className="bg-white rounded-lg w-full max-w-md p-6 border border-border"><div className="flex justify-between items-start mb-4"><h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>Batch P&L · {pnl.data.batch.batch_no}</h2><button onClick={() => setPnlBatch(null)}><X className="h-5 w-5" /></button></div><div className="space-y-3 text-sm"><Row label="Egg Cost" value={currency(pnl.data.egg_cost)} /><Row label="Batch Expenses" value={currency(pnl.data.expenses_total)} /><Row label="Total Investment" value={currency(pnl.data.total_investment)} bold /><div className="border-t border-border my-2"></div><Row label="Sales Revenue" value={currency(pnl.data.sales_revenue)} /><Row label="Transfer Revenue (→Farm)" value={currency(pnl.data.transfer_revenue)} /><div className="border-t border-border my-2"></div><Row label="Profit" value={currency(pnl.data.profit)} bold colorClass={pnl.data.profit >= 0 ? "text-[#15803D]" : "text-[#C2410C]"} /></div></div></div>}

      {dlg && <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"><div className="bg-white rounded-lg w-full max-w-md p-6 border border-border max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-start mb-4"><h2 className="text-xl font-bold capitalize" style={{ fontFamily: "var(--font-heading)" }}>{dlg}</h2><button onClick={() => setDlg(null)}><X className="h-5 w-5" /></button></div>
        <form onSubmit={submit} className="space-y-3">
          {dlg === "egg" && <><SelectField label="Supplier *" testid="eg-sup" value={f.supplier_id||""} onChange={v=>setF({...f,supplier_id:v})} options={(suppliers.data||[]).map(s=>({value:s.id,label:s.name}))} required /><Field label="Date" type="date" testid="eg-date" value={f.date} onChange={v=>setF({...f,date:v})} required /><Field label="Quantity *" type="number" testid="eg-qty" value={f.quantity||""} onChange={v=>setF({...f,quantity:v})} required /><Field label="Rate *" type="number" testid="eg-rate" value={f.rate||""} onChange={v=>setF({...f,rate:v})} required /><Field label="Transport" type="number" testid="eg-tran" value={f.transport||0} onChange={v=>setF({...f,transport:v})} /><Field label="Incubation Start" type="date" testid="eg-incub" value={f.incubation_start} onChange={v=>setF({...f,incubation_start:v})} required /></>}
          {dlg === "update" && <><Field label="Hatch Date" type="date" testid="bu-hd" value={f.hatch_date||""} onChange={v=>setF({...f,hatch_date:v})} /><Field label="Hatched Chicks" type="number" testid="bu-hatched" value={f.hatched_chicks||0} onChange={v=>setF({...f,hatched_chicks:v})} /><Field label="Dead Eggs" type="number" testid="bu-dead" value={f.dead_eggs||0} onChange={v=>setF({...f,dead_eggs:v})} /><SelectField label="Status" testid="bu-status" value={f.status} onChange={v=>setF({...f,status:v})} options={["incubating","hatched","closed"].map(o=>({value:o,label:o}))} /></>}
          {dlg === "expense" && <><SelectField label="Batch *" testid="be-batch" value={f.batch_id||""} onChange={v=>setF({...f,batch_id:v})} options={(batches.data||[]).map(b=>({value:b.id,label:b.batch_no}))} required /><SelectField label="Category" testid="be-cat" value={f.category} onChange={v=>setF({...f,category:v})} options={["Electricity","Labour","Medicine","Vaccination","Water","Transport","Misc"].map(o=>({value:o,label:o}))} required /><Field label="Amount *" type="number" testid="be-amt" value={f.amount||""} onChange={v=>setF({...f,amount:v})} required /><Field label="Date" type="date" testid="be-date" value={f.date} onChange={v=>setF({...f,date:v})} required /><Field label="Notes" testid="be-notes" value={f.notes||""} onChange={v=>setF({...f,notes:v})} /></>}
          {dlg === "sale" && <><SelectField label="Batch *" testid="cs-batch" value={f.batch_id||""} onChange={v=>setF({...f,batch_id:v})} options={(batches.data||[]).map(b=>({value:b.id,label:`${b.batch_no} (${b.hatched_chicks-(b.sold||0)-(b.transferred||0)} avail)`}))} required /><SelectField label="Customer *" testid="cs-cus" value={f.customer_id||""} onChange={v=>setF({...f,customer_id:v})} options={(customers.data||[]).map(c=>({value:c.id,label:c.name}))} required /><Field label="Date" type="date" testid="cs-date" value={f.date} onChange={v=>setF({...f,date:v})} required /><Field label="Quantity *" type="number" testid="cs-qty" value={f.quantity||""} onChange={v=>setF({...f,quantity:v})} required /><Field label="Unit Price *" type="number" testid="cs-price" value={f.unit_price||""} onChange={v=>setF({...f,unit_price:v})} required /><Field label="Transport" type="number" testid="cs-tran" value={f.transport||0} onChange={v=>setF({...f,transport:v})} /><Field label="Discount" type="number" testid="cs-disc" value={f.discount||0} onChange={v=>setF({...f,discount:v})} /><SelectField label="Payment" testid="cs-pay" value={f.payment_status} onChange={v=>setF({...f,payment_status:v})} options={["pending","partial","paid"].map(o=>({value:o,label:o}))} /></>}
          {dlg === "transfer" && <><SelectField label="Batch *" testid="ct-batch" value={f.batch_id||""} onChange={v=>setF({...f,batch_id:v})} options={(batches.data||[]).map(b=>({value:b.id,label:`${b.batch_no} (${b.hatched_chicks-(b.sold||0)-(b.transferred||0)} avail)`}))} required /><Field label="Date" type="date" testid="ct-date" value={f.date} onChange={v=>setF({...f,date:v})} required /><Field label="Quantity *" type="number" testid="ct-qty" value={f.quantity||""} onChange={v=>setF({...f,quantity:v})} required /><Field label="Notes" testid="ct-notes" value={f.notes||""} onChange={v=>setF({...f,notes:v})} /></>}
          {err && <div className="text-xs text-destructive">{err}</div>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setDlg(null)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button><button data-testid={`submit-h-${dlg}`} type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Save</button></div>
        </form>
      </div></div>}
    </div>
  );
}

function Row({ label, value, bold, colorClass }) {
  return <div className="flex justify-between"><span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span><span className={`${bold ? "font-bold" : ""} ${colorClass||""}`}>{value}</span></div>;
}

function InvoiceActions({ type, id }) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        data-testid={`invoice-view-${id}`}
        title="View Invoice"
        onClick={() => openInvoice(type, id)}
        className="p-1.5 rounded hover:bg-secondary text-primary"
      ><Eye className="h-4 w-4" /></button>
      <button
        data-testid={`invoice-print-${id}`}
        title="Print Invoice"
        onClick={() => printInvoice(type, id)}
        className="p-1.5 rounded hover:bg-secondary text-primary"
      ><Printer className="h-4 w-4" /></button>
      <button
        data-testid={`invoice-share-${id}`}
        title="Share via WhatsApp"
        onClick={() => shareInvoice(type, id)}
        className="p-1.5 rounded hover:bg-secondary text-primary"
      ><Share2 className="h-4 w-4" /></button>
    </div>
  );
}
