// Shared helpers for the Food Vendors directory — external food vendors people
// order from over WhatsApp. Reuses the market unit/price + wa.me helpers.
import { formatUnitPrice, waNumber } from "./market";

// Section tags an item can carry (offered in a <select>; blank allowed).
export const VENDOR_SECTIONS = ["Veg", "Non-veg", "Sweets", "Snacks", "Other"] as const;

export interface VendorItemLike {
  name: string;
  price: number;
  unit: string | null;
  section?: string | null;
  note?: string | null;
}
export interface VendorShareLike {
  name: string;
  phone: string;
  forDate?: string | Date | null;
  deliveryInfo?: string | null;
  notes?: string | null;
  items: VendorItemLike[];
}

/** wa.me link that opens a chat with the vendor + a pre-filled order message. */
export function waOrderLink(phone: string | null | undefined, vendorName: string): string | null {
  const n = waNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(`Hi! I'd like to order from ${vendorName}.`)}`;
}

function fmtForDate(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** One item line: "• Moode — ₹60/piece (25 pieces)". */
export function vendorItemLine(it: VendorItemLike): string {
  const price = formatUnitPrice(it.price, it.unit);
  return `• ${it.name} — ${price}${it.note ? ` (${it.note})` : ""}`;
}

/**
 * WhatsApp-ready blurb for a vendor menu — forwardable to anyone, with the
 * order link at the bottom. Items are grouped by section.
 */
export function buildVendorShareText(vendor: VendorShareLike): string {
  const lines: string[] = [`🍽️ ${vendor.name}`];
  const d = fmtForDate(vendor.forDate);
  if (d) lines.push(`📅 ${d}`);
  if (vendor.deliveryInfo) lines.push(`🚚 ${vendor.deliveryInfo}`);
  lines.push("");

  // Group items by section, preserving first-seen order; untagged go last.
  const order: string[] = [];
  const bySection = new Map<string, VendorItemLike[]>();
  for (const it of vendor.items) {
    const key = it.section?.trim() || "";
    if (!bySection.has(key)) {
      bySection.set(key, []);
      order.push(key);
    }
    bySection.get(key)!.push(it);
  }
  for (const key of order) {
    if (key) lines.push(`*${key}*`);
    for (const it of bySection.get(key)!) lines.push(vendorItemLine(it));
    lines.push("");
  }

  if (vendor.notes) lines.push(vendor.notes, "");

  const link = waOrderLink(vendor.phone, vendor.name);
  lines.push(link ? `💬 Order on WhatsApp: ${link}` : `💬 Order: ${vendor.phone}`);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
