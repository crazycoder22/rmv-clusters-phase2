// Shared helpers for the community food-ordering feature.

export const MAX_OPEN_MENUS = 5; // per chef, bounds push-spam + payload
export const MAX_QTY_PER_ITEM = 50;

/** Round a money value to 2 decimals (Float columns can drift). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface CartLine {
  menuItemId: string;
  qty: number;
}

/**
 * Validate + normalise an incoming cart. Returns the cleaned lines or an
 * error string. Does NOT touch the DB — price/sold-out/total are resolved
 * server-side inside the order transaction.
 */
export function validateCart(raw: unknown): { lines: CartLine[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "Your cart is empty" };
  }
  const lines: CartLine[] = [];
  const seen = new Set<string>();
  for (const item of raw as Array<{ menuItemId?: unknown; qty?: unknown }>) {
    const menuItemId = typeof item?.menuItemId === "string" ? item.menuItemId : "";
    const qty = Number(item?.qty);
    if (!menuItemId) return { error: "Invalid item in cart" };
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      return { error: `Quantity must be 1–${MAX_QTY_PER_ITEM}` };
    }
    if (seen.has(menuItemId)) {
      // merge duplicates rather than reject
      const existing = lines.find((l) => l.menuItemId === menuItemId)!;
      existing.qty = Math.min(MAX_QTY_PER_ITEM, existing.qty + qty);
    } else {
      seen.add(menuItemId);
      lines.push({ menuItemId, qty });
    }
  }
  return { lines };
}

/** Whether a menu is currently accepting orders (status + deadline check). */
export function isMenuOrderable(
  status: string,
  orderByAt: Date | null,
  now: Date = new Date()
): boolean {
  if (status !== "OPEN") return false;
  if (orderByAt && now.getTime() > orderByAt.getTime()) return false;
  return true;
}
