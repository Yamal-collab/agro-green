import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api, { formatApiError } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Plus, X, Droplet } from "lucide-react";
import { Field, SelectField } from "@/pages/Poultry";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function Water() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("tanks");
  const [dlg, setDlg] = useState(null);
  const [f, setF] = useState({});
  const [err, setErr] = useState("");
  const tanks = useQuery({ queryKey: ["tanks"], queryFn: async () => (await api.get("/water/tanks")).data });
  const adds = useQuery({ queryKey: ["tank-adds"], queryFn: async () => (await api.get("/water/tank-additions")).data });
  const sales = useQuery({ queryKey: ["water-sales"], queryFn: async () => (await api.get("/water/sales")).data });
  const exps = useQuery({ queryKey: ["water-exps"], queryFn: async () => (await api.get("/water/expenses")).data });
  const customers = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });
  const post = useMutation({
    mutationFn: async ({ url, payload }) => (await api.post(url, payload)).data,
    onSuccess: () => { qc.invalidateQueries(); setDlg(null); setF({}); setErr(""); },
    onError: (e) => setErr(formatApiError(e.response?.data?.detail)),
  });
  const open = (d, defaults = {}) => { setDlg(d); setF(defaults); setErr(""); };
  const submit = (e) => {
    e.preventDefault();
    if (dlg === "tank") post.mutate({ url: "/water/tanks", payload: { ...f, capacity: +f.capacity, current_liters: +(f.current_liters||0) }});
    if (dlg === "add") post.mutate({ url: "/water/tank-additions", payload: { ...f, liters: +f.liters, loading_charge: +(f.loading_charge||0) }});
    if (dlg === "sale") post.mutate({ url: "/water/sales", payload: { ...f, liters: +f.liters, rate: +f.rate, received: +(f.received||0) }});
    if (dlg === "expense") post.mutate({ url: "/water/expenses", payload: { ...f, amount: +f.amount }});
  };
  return (
    <div data-testid="water-page">
      <PageHeader title="Water Distribution (BU4)" subtitle="Tanks → daily loading → customer deliveries (no invoice, ledger tracked)"
        action={<div className="flex gap-2 flex-wrap">
          <button data-testid="btn-tank" onClick={() => open("tank")} className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Tank</button>
          <button data-testid="btn-tank-add" onClick={() => open("add", { date: today() })} className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Loading</button>
          <button data-testid="btn-wsale" onClick={() => open("sale", { date: today() })} className="flex items-center gap-2 rounded-md text-white px-3 py-2 text-sm font-semibold" style={{ backgroundColor: "#0284C7" }}><Plus className="h-4 w-4" /> Sale</button>
          <button data-testid="btn-wexp" onClick={() => open("expense", { date: today() })} className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Expense</button>
        </div>} />
      <div className="flex gap-2 mb-4 border-b border-border">{["tanks", "loading", "sales", "expenses"].map(t => <button key={t} data-testid={`tab-w-${t}`} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px capitalize ${tab === t ? "border-[#0284C7] text-[#0284C7]" : "border-transparent text-muted-foreground"}`}>{t}</button>)}</div>

      {tab === "tanks" && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{(tanks.data||[]).map(t => { const pct = t.capacity > 0 ? (t.current_liters/t.capacity)*100 : 0; return <div key={t.id} className="bg-white border border-border rounded-lg p-5"><div className="flex items-center gap-3 mb-3"><Droplet className="h-5 w-5" style={{ color: "#0284C7" }} /><div className="font-bold text-lg" style={{ fontFamily: "var(--font-heading)" }}>{t.name}</div></div><div className="text-3xl font-bold mb-1" style={{ color: "#0284C7", fontFamily: "var(--font-heading)" }}>{Math.round(t.current_liters).toLocaleString()}<span className="text-sm text-muted-foreground font-normal"> / {t.capacity.toLocaleString()} L</span></div><div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-3"><div className="h-full" style={{ width: `${Math.min(100,pct)}%`, backgroundColor: "#0284C7" }} /></div></div>; })}{(tanks.data||[]).length === 0 && <div className="col-span-full bg-white border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">No tanks configured</div>}</div>}

      {tab === "loading" && <div className="bg-white border border-border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-secondary text-muted-foreground"><tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-3 px-4">Date</th><th className="text-left">Tank</th><th className="text-left">Source</th><th className="text-right">Liters</th><th className="text-right px-4">Loading ₹</th></tr></thead><tbody>{(adds.data||[]).map(a => { const t = tanks.data?.find(x => x.id === a.tank_id); return <tr key={a.id} className="border-t border-border"><td className="py-3 px-4 text-xs">{a.date}</td><td>{t?.name||"—"}</td><td>{a.source||"—"}</td><td className="text-right">{a.liters}</td><td className="text-right px-4">{currency(a.loading_charge)}</td></tr>; })}{(adds.data||[]).length === 0 && <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No loadings</td></tr>}</tbody></table></div>}

      {tab === "sales" && <div className="bg-white border border-border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-secondary text-muted-foreground"><tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-3 px-4">Date</th><th className="text-left">Customer</th><th className="text-right">Liters</th><th className="text-right">Rate</th><th className="text-right">Total</th><th className="text-right">Received</th><th className="text-right px-4">Pending</th></tr></thead><tbody>{(sales.data||[]).map(s => <tr key={s.id} className="border-t border-border"><td className="py-3 px-4 text-xs">{s.date}</td><td>{s.customer_name}</td><td className="text-right">{s.liters}</td><td className="text-right">{currency(s.rate)}</td><td className="text-right font-semibold">{currency(s.total)}</td><td className="text-right">{currency(s.received)}</td><td className="text-right px-4"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${s.pending > 0 ? "bg-[#C2410C]/10 text-[#C2410C]" : "bg-secondary text-primary"}`}>{currency(s.pending)}</span></td></tr>)}{(sales.data||[]).length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No sales</td></tr>}</tbody></table></div>}

      {tab === "expenses" && <div className="bg-white border border-border rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-secondary text-muted-foreground"><tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-3 px-4">Date</th><th className="text-left">Category</th><th className="text-left">Notes</th><th className="text-right px-4">Amount</th></tr></thead><tbody>{(exps.data||[]).map(e => <tr key={e.id} className="border-t border-border"><td className="py-3 px-4 text-xs">{e.date}</td><td>{e.category}</td><td className="text-muted-foreground text-xs">{e.notes}</td><td className="text-right px-4 font-semibold text-[#C2410C]">{currency(e.amount)}</td></tr>)}{(exps.data||[]).length === 0 && <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">No expenses</td></tr>}</tbody></table></div>}

      {dlg && <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"><div className="bg-white rounded-lg w-full max-w-md p-6 border border-border max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-start mb-4"><h2 className="text-xl font-bold capitalize" style={{ fontFamily: "var(--font-heading)" }}>Water {dlg}</h2><button onClick={() => setDlg(null)}><X className="h-5 w-5" /></button></div>
        <form onSubmit={submit} className="space-y-3">
          {dlg === "tank" && <><Field label="Name *" testid="wt-name" value={f.name||""} onChange={v=>setF({...f,name:v})} required /><Field label="Capacity (L) *" type="number" testid="wt-cap" value={f.capacity||""} onChange={v=>setF({...f,capacity:v})} required /><Field label="Initial Liters" type="number" testid="wt-curr" value={f.current_liters||0} onChange={v=>setF({...f,current_liters:v})} /></>}
          {dlg === "add" && <><SelectField label="Tank *" testid="wa-tank" value={f.tank_id||""} onChange={v=>setF({...f,tank_id:v})} options={(tanks.data||[]).map(t=>({value:t.id,label:t.name}))} required /><Field label="Date" type="date" testid="wa-date" value={f.date} onChange={v=>setF({...f,date:v})} required /><Field label="Liters *" type="number" testid="wa-l" value={f.liters||""} onChange={v=>setF({...f,liters:v})} required /><Field label="Source" testid="wa-src" value={f.source||""} onChange={v=>setF({...f,source:v})} /><Field label="Loading Charge ₹" type="number" testid="wa-load" value={f.loading_charge||0} onChange={v=>setF({...f,loading_charge:v})} /></>}
          {dlg === "sale" && <><SelectField label="Customer *" testid="ws-cus" value={f.customer_id||""} onChange={v=>setF({...f,customer_id:v})} options={(customers.data||[]).map(c=>({value:c.id,label:c.name}))} required /><Field label="Date" type="date" testid="ws-date" value={f.date} onChange={v=>setF({...f,date:v})} required /><Field label="Liters *" type="number" testid="ws-l" value={f.liters||""} onChange={v=>setF({...f,liters:v})} required /><Field label="Rate (₹/L) *" type="number" testid="ws-r" value={f.rate||""} onChange={v=>setF({...f,rate:v})} required /><Field label="Received Now" type="number" testid="ws-rcv" value={f.received||0} onChange={v=>setF({...f,received:v})} /><Field label="Notes" testid="ws-notes" value={f.notes||""} onChange={v=>setF({...f,notes:v})} /></>}
          {dlg === "expense" && <><SelectField label="Category" testid="we-cat" value={f.category} onChange={v=>setF({...f,category:v})} options={["Fuel","Maintenance","Repairs","Loading","Driver","Misc"].map(o=>({value:o,label:o}))} required /><Field label="Amount *" type="number" testid="we-amt" value={f.amount||""} onChange={v=>setF({...f,amount:v})} required /><Field label="Date" type="date" testid="we-date" value={f.date} onChange={v=>setF({...f,date:v})} required /><Field label="Notes" testid="we-notes" value={f.notes||""} onChange={v=>setF({...f,notes:v})} /></>}
          {err && <div className="text-xs text-destructive">{err}</div>}
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setDlg(null)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button><button data-testid={`submit-w-${dlg}`} type="submit" className="rounded-md text-white px-4 py-2 text-sm font-semibold" style={{ backgroundColor: "#0284C7" }}>Save</button></div>
        </form>
      </div></div>}
    </div>
  );
}
