// Shared helpers for the "Bazaar" feature — sell-by-unit produce & goods built
// on the same engine as "My Kitchen". The only data differences from food are
// (1) each item has a selling unit and (2) the section is branded separately.
// Order/payment/follow/push logic is reused from food unchanged.

export type FoodKind = "KITCHEN" | "MARKET";

// Selling units a seller can pick per item. `value` is stored; `label` displays.
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

/** Short display label for a stored unit value ("g500" → "500g"). */
export function unitLabel(unit: string | null | undefined): string {
  if (!unit) return "";
  return MARKET_UNITS.find((u) => u.value === unit)?.label ?? unit;
}

/** Canonical price rendering: "₹100/kg" for market items, "₹100" otherwise. */
export function formatUnitPrice(price: number, unit: string | null | undefined): string {
  return unit ? `₹${price}/${unitLabel(unit)}` : `₹${price}`;
}

// One label map drives all kind-aware copy across web + mobile.
export const KIND_LABELS: Record<
  FoodKind,
  {
    section: string;
    sectionPath: string;
    seller: string;
    sellerCap: string;
    stall: string;
    stallCap: string;
    item: string;
    itemPlural: string;
    listing: string;
    newCta: string;
    publishCta: string;
    pushPublishEmoji: string;
    pushPublishVerb: string;
    pushOrderTitle: string;
  }
> = {
  KITCHEN: {
    section: "Food",
    sectionPath: "/food",
    seller: "chef",
    sellerCap: "Chef",
    stall: "kitchen",
    stallCap: "Kitchen",
    item: "dish",
    itemPlural: "dishes",
    listing: "menu",
    newCta: "New menu",
    publishCta: "Publish menu",
    pushPublishEmoji: "🍲",
    pushPublishVerb: "published a menu",
    pushOrderTitle: "🧾 New food order",
  },
  MARKET: {
    section: "Bazaar",
    sectionPath: "/bazaar",
    seller: "seller",
    sellerCap: "Seller",
    stall: "stall",
    stallCap: "Stall",
    item: "item",
    itemPlural: "items",
    listing: "stall",
    newCta: "New stall",
    publishCta: "List goods",
    pushPublishEmoji: "🛒",
    pushPublishVerb: "listed fresh goods",
    pushOrderTitle: "🛒 New Bazaar order",
  },
};

/** Normalise an arbitrary string to a valid FoodKind (defaults KITCHEN). */
export function asKind(raw: unknown): FoodKind {
  return raw === "MARKET" ? "MARKET" : "KITCHEN";
}
