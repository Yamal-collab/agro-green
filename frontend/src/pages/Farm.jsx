import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Plus, X, Eye, Printer, Share2 } from "lucide-react";
import { Field, SelectField } from "@/pages/Poultry";
import { paymentStatusBadge } from "@/lib/badges";
import { openInvoice, printInvoice, shareInvoice } from "@/lib/invoice";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function Farm() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("stock");
  const [dlg, setDlg] = useState(null);
  const [f, setF] = useState({});
  const [err, setErr] = useState("");
  const stock = useQuery({ queryKey: ["farm-stock"], queryFn: async () => (await api.get("/farm/stock")).data });
  const sales = useQuery({ queryKey: ["farm-sales"], queryFn: async () => (await api.get("/farm/sales")).data });
  const exps = useQuery({ queryKey: ["farm-exps"], queryFn: async () => (await api.get("/farm/expenses")).data });
  const customers = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });
  const post = useMutation({
    mutationFn: async ({ url, payload }) => (await api.post(url, payload)).data,
    onSuccess: () => { qc.invalidateQueries(); setDlg(null); setF({}); setErr(""); },
    onError: (e) => setErr(formatApiError(e.response?.data?.detail)),
  });
  const open = (d, defaults = {}) => { setDlg(d); setF(defaults); setErr(""); };
  const submit = (e) => {
    e.preventDefault();
    if (dlg === "sale") post.mutate({ url: "/farm/sales", payload: { ...f, quantity: +f.quantity, unit_price: +f.unit_price, transport: +(f.transport||0), discount: +(f.discount||0) }});
    if (dlg === "expense") post.mutate({ url: "/farm/expenses", payload: { ...f, amount: +f.amount }});
  };
  const totalBirds = (stock.data||[]).reduce((a, s) => a + s.current_count, 0);
  return (
    <div data-testid="farm-page">
      <PageHeader title="Own Poultry Farm (BU3)" subtitle={`Current birds: ${totalBirds} · Sales, expenses, and chick stock from hatchery transfers`}
        action={<div className="flex gap-2">
          <button data-testid="btn-farm-sale" onClick={() => open("sale", { date: today(), payment_status: "pending" })} className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Sale</button>
          <button data-testid="btn-farm-exp" onClick={() => open("expense", { date: today() })} className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Expense</button>
        </div>} />
      <div className="flex gap-2 mb-4 border-b border-border">{["stock", "sales", "expenses"].map(t => <button key={t} data-testid={`tab-f-${t}`} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px capitalize ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{t}</button>)}</div>

      {tab === "stock" && <div className="bg-white border border-border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-secondary text-muted-foreground"><tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-3 px-4">Date Received</th><th className="text-left">From Batch</th><th className="text-right">Received</th><th className="text-right">Cost/Bird</th><th className="text-right px-4">Current</th></tr></thead><tbody>{(stock.data||[]).map(s => <tr key={s.id} className="border-t border-border"><td className="py-3 px-4 text-xs">{s.date}</td><td className="text-xs font-mono">{s.batch_no}</td><td className="text-right">{s.qty_received}</td><td className="text-right">{currency(s.transfer_cost_per_bird)}</td><td className="text-right px-4 font-semibold">{s.current_count}</td></tr>)}{(stock.data||[]).length === 0 && <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No stock — transfer chicks from Hatchery</td></tr>}</tbody></table></div>}

      {tab === "sales" && <div className="bg-white border border-border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-secondary text-muted-foreground"><tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-3 px-4">Invoice</th><th className="text-left">Date</th><th className="text-left">Customer</th><th className="text-right">Qty</th><th className="text-right">Total</th><th className="text-right">Status</th><th className="text-center px-4">Actions</th></tr></thead><tbody>{(sales.data||[]).map(s => <tr key={s.id} className="border-t border-border"><td className="py-3 px-4 font-mono text-xs">{s.invoice_no}</td><td className="text-xs">{s.date}</td><td>{s.customer_name}</td><td className="text-right">{s.quantity}</td><td className="text-right font-semibold">{currency(s.total)}</td><td className="text-right"><span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${paymentStatusBadge(s.payment_status)}`}>{s.payment_status}</span></td><td className="text-center px-4"><InvoiceActions type="farm" id={s.id} /></td></tr>)}{(sales.data||[]).length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No sales</td></tr>}</tbody></table></div>}

      {tab === "expenses" && <div className="bg-white border border-border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-secondary text-muted-foreground"><tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-3 px-4">Date</th><th className="text-left">Category</th><th className="text-left">Notes</th><th className="text-right px-4">Amount</th></tr></thead><tbody>{(exps.data||[]).map(e => <tr key={e.id} className="border-t border-border"><td className="py-3 px-4 text-xs">{e.date}</td><td>{e.category}</td><td className="text-muted-foreground text-xs">{e.notes}</td><td className="text-right px-4 font-semibold text-[#C2410C]">{currency(e.amount)}</td></tr>)}{(exps.data||[]).length === 0 && <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">No expenses</td></tr>}</tbody></table></div>}

      {dlg && <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"><div className="bg-white rounded-lg w-full max-w-md p-6 border border-border max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-start mb-4"><h2 className="text-xl font-bold capitalize" style={{ fontFamily: "var(--font-heading)" }}>Farm {dlg}</h2><button onClick={() => setDlg(null)}><X className="h-5 w-5" /></button></div>
        <form onSubmit={submit} className="space-y-3">
          {dlg === "sale" && <><SelectField label="Customer *" testid="fas-cus" value={f.customer_id||""} onChange={v=>setF({...f,customer_id:v})} options={(customers.data||[]).map(c=>({value:c.id,label:c.name}))} required /><Field label="Date" type="date" testid="fas-date" value={f.date} onChange={v=>setF({...f,date:v})} required /><Field label="Quantity *" type="number" testid="fas-qty" value={f.quantity||""} onChange={v=>setF({...f,quantity:v})} required /><Field label="Unit Price *" type="number" testid="fas-price" value={f.unit_price||""} onChange={v=>setF({...f,unit_price:v})} required /><Field label="Transport" type="number" testid="fas-tran" value={f.transport||0} onChange={v=>setF({...f,transport:v})} /><Field label="Discount" type="number" testid="fas-disc" value={f.discount||0} onChange={v=>setF({...f,discount:v})} /><SelectField label="Payment" testid="fas-pay" value={f.payment_status} onChange={v=>setF({...f,payment_status:v})} options={["pending","partial","paid"].map(o=>({value:o,label:o}))} /></>}
          {dlg === "expense" && <><SelectField label="Category" testid="fae-cat" value={f.category} onChange={v=>setF({...f,category:v})} options={["Feed","Medicine","Vaccination","Rent","Electricity","Labour","Transport","Misc"].map(o=>({value:o,label:o}))} required /><Field label="Amount *" type="number" testid="fae-amt" value={f.amount||""} onChange={v=>setF({...f,amount:v})} required /><Field label="Date" type="date" testid="fae-date" value={f.date} onChange={v=>setF({...f,date:v})} required /><Field label="Notes" testid="fae-notes" value={f.notes||""} onChange={v=>setF({...f,notes:v})} /></>}
          {err && <div className="text-xs text-destructive">{err}</div>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setDlg(null)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button><button data-testid={`submit-f-${dlg}`} type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">Save</button></div>
        </form>
      </div></div>}
    </div>
  );
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
