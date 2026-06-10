// Mirror of the web src/lib/market.ts — the mobile Vite build is a separate app
// and cannot import from the web `src/`. Keep these two files in sync. Pure data.

export type FoodKind = "KITCHEN" | "MARKET";

export const MARKET_UNITS = [
  { value: "kg", label: "kg" },
  { value: "g500", label: "500g" },
  { value: "dozen", label: "dozen" },
  { value: "piece", label: "piece" },
  { value: "litre", label: "litre" },
  { value: "bunch", label: "bunch" },
  { value: "pack", label: "pack" },
  { value: "bundle", label: "bundle" },
] as const;

export const MARKET_UNIT_VALUES: string[] = MARKET_UNITS.map((u) => u.value);

export function unitLabel(unit: string | null | undefined): string {
  if (!unit) return "";
  return MARKET_UNITS.find((u) => u.value === unit)?.label ?? unit;
}

export function formatUnitPrice(price: number, unit: string | null | undefined): string {
  return unit ? `₹${price}/${unitLabel(unit)}` : `₹${price}`;
}

export const KIND_LABELS: Record<
  FoodKind,
  {
    section: string;
    sectionPath: string;
    createPath: string;
    seller: string;
    sellerCap: string;
    stall: string;
    stallCap: string;
    item: string;
    itemPlural: string;
    listing: string;
    newCta: string;
    publishCta: string;
  }
> = {
  KITCHEN: {
    section: "Food",
    sectionPath: "/food",
    createPath: "/food/menus/new",
    seller: "chef",
    sellerCap: "Chef",
    stall: "kitchen",
    stallCap: "Kitchen",
    item: "dish",
    itemPlural: "dishes",
    listing: "menu",
    newCta: "New menu",
    publishCta: "Publish menu",
  },
  MARKET: {
    section: "Food",
    sectionPath: "/food",
    createPath: "/food/stalls/new",
    seller: "seller",
    sellerCap: "Seller",
    stall: "stall",
    stallCap: "Stall",
    item: "item",
    itemPlural: "items",
    listing: "stall",
    newCta: "New stall",
    publishCta: "List goods",
  },
};

export function asKind(raw: unknown): FoodKind {
  return raw === "MARKET" ? "MARKET" : "KITCHEN";
}
