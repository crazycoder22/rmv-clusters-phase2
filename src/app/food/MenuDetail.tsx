"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  BellOff,
  ChefHat,
  Store,
  Clock,
  Minus,
  Phone,
  Pencil,
  Plus,
  Power,
  Share2,
  ShoppingCart,
  Trash2,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import { type FoodKind, KIND_LABELS, formatUnitPrice, unitLabel, waNumber } from "@/lib/market";
import { track } from "@/lib/track-client";

// ── Types ──────────────────────────────────────────────────────────────────

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string | null;
  imageUrl: string | null;
  soldOut: boolean;
  stockQty?: number | null; // total available (null = unlimited)
  maxPerPerson?: number | null; // per-person cap (null = none)
  remaining?: number | null; // stock left (null = unlimited)
  myRemaining?: number | null; // how many more *I* can order (null = no cap)
}
interface OrderLine {
  name: string;
  price: number;
  unit: string | null;
  qty: number;
}
interface Order {
  id: string;
  status: "PLACED" | "CONFIRMED" | "CANCELLED";
  note: string | null;
  totalAmount: number;
  buyerPaid: boolean;
  chefPaid: boolean;
  items: OrderLine[];
  buyer?: { name: string; block: number; flatNumber: string; phone: string };
  manual?: boolean;
  manualBuyerName?: string | null;
}
interface MenuDetailData {
  id: string;
  title: string;
  description: string | null;
  orderByAt: string | null;
  pickupInfo: string | null;
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  kind: FoodKind;
  orderable: boolean;
  role: "chef" | "comanager" | "buyer";
  managers?: Manager[];
  chef: { id: string; name: string; block: number; flatNumber: string; phone: string | null; isMe: boolean; following: boolean };
  items: Dish[];
  orders: Order[];
}
interface Manager {
  id: string;
  name: string;
  block: number;
  flatNumber: string;
}

/** How an order line reads: "3 kg Apples" (market) | "2× Dosa" (kitchen). */
function lineText(i: { qty: number; name: string; unit: string | null }): string {
  return i.unit ? `${i.qty} ${unitLabel(i.unit)} ${i.name}` : `${i.qty}× ${i.name}`;
}

