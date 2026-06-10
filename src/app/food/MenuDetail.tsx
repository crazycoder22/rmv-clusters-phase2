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
} from "lucide-react";
import { type FoodKind, KIND_LABELS, formatUnitPrice, unitLabel } from "@/lib/market";

// ── Types ──────────────────────────────────────────────────────────────────

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  unit: string | null;
  imageUrl: string | null;
  soldOut: boolean;
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
  role: "chef" | "buyer";
  chef: { id: string; name: string; block: number; flatNumber: string; phone: string | null; isMe: boolean; following: boolean };
  items: Dish[];
  orders: Order[];
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
      setMenu(await res.json());
      setError(null);
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

  function setQty(dishId: string, delta: number) {
    setCart((prev) => {
      const next = Math.max(0, (prev[dishId] ?? 0) + delta);
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

  const isChef = menu.role === "chef";
  const isMarket = kind === "MARKET";
  const EmptyIcon = isMarket ? Store : ChefHat;

  function shareMenu() {
    if (!menu) return;
    const url = `${window.location.origin}${L.sectionPath}/menus/${menu.id}`;
    const headline = isMarket
      ? `🛒 ${menu.title} — ${menu.chef.name}'s stall`
      : `🍱 ${menu.title} — ${menu.chef.name}'s kitchen`;
    const text = [
      headline,
      menu.orderByAt ? `🕑 Order by ${fmtDateTime(menu.orderByAt)}` : null,
      isMarket
        ? "Tap to see what's on offer & place your order (RMV residents):"
        : "Tap to see the menu & place your order (RMV residents):",
      url,
    ]
      .filter(Boolean)
      .join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <BackLink L={L} />

        <div className="flex items-start justify-between gap-2 mt-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{menu.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {isChef ? `Your ${L.listing}` : `by ${menu.chef.name} · Block ${menu.chef.block}, ${menu.chef.flatNumber}`}
            </p>
          </div>
          {isChef && (
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
          {!isChef && menu.chef.phone && (
            <a href={`tel:${menu.chef.phone}`} className="inline-flex items-center gap-1 text-blue-600"><Phone size={14} /> {menu.chef.phone}</a>
          )}
        </div>

        {!isChef && (
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

        {/* ── SELLER VIEW ── */}
        {isChef && (
          <>
            <div className="flex gap-2 mt-5">
              {menu.status === "OPEN" ? (
                <button type="button" onClick={() => setMenuStatus("CLOSED")} className="inline-flex items-center gap-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-amber-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"><Power size={15} /> Close {L.listing}</button>
              ) : (
                <button type="button" onClick={() => setMenuStatus("OPEN")} className="inline-flex items-center gap-1 bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700"><Power size={15} /> Reopen {L.listing}</button>
              )}
              <button type="button" onClick={deleteMenu} className="inline-flex items-center gap-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-lg px-3 py-2 text-sm hover:text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700"><Trash2 size={15} /></button>
            </div>

            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-6 mb-2">{L.itemPlural}</h2>
            <div className="space-y-2">
              {menu.items.map((d) => (
                <div key={d.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5">
                  <span className="flex-1 text-gray-900 dark:text-gray-100">{d.name}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{formatUnitPrice(d.price, d.unit)}</span>
                  <button type="button" onClick={() => toggleSoldOut(d)} className={`text-xs font-semibold rounded-full px-2.5 py-1 ${d.soldOut ? "text-red-700 bg-red-100" : "text-green-700 bg-green-100"}`}>
                    {d.soldOut ? "Sold out" : "Available"}
                  </button>
                </div>
              ))}
            </div>

            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-6 mb-2">Orders ({menu.orders.length})</h2>
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
        {!isChef && (
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
                  {menu.items.map((d) => (
                    <div key={d.id} className={`flex gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 ${d.soldOut ? "opacity-50" : ""}`}>
                      {d.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.imageUrl} alt="" className="h-20 w-20 rounded-lg object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{d.name}</p>
                        {d.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{d.description}</p>}
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{formatUnitPrice(d.price, d.unit)}</p>
                      </div>
                      {d.soldOut ? (
                        <span className="self-center text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">Sold out</span>
                      ) : (
                        <div className="flex items-center gap-2 self-center">
                          {(cart[d.id] ?? 0) > 0 && (
                            <>
                              <button type="button" onClick={() => setQty(d.id, -1)} className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200"><Minus size={15} /></button>
                              <span className="w-5 text-center font-bold">{cart[d.id]}</span>
                            </>
                          )}
                          <button type="button" onClick={() => setQty(d.id, 1)} className="h-8 w-8 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"><Plus size={15} /></button>
                        </div>
                      )}
                    </div>
                  ))}
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

function ChefOrderCard({ order, busy, onAction }: { order: Order; busy: boolean; onAction: (a: string) => void }) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${order.status === "CANCELLED" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {order.buyer ? `${order.buyer.name} · ${order.buyer.block}-${order.buyer.flatNumber}` : "Order"}
        </span>
        <span className="font-bold text-gray-900 dark:text-gray-100">₹{order.totalAmount}</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{order.items.map(lineText).join(", ")}</p>
      {order.note && <p className="text-sm italic text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded px-2 py-1 mt-1">“{order.note}”</p>}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${order.status === "CONFIRMED" ? "text-green-700 bg-green-100" : order.status === "CANCELLED" ? "text-red-700 bg-red-100" : "text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700"}`}>{order.status}</span>
        {order.chefPaid ? (
          <span className="inline-flex items-center gap-2">
            <span className="text-xs font-semibold text-green-600">Received ✓</span>
            <button type="button" onClick={() => onAction("unconfirm_paid")} disabled={busy} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600">undo</button>
          </span>
        ) : order.buyerPaid ? (
          <button type="button" onClick={() => onAction("confirm_paid")} disabled={busy} className="text-xs font-semibold bg-green-600 text-white rounded-md px-3 py-1 hover:bg-green-700 disabled:opacity-50">Confirm received</button>
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

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
