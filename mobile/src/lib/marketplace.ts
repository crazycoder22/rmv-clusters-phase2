// Mobile copy of the marketplace category/type constants + price helper
// (mirrors src/lib/marketplace-categories.ts on the web).

export const MARKETPLACE_CATEGORIES = [
  { value: "FURNITURE", label: "Furniture" },
  { value: "ELECTRONICS", label: "Electronics" },
  { value: "BOOKS", label: "Books" },
  { value: "KITCHEN", label: "Kitchen" },
  { value: "KIDS", label: "Kids" },
  { value: "CLOTHING", label: "Clothing" },
  { value: "VEHICLES", label: "Vehicles" },
  { value: "OTHER", label: "Other" },
] as const;

export const LISTING_TYPES = [
  { value: "SELL", label: "Sell" },
  { value: "GIVEAWAY", label: "Giveaway" },
  { value: "RENT", label: "Rent" },
] as const;

export const RENT_PERIODS = [
  { value: "DAY", label: "per day" },
  { value: "WEEK", label: "per week" },
  { value: "MONTH", label: "per month" },
] as const;

export function getCategoryLabel(value: string): string {
  return MARKETPLACE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function getRentPeriodLabel(value: string | null | undefined): string {
  if (!value) return "";
  return RENT_PERIODS.find((p) => p.value === value)?.label ?? value;
}

export function formatPrice(
  price: number,
  listingType: string,
  rentPeriod?: string | null
): string {
  if (listingType === "GIVEAWAY") return "Free";
  const formatted = `₹${(price ?? 0).toLocaleString("en-IN")}`;
  if (listingType === "RENT" && rentPeriod) {
    return `${formatted} ${getRentPeriodLabel(rentPeriod)}`;
  }
  return formatted;
}

export const TYPE_BADGE: Record<string, string> = {
  SELL: "bg-indigo-500/20 text-indigo-300",
  GIVEAWAY: "bg-emerald-500/20 text-emerald-300",
  RENT: "bg-amber-500/20 text-amber-300",
};
