import api, { API } from "@/lib/api";

// type: "feed" | "chick" | "farm"
export const invoicePdfUrl  = (type, id) => `${API}/invoice/${type}/${id}/pdf`;
export const invoicePrintUrl = (type, id) => `${API}/invoice/${type}/${id}/print`;

export function openInvoice(type, id) {
  window.open(invoicePdfUrl(type, id), "_blank", "noopener,noreferrer");
}

export function printInvoice(type, id) {
  // Open print page which auto-triggers print and allows re-print.
  window.open(invoicePrintUrl(type, id), "_blank", "noopener,noreferrer");
}

export async function shareInvoice(type, id) {
  try {
    const { data } = await api.post(`/invoice/${type}/${id}/share`);
    if (data?.whatsapp_url) {
      window.open(data.whatsapp_url, "_blank", "noopener,noreferrer");
    }
    return data;
  } catch (e) {
    alert("Failed to prepare share link. Please try again.");
    throw e;
  }
}
