import React from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { ArrowRight } from "lucide-react";

const currency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const BU = { 1: "Feed", 2: "Hatchery", 3: "Farm", 4: "Water" };

export default function Transfers() {
  const { data = [] } = useQuery({ queryKey: ["transfers"], queryFn: async () => (await api.get("/transfers")).data });
  return (
    <div data-testid="transfers-page">
      <PageHeader title="Internal Transfers" subtitle="Movement of feed and chicks between business units (audit trail)" />
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-muted-foreground"><tr className="text-[10px] uppercase tracking-wider"><th className="text-left py-3 px-4">Date</th><th className="text-left">Type</th><th className="text-left">Flow</th><th className="text-left">Item / Batch</th><th className="text-right">Quantity</th><th className="text-right">Unit Cost</th><th className="text-right px-4">Total Value</th></tr></thead>
          <tbody>{data.map(t => (
            <tr key={t.id} className="border-t border-border">
              <td className="py-3 px-4 text-xs">{t.date}</td>
              <td><span className="capitalize text-[10px] font-semibold px-2 py-0.5 rounded bg-secondary text-primary">{t.type}</span></td>
              <td className="text-xs flex items-center gap-1">BU{t.from_unit} {BU[t.from_unit]} <ArrowRight className="h-3 w-3" /> BU{t.to_unit} {BU[t.to_unit]}</td>
              <td className="font-mono text-xs">{t.item_name}</td>
              <td className="text-right">{t.quantity}</td>
              <td className="text-right">{currency(t.unit_cost)}</td>
              <td className="text-right px-4 font-semibold">{currency(t.total_value)}</td>
            </tr>
          ))}{data.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No transfers yet</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}
