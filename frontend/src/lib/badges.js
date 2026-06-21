// Status / severity → color helpers for consistent UI styling.

export function paymentStatusBadge(status) {
  if (status === "paid") return "bg-[#15803D]/10 text-[#15803D]";
  if (status === "partial") return "bg-[#CA8A04]/10 text-[#CA8A04]";
  return "bg-[#C2410C]/10 text-[#C2410C]";
}

export function lorryStatusBadge(status) {
  if (status === "transit") return "bg-[#CA8A04]/10 text-[#CA8A04]";
  if (status === "maintenance") return "bg-[#C2410C]/10 text-[#C2410C]";
  return "bg-secondary text-primary";
}

export function mortalityColor(percent) {
  if (percent > 10) return "#C2410C";
  if (percent > 5) return "#CA8A04";
  return "#15803D";
}

export function stockMoveBadge(type) {
  if (type === "in") return "bg-[#15803D]/10 text-[#15803D]";
  if (type === "out") return "bg-[#C2410C]/10 text-[#C2410C]";
  return "bg-secondary text-primary";
}
