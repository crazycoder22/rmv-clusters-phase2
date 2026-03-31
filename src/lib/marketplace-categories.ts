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

export type MarketplaceCategory =
  (typeof MARKETPLACE_CATEGORIES)[number]["value"];

export const LISTING_TYPES = [
  { value: "SELL", label: "Sell" },
  { value: "GIVEAWAY", label: "Giveaway" },
  { value: "RENT", label: "Rent" },
] as const;

export type ListingType = (typeof LISTING_TYPES)[number]["value"];

export const RENT_PERIODS = [
  { value: "DAY", label: "per day" },
  { value: "WEEK", label: "per week" },
  { value: "MONTH", label: "per month" },
] as const;

export function getCategoryLabel(value: string): string {
  return (
    MARKETPLACE_CATEGORIES.find((c) => c.value === value)?.label ?? value
  );
}

export function getCategoryBadgeColor(value: string): string {
  const colors: Record<string, string> = {
    FURNITURE: "bg-amber-100 text-amber-700",
    ELECTRONICS: "bg-blue-100 text-blue-700",
    BOOKS: "bg-emerald-100 text-emerald-700",
    KITCHEN: "bg-orange-100 text-orange-700",
    KIDS: "bg-pink-100 text-pink-700",
    CLOTHING: "bg-purple-100 text-purple-700",
    VEHICLES: "bg-cyan-100 text-cyan-700",
    OTHER: "bg-gray-100 text-gray-700",
  };
  return colors[value] ?? "bg-gray-100 text-gray-700";
}

export function getListingTypeBadgeColor(value: string): string {
  const colors: Record<string, string> = {
    SELL: "bg-green-100 text-green-700",
    GIVEAWAY: "bg-violet-100 text-violet-700",
    RENT: "bg-teal-100 text-teal-700",
  };
  return colors[value] ?? "bg-gray-100 text-gray-700";
}

export function getRentPeriodLabel(value: string): string {
  return (
    RENT_PERIODS.find((p) => p.value === value)?.label ?? value
  );
}

export function formatPrice(
  price: number,
  listingType: string,
  rentPeriod?: string | null
): string {
  if (listingType === "GIVEAWAY") return "Free";
  const formatted = `₹${price.toLocaleString("en-IN")}`;
  if (listingType === "RENT" && rentPeriod) {
    return `${formatted} ${getRentPeriodLabel(rentPeriod)}`;
  }
  return formatted;
}
