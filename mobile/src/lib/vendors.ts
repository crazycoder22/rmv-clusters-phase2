// Mirror of src/lib/vendors.ts — keep in sync. Food Vendors directory helpers.
import { formatUnitPrice, waNumber } from "./market";

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

export function vendorItemLine(it: VendorItemLike): string {
  const price = formatUnitPrice(it.price, it.unit);
  return `• ${it.name} — ${price}${it.note ? ` (${it.note})` : ""}`;
}

export function buildVendorShareText(vendor: VendorShareLike): string {
  const lines: string[] = [`🍽️ ${vendor.name}`];
  const d = fmtForDate(vendor.forDate);
  if (d) lines.push(`📅 ${d}`);
  if (vendor.deliveryInfo) lines.push(`🚚 ${vendor.deliveryInfo}`);
  lines.push("");

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