// `section` is the route's kind (KITCHEN for /food, MARKET for /bazaar). Once
// the menu loads we trust menu.kind; section only drives the pre-load back-link.
export default function MenuDetail({ section = "KITCHEN" }: { section?: FoodKind }) {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [menu, setMenu] = useState<MenuDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  // Offline ("manual") order the chef logs on a buyer's behalf.
  const [showManual, setShowManual] = useState(false);
  const [mName, setMName] = useState("");
  const [mCart, setMCart] = useState<Record<string, number>>({});
  const [mPaid, setMPaid] = useState(false);
  const [mBusy, setMBusy] = useState(false);
  const [mErr, setMErr] = useState<string | null>(null);

  const kind: FoodKind = menu?.kind ?? section;
  const L = KIND_LABELS[kind];

  useEffect(() => {
    // Not logged in (e.g. opened a shared WhatsApp link): send straight to
    // Google sign-in and return to THIS page afterwards so they can order.
    if (status === "unauthenticated") {
      signIn("google", {
        callbackUrl: typeof window !== "undefined" ? window.location.href : L.sectionPath,
      });
    }
  }, [status, L.sectionPath]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/food/menus/${id}`);
      if (!res.ok) {
        setError(res.status === 404 ? "Not found" : "Could not load");
        return;
      }
      const m: MenuDetailData = await res.json();
      setMenu(m);
      setError(null);
      track(m.kind === "MARKET" ? "bazaar" : "food", "detail", m.id);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) void refresh();
  }, [id, refresh]);

  const cartTotal = useMemo(() => {
    if (!menu) return 0;
    return menu.items.reduce((s, d) => s + (cart[d.id] ?? 0) * d.price, 0);
  }, [cart, menu]);
  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);

  // The most a buyer can add of one item right now = min(stock left, their own
  // remaining under the per-person cap). Infinity when neither limit is set.
  function dishMax(d: Dish): number {
    return Math.min(d.remaining ?? Infinity, d.myRemaining ?? Infinity);
  }

  function setQty(dishId: string, delta: number) {
    const d = menu?.items.find((x) => x.id === dishId);
    const max = d ? dishMax(d) : Infinity;
    setCart((prev) => {
      const next = Math.max(0, Math.min(max, (prev[dishId] ?? 0) + delta));
      const copy = { ...prev };
      if (next === 0) delete copy[dishId];
      else copy[dishId] = next;
      return copy;
    });
  }

  async function api(path: string, method: string, body?: unknown) {
    return fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async function placeOrder() {
    if (!menu || cartCount === 0) return;
    setPlacing(true);
    setError(null);
    try {
      const items = Object.entries(cart).map(([menuItemId, qty]) => ({ menuItemId, qty }));
      const res = await api(`/api/food/menus/${menu.id}/orders`, "POST", { items, note: note.trim() || null });
      if (!res.ok) {
        setError((await res.json().catch(() => null))?.error ?? "Could not place order");
        await refresh();
        return;
      }
      setCart({});
      setNote("");
      await refresh();
    } finally {
      setPlacing(false);
    }
  }

  async function orderAction(orderId: string, action: string) {
    setBusyOrderId(orderId);
    try {
      const res = await api(`/api/food/orders/${orderId}`, "PATCH", { action });
      if (res.ok) await refresh();
    } finally {
      setBusyOrderId(null);
    }
  }

  const mCount = Object.values(mCart).reduce((s, q) => s + q, 0);
  const mTotal = menu ? menu.items.reduce((s, d) => s + (mCart[d.id] ?? 0) * d.price, 0) : 0;
  function setMQty(dishId: string, delta: number) {
    setMCart((prev) => {
      const next = Math.max(0, (prev[dishId] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[dishId];
      else copy[dishId] = next;
      return copy;
    });
  }
  async function addManualOrder() {
    if (!menu) return;
    setMErr(null);
    if (!mName.trim()) { setMErr("Enter the buyer's name"); return; }
    if (mCount === 0) { setMErr("Add at least one item"); return; }
    setMBusy(true);
    try {
      const items = Object.entries(mCart).map(([menuItemId, qty]) => ({ menuItemId, qty }));
      const res = await api(`/api/food/menus/${menu.id}/manual-orders`, "POST", {
        buyerName: mName.trim(),
        items,
        paid: mPaid,
      });
      if (!res.ok) {
        setMErr((await res.json().catch(() => null))?.error ?? "Could not add order");
        return;
      }
      setMName(""); setMCart({}); setMPaid(false); setShowManual(false);
      await refresh();
    } finally {
      setMBusy(false);
    }
  }

  async function setMenuStatus(s: "OPEN" | "CLOSED") {
    if (!menu) return;
    await api(`/api/food/menus/${menu.id}`, "PATCH", { status: s });
    await refresh();
  }

  async function toggleSoldOut(dish: Dish) {
    if (!menu) return;
    await api(`/api/food/menus/${menu.id}`, "PATCH", { items: [{ id: dish.id, soldOut: !dish.soldOut }] });
    await refresh();
  }

  async function toggleFollow() {
    if (!menu) return;
    setFollowBusy(true);
    const next = !menu.chef.following;
    setMenu((m) => (m ? { ...m, chef: { ...m.chef, following: next } } : m));
    try {
      const res = await api(`/api/food/chefs/${menu.chef.id}/follow`, next ? "POST" : "DELETE");
      if (!res.ok) setMenu((m) => (m ? { ...m, chef: { ...m.chef, following: !next } } : m));
    } finally {
      setFollowBusy(false);
    }
  }

  async function deleteMenu() {
    if (!menu || !confirm(`Delete "${menu.title}"?`)) return;
    const res = await api(`/api/food/menus/${menu.id}`, "DELETE");
    if (res.ok) router.push(L.sectionPath);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center pt-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }
  if (error && !menu) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <BackLink L={L} />
          <p className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mt-4">{error}</p>
        </div>
      </div>
    );
  }
  if (!menu) return null;

  const isOwner = menu.role === "chef";
  // Owner + nominated co-managers both see the management view.
  const canManage = menu.role === "chef" || menu.role === "comanager";
  const isMarket = kind === "MARKET";
  const EmptyIcon = isMarket ? Store : ChefHat;

  function shareMenu() {
    if (!menu) return;
    const url = `${window.location.origin}${L.sectionPath}/menus/${menu.id}`;
    const headline = isMarket
      ? `🛒 ${menu.title} — ${menu.chef.name}'s stall`
      : `🍱 ${menu.title} — ${menu.chef.name}'s kitchen`;
    // Full item list + prices so residents who don't use the app can read
    // everything in the message and order offline (just reply / call).
    const itemLines = menu.items.map(
      (d) => `• ${d.name} — ${formatUnitPrice(d.price, d.unit)}${d.soldOut ? " (sold out)" : ""}`
    );
    // Tap-to-WhatsApp link straight to the chef, with a pre-filled message.
    const wa = waNumber(menu.chef.phone);
    const firstName = menu.chef.name.split(" ")[0];
    const dmLine = wa
      ? `💬 Or WhatsApp ${firstName} to order: https://wa.me/${wa}?text=${encodeURIComponent(
          `Hi ${firstName}! I'd like to order from your ${L.stall} "${menu.title}".`
        )}`
      : null;
    const text = [
      headline,
      menu.orderByAt ? `🕑 Order by ${fmtDateTime(menu.orderByAt)}` : null,
      menu.pickupInfo ? `📍 ${menu.pickupInfo}` : null,
      "",
      isMarket ? "On offer:" : "Menu:",
      ...itemLines,
      "",
      "🛒 Tap the link to order online (RMV residents):",
      url,
      dmLine,
    ]
      .filter((l) => l !== null)
      .join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  // Share the consolidated order list — for handing off to a delivery helper.
  function shareOrderList() {
    if (!menu) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(buildOrderListText(menu))}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <BackLink L={L} />

        <div className="flex items-start justify-between gap-2 mt-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{menu.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {isOwner
                ? `Your ${L.listing}`
                : canManage
                  ? `Co-managing ${menu.chef.name}'s ${L.listing}`
                  : `by ${menu.chef.name} · Block ${menu.chef.block}, ${menu.chef.flatNumber}`}
            </p>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={shareMenu}
                className="inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-400 hover:text-green-800 border border-green-200 dark:border-green-800 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800"
              >
                <Share2 size={14} /> Share
              </button>
              <Link href={`${L.sectionPath}/menus/${menu.id}/edit`} className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800">
                <Pencil size={14} /> Edit
              </Link>
            </div>
          )}
        </div>

        {menu.description && (
          <p className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-700 dark:text-gray-300 mt-3">{menu.description}</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400 mt-3">
          {menu.orderByAt && (
            <span className="inline-flex items-center gap-1"><Clock size={14} /> Order by {fmtDateTime(menu.orderByAt)}</span>
          )}
          {menu.pickupInfo && <span>📍 {menu.pickupInfo}</span>}
          {!canManage && menu.chef.phone && (
            <a href={`tel:${menu.chef.phone}`} className="inline-flex items-center gap-1 text-blue-600"><Phone size={14} /> {menu.chef.phone}</a>
          )}
        </div>

        {!canManage && (
          <button
            type="button"
            onClick={toggleFollow}
            disabled={followBusy}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium mt-3 ${
              menu.chef.following ? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {menu.chef.following ? <BellOff size={14} /> : <Bell size={14} />}
            {menu.chef.following ? `Following ${menu.chef.name.split(" ")[0]}` : `Follow ${menu.chef.name.split(" ")[0]}`}
          </button>
        )}

        {/* ── SELLER VIEW (owner + co-managers) ── */}
        {canManage && (
          <>
            <div className="flex gap-2 mt-5">
              {menu.status === "OPEN" ? (
                <button type="button" onClick={() => setMenuStatus("CLOSED")} className="inline-flex items-center gap-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-amber-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"><Power size={15} /> Close {L.listing}</button>
              ) : (
                <button type="button" onClick={() => setMenuStatus("OPEN")} className="inline-flex items-center gap-1 bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700"><Power size={15} /> Reopen {L.listing}</button>
              )}
              {/* Delete stays owner-only. */}
              {isOwner && (
                <button type="button" onClick={deleteMenu} className="inline-flex items-center gap-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg px-3 py-2 text-sm hover:text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700"><Trash2 size={15} /></button>
              )}
            </div>

            {/* Co-managers — owner + co-managers can add; only the owner removes. */}
            <CoManagers menuId={menu.id} L={L} managers={menu.managers ?? []} canRemove={isOwner} onChange={refresh} />

            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-6 mb-2">{L.itemPlural}</h2>
            <div className="space-y-2">
              {menu.items.map((d) => (
                <div key={d.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5">
                  <span className="flex-1 text-gray-900 dark:text-gray-100">
                    {d.name}
                    {d.maxPerPerson != null && <span className="ml-2 text-[11px] text-gray-400 dark:text-gray-500">· max {d.maxPerPerson}/person</span>}
                  </span>
                  {d.stockQty != null && (
                    <span className="text-xs font-semibold text-amber-600">{d.remaining ?? d.stockQty}/{d.stockQty} left</span>
                  )}
                  <span className="text-sm text-gray-600 dark:text-gray-300">{formatUnitPrice(d.price, d.unit)}</span>
                  <button type="button" onClick={() => toggleSoldOut(d)} className={`text-xs font-semibold rounded-full px-2.5 py-1 ${d.soldOut ? "text-red-700 bg-red-100" : "text-green-700 bg-green-100"}`}>
                    {d.soldOut ? "Sold out" : "Available"}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6 mb-2 gap-2">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Orders ({menu.orders.length})</h2>
              <div className="flex items-center gap-3">
                {menu.orders.some((o) => o.status !== "CANCELLED") && (
                  <button
                    type="button"
                    onClick={shareOrderList}
                    className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 hover:text-green-800"
                  >
                    <Share2 size={14} /> Share list
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowManual((s) => !s)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700"
                >
                  <Plus size={14} /> Add offline order
                </button>
              </div>
            </div>

            {showManual && (
              <div className="mb-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4 space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Log an order that came in over WhatsApp / phone so everything stays in one place.
                </p>
                <input
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  placeholder="Buyer's name (e.g. Mrs. Sharma, B2-301)"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800"
                />
                <div className="space-y-1.5">
                  {menu.items.map((d) => (
                    <div key={d.id} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{d.name} <span className="text-gray-400">· {formatUnitPrice(d.price, d.unit)}</span></span>
                      <div className="flex items-center gap-1.5">
                        {(mCart[d.id] ?? 0) > 0 && (
                          <>
                            <button type="button" onClick={() => setMQty(d.id, -1)} className="h-7 w-7 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"><Minus size={13} /></button>
                            <span className="w-5 text-center text-sm font-bold">{mCart[d.id]}</span>
                          </>
                        )}
                        <button type="button" onClick={() => setMQty(d.id, 1)} className="h-7 w-7 flex items-center justify-center rounded-full bg-blue-600 text-white"><Plus size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={mPaid} onChange={(e) => setMPaid(e.target.checked)} className="rounded" />
                  Already paid
                </label>
                {mErr && <p className="text-xs text-red-600">{mErr}</p>}
                <button
                  type="button"
                  onClick={addManualOrder}
                  disabled={mBusy}
                  className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {mBusy ? "Adding…" : `Add order${mCount > 0 ? ` · ₹${mTotal}` : ""}`}
                </button>
              </div>
            )}

            {menu.orders.length === 0 ? (
              <p className="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-8 text-center text-sm text-gray-500 dark:text-gray-400">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {menu.orders.map((o) => (
                  <ChefOrderCard key={o.id} order={o} busy={busyOrderId === o.id} onAction={(a) => orderAction(o.id, a)} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── BUYER VIEW ── */}
        {!canManage && (
          <>
            {menu.orders.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-6 mb-2">Your orders</h2>
                <div className="space-y-2">
                  {menu.orders.map((o) => (
                    <div key={o.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">{o.status}</span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">₹{o.totalAmount}</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{o.items.map(lineText).join(", ")}</p>
                      <div className="mt-2">
                        {o.chefPaid ? (
                          <span className="text-xs font-semibold text-green-600">Paid ✓ confirmed</span>
                        ) : o.buyerPaid ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-xs font-semibold text-amber-600">Paid — awaiting confirm</span>
                            <button type="button" onClick={() => orderAction(o.id, "unclaim_paid")} disabled={busyOrderId === o.id} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600">undo</button>
                          </span>
                        ) : o.status !== "CANCELLED" ? (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => orderAction(o.id, "claim_paid")} disabled={busyOrderId === o.id} className="text-xs font-semibold bg-blue-600 text-white rounded-md px-3 py-1 hover:bg-blue-700 disabled:opacity-50">I've paid</button>
                            {o.status === "PLACED" && (
                              <button type="button" onClick={() => orderAction(o.id, "cancel")} disabled={busyOrderId === o.id} className="text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-md px-3 py-1 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {menu.orderable ? (
              <>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-6 mb-2">{isMarket ? "On offer" : "Menu"}</h2>
                <div className="space-y-2">
                  {menu.items.map((d) => {
                    const have = cart[d.id] ?? 0;
                    const max = dishMax(d);
                    const out = d.soldOut || d.remaining === 0 || max <= 0;
                    return (
                    <div key={d.id} className={`flex gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 ${out ? "opacity-50" : ""}`}>
                      {d.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.imageUrl} alt="" className="h-20 w-20 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{d.name}</p>
                        {d.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{d.description}</p>}
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{formatUnitPrice(d.price, d.unit)}</p>
                        {!out && d.remaining != null && d.remaining > 0 && (
                          <p className="text-xs font-semibold text-amber-600 mt-0.5">Only {d.remaining} left</p>
                        )}
                        {d.maxPerPerson != null && (
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">Max {d.maxPerPerson} per person</p>
                        )}
                      </div>
                      {out ? (
                        <span className="self-center text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">Sold out</span>
                      ) : (
                        <div className="flex items-center gap-2 self-center">
                          {have > 0 && (
                            <>
                              <button type="button" onClick={() => setQty(d.id, -1)} className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200"><Minus size={15} /></button>
                              <span className="w-5 text-center font-bold">{have}</span>
                            </>
                          )}
                          <button type="button" disabled={have >= max} onClick={() => setQty(d.id, 1)} className={`h-8 w-8 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 ${have >= max ? "opacity-40 cursor-not-allowed" : ""}`}><Plus size={15} /></button>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>

                {cartCount > 0 && (
                  <div className="mt-4 space-y-2">
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={`Note for the ${L.seller} (optional)`} rows={2} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    {error && <p className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</p>}
                    <button type="button" onClick={placeOrder} disabled={placing} className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 disabled:opacity-50">
                      <ShoppingCart size={16} /> Place order · {cartCount} item{cartCount !== 1 ? "s" : ""} · ₹{cartTotal}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-10 text-center text-gray-500 dark:text-gray-400 mt-6">
                <EmptyIcon size={28} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                This {L.listing} isn&apos;t taking orders right now.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Owner-only: nominate other residents to help run this listing.
function CoManagers({
  menuId,
  L,
  managers,
  canRemove,
  onChange,
}: {
  menuId: string;
  L: (typeof KIND_LABELS)[FoodKind];
  managers: Manager[];
  canRemove: boolean;
  onChange: () => Promise<void> | void;
}) {
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Manager[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Debounced resident search.
  useEffect(() => {
    if (!adding) return;
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/residents/search?q=${encodeURIComponent(term)}`);
        if (res.ok) {
          const data = await res.json();
          const existing = new Set(managers.map((m) => m.id));
          setResults((data.residents ?? []).filter((r: Manager) => !existing.has(r.id)));
        }
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q, adding, managers]);

  async function add(residentId: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/food/menus/${menuId}/managers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentId }),
      });
      if (!res.ok) {
        setErr((await res.json().catch(() => null))?.error ?? "Could not add");
        return;
      }
      setQ(""); setResults([]); setAdding(false);
      await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove(residentId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/food/menus/${menuId}/managers?residentId=${encodeURIComponent(residentId)}`, { method: "DELETE" });
      if (res.ok) await onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <Users size={15} /> Co-managers
        </h2>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700">
            <UserPlus size={14} /> Add
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Co-managers can edit {L.itemPlural}, manage orders, and add other co-managers. Only the owner can remove them or delete the {L.listing}.
      </p>

      {managers.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {managers.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2">
              <span className="text-sm text-gray-800 dark:text-gray-200">{m.name} <span className="text-gray-400">· {m.block}-{m.flatNumber}</span></span>
              {canRemove && (
                <button type="button" onClick={() => remove(m.id)} disabled={busy} className="text-gray-400 hover:text-red-600 disabled:opacity-50"><X size={15} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-3 space-y-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a resident by name…"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900"
          />
          {err && <p className="text-xs text-red-600">{err}</p>}
          {results.length > 0 && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
              {results.map((r) => (
                <button key={r.id} type="button" onClick={() => add(r.id)} disabled={busy} className="w-full text-left px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
                  {r.name} <span className="text-gray-400">· {r.block}-{r.flatNumber}</span>
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => { setAdding(false); setQ(""); setResults([]); setErr(null); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}
    </div>
  );
}

function ChefOrderCard({ order, busy, onAction }: { order: Order; busy: boolean; onAction: (a: string) => void }) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${order.status === "CANCELLED" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {order.manual
            ? order.manualBuyerName || "Offline order"
            : order.buyer
              ? `${order.buyer.name} · ${order.buyer.block}-${order.buyer.flatNumber}`
              : "Order"}
          {order.manual && (
            <span className="ml-2 align-middle text-[10px] font-semibold text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 rounded-full px-1.5 py-0.5">offline</span>
          )}
        </span>
        <span className="font-bold text-gray-900 dark:text-gray-100">₹{order.totalAmount}</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{order.items.map(lineText).join(", ")}</p>
      {order.note && <p className="text-sm italic text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded px-2 py-1 mt-1">“{order.note}”</p>}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${order.status === "CONFIRMED" ? "text-green-700 bg-green-100" : order.status === "CANCELLED" ? "text-red-700 bg-red-100" : "text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700"}`}>{order.status}</span>
        {order.chefPaid ? (
          <span className="inline-flex items-center gap-2">
            <span className="text-xs font-semibold text-green-600">{order.manual ? "Paid ✓" : "Received ✓"}</span>
            <button type="button" onClick={() => onAction("unconfirm_paid")} disabled={busy} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600">undo</button>
          </span>
        ) : order.manual ? (
          // No buyer to claim payment — the chef marks the offline order paid.
          order.status !== "CANCELLED" ? (
            <button type="button" onClick={() => onAction("confirm_paid")} disabled={busy} className="text-xs font-semibold bg-green-600 text-white rounded-md px-3 py-1 hover:bg-green-700 disabled:opacity-50">Mark paid</button>
          ) : null
        ) : order.buyerPaid ? (
          <button type="button" onClick={() => onAction("confirm_paid")} disabled={busy} className="text-xs font-semibold bg-green-600 text-white rounded-md px-3 py-1 hover:bg-green-700 disabled:opacity-50">Confirm received</button>
        ) : order.status !== "CANCELLED" ? (
          <button type="button" onClick={() => onAction("confirm_paid")} disabled={busy} className="text-xs font-semibold border border-green-300 dark:border-green-800 text-green-700 dark:text-green-400 rounded-md px-3 py-1 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50">Mark paid (cash)</button>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">unpaid</span>
        )}
        {order.buyer?.phone && (
          <a href={`tel:${order.buyer.phone}`} className="inline-flex items-center gap-1 text-xs text-blue-600"><Phone size={11} /> call</a>
        )}
        {order.status !== "CANCELLED" && (
          <button type="button" onClick={() => onAction("cancel")} disabled={busy} className="ml-auto text-xs text-gray-400 dark:text-gray-500 hover:text-red-600">cancel</button>
        )}
      </div>
    </div>
  );
}

function BackLink({ L }: { L: (typeof KIND_LABELS)[FoodKind] }) {
  return (
    <Link href={L.sectionPath} className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900">
      <ArrowLeft size={16} /> Back to {L.section}
    </Link>
  );
}

// WhatsApp-ready delivery/packing list of every active order on a listing.
// Mirrored in mobile/src/pages/FoodMenuDetail.tsx.
function buildOrderListText(menu: MenuDetailData): string {
  const isMarket = menu.kind === "MARKET";
  const active = menu.orders.filter((o) => o.status !== "CANCELLED");
  const lines: string[] = [`${isMarket ? "🛒" : "🍱"} Order list — ${menu.title}`];
  if (menu.pickupInfo) lines.push(`📍 ${menu.pickupInfo}`);
  lines.push("");
  active.forEach((o, i) => {
    const who = o.buyer
      ? `${o.buyer.name} (B${o.buyer.block}-${o.buyer.flatNumber})`
      : `${o.manualBuyerName ?? "Offline"} (offline)`;
    const pay = o.chefPaid ? "✅ paid" : o.buyerPaid ? "⏳ paid (unconfirmed)" : "❌ unpaid";
    lines.push(`${i + 1}. ${who}`);
    lines.push(`   ${o.items.map(lineText).join(", ")} · ₹${o.totalAmount} · ${pay}`);
    if (o.buyer?.phone) lines.push(`   📞 ${o.buyer.phone}`);
    if (o.note) lines.push(`   📝 ${o.note}`);
  });
  const total = active.reduce((s, o) => s + o.totalAmount, 0);
  lines.push("", `Total: ${active.length} order${active.length !== 1 ? "s" : ""} · ₹${total}`);
  return lines.join("\n");
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
