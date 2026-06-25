// Shared helpers for the community food-ordering feature.

export const MAX_OPEN_MENUS = 5; // per chef, bounds push-spam + payload
export const MAX_QTY_PER_ITEM = 50;
export const MAX_COMANAGERS = 5; // nominated co-managers per listing

/**
 * Parse an optional limit field (stockQty / maxPerPerson) from a form/body.
 * Returns a positive integer, or null for "no limit" (empty, 0, or invalid).
 */
export function parseLimit(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Whether a resident is a nominated co-manager of a listing. Works with the
 * prisma client or a transaction client (anything with `foodMenuManager`).
 * The owner (chefId) is NOT a co-manager — callers OR this with the owner check.
 */
export async function isMenuManager(
  client: { foodMenuManager: { findUnique: (args: { where: { menuId_residentId: { menuId: string; residentId: string } }; select: { id: true } }) => Promise<{ id: string } | null> } },
  menuId: string,
  residentId: string
): Promise<boolean> {
  const row = await client.foodMenuManager.findUnique({
    where: { menuId_residentId: { menuId, residentId } },
    select: { id: true },
  });
  return !!row;
}

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
