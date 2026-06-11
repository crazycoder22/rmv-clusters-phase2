import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  BellOff,
  ChefHat,
  Clock,
  Loader2,
  Minus,
  Phone,
  Pencil,
  Plus,
  Power,
  Share2,
  ShoppingCart,
  Store,
  Trash2,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import { Share } from "@capacitor/share";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthProvider";
import { type FoodKind, KIND_LABELS, formatUnitPrice, unitLabel } from "../lib/market";

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

/** "3 kg Apples" (market) | "2× Dosa" (kitchen). */
function lineText(i: { qty: number; name: string; unit: string | null }): string {
  return i.unit ? `${i.qty} ${unitLabel(i.unit)} ${i.name}` : `${i.qty}× ${i.name}`;
}

interface Order {
  id: string;
  status: "PLACED" | "CONFIRMED" | "CANCELLED";
  note: string | null;
  totalAmount: number;
  buyerPaid: boolean;
  chefPaid: boolean;
  createdAt: string;
  items: OrderLine[];
  buyer?: { name: string; block: number; flatNumber: string; phone: string };
  manual?: boolean;
  manualBuyerName?: string | null;
}

interface MenuDetail {
  id: string;
  title: string;
  description: string | null;
  date: string;
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

// ── Page ───────────────────────────────────────────────────────────────────

// `section` is the route's kind; once the menu loads we trust menu.kind.
export default function FoodMenuDetail({ section = "KITCHEN" }: { section?: FoodKind }) {
  const { id = "" } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [menu, setMenu] = useState<MenuDetail | null>(null);
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
  const isMarket = kind === "MARKET";

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/food/menus/${id}`, { token });
      if (!res.ok) {
        setError(res.status === 404 ? "Menu not found" : "Could not load");
        return;
      }
      setMenu(await res.json());
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cartTotal = useMemo(() => {
    if (!menu) return 0;
    return menu.items.reduce(
      (sum, d) => sum + (cart[d.id] ?? 0) * d.price,
      0
    );
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

  async function placeOrder() {
    if (!menu || cartCount === 0) return;
    setPlacing(true);
    setError(null);
    try {
      const items = Object.entries(cart).map(([menuItemId, qty]) => ({
        menuItemId,
        qty,
      }));
      const res = await apiFetch(`/api/food/menus/${menu.id}/orders`, {
        method: "POST",
        token,
        body: JSON.stringify({ items, note: note.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Could not place order");
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
      const res = await apiFetch(`/api/food/orders/${orderId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ action }),
      });
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
      const res = await apiFetch(`/api/food/menus/${menu.id}/manual-orders`, {
        method: "POST",
        token,
        body: JSON.stringify({ buyerName: mName.trim(), items, paid: mPaid }),
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

  async function toggleFollow() {
    if (!menu) return;
    setFollowBusy(true);
    const next = !menu.chef.following;
    // optimistic
    setMenu((m) => (m ? { ...m, chef: { ...m.chef, following: next } } : m));
    try {
      const res = await apiFetch(`/api/food/chefs/${menu.chef.id}/follow`, {
        method: next ? "POST" : "DELETE",
        token,
      });
      if (!res.ok) {
        // revert on failure
        setMenu((m) => (m ? { ...m, chef: { ...m.chef, following: !next } } : m));
      }
    } catch {
      setMenu((m) => (m ? { ...m, chef: { ...m.chef, following: !next } } : m));
    } finally {
      setFollowBusy(false);
    }
  }

  async function setMenuStatus(status: "OPEN" | "CLOSED") {
    if (!menu) return;
    await apiFetch(`/api/food/menus/${menu.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  async function deleteMenu() {
    if (!menu) return;
    if (!confirm(`Delete "${menu.title}"?`)) return;
    const res = await apiFetch(`/api/food/menus/${menu.id}`, {
      method: "DELETE",
      token,
    });
    if (res.ok) navigate(L.sectionPath, { replace: true });
  }

  async function toggleSoldOut(dish: Dish) {
    if (!menu) return;
    await apiFetch(`/api/food/menus/${menu.id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ items: [{ id: dish.id, soldOut: !dish.soldOut }] }),
    });
    await refresh();
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-slate-500">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }
  if (error && !menu) {
    return (
      <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
        <header className="flex items-center gap-2 py-4">
          <Link to={L.sectionPath} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold text-white">{L.section}</h1>
        </header>
        <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs text-red-200">{error}</p>
      </div>
    );
  }
  if (!menu) return null;

  const isOwner = menu.role === "chef";
  // Owner + nominated co-managers both see the management view.
  const canManage = menu.role === "chef" || menu.role === "comanager";
  const myOrders = !canManage ? menu.orders : [];
  const EmptyIcon = isMarket ? Store : ChefHat;

  async function shareMenu() {
    if (!menu) return;
    const url = `${API_BASE_URL}${L.sectionPath}/menus/${menu.id}`;
    const orderBy = menu.orderByAt
      ? `🕑 Order by ${new Date(menu.orderByAt).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}\n`
      : "";
    const headline = isMarket
      ? `🛒 ${menu.title} — ${menu.chef.name}'s stall`
      : `🍱 ${menu.title} — ${menu.chef.name}'s kitchen`;
    const pickup = menu.pickupInfo ? `📍 ${menu.pickupInfo}\n` : "";
    // Full item list + prices so residents who don't use the app can read
    // everything in the message and order offline (just reply / call).
    const itemLines = menu.items
      .map((d) => `• ${d.name} — ${formatUnitPrice(d.price, d.unit)}${d.soldOut ? " (sold out)" : ""}`)
      .join("\n");
    const heading = isMarket ? "On offer:" : "Menu:";
    const cta = "💬 Reply to this message to order, or tap the link to order online (RMV residents):";
    const text = `${headline}\n${orderBy}${pickup}\n${heading}\n${itemLines}\n\n${cta}`;
    try {
      await Share.share({ title: menu.title, text, url, dialogTitle: `Share ${L.listing}` });
    } catch {
      // user cancelled or share sheet unavailable — no-op
    }
  }

  // Share the consolidated order list — for handing off to a delivery helper.
  async function shareOrderList() {
    if (!menu) return;
    try {
      await Share.share({
        title: `Orders — ${menu.title}`,
        text: buildOrderListText(menu),
        dialogTitle: "Share order list",
      });
    } catch {
      // user cancelled or share sheet unavailable — no-op
    }
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link to={L.sectionPath} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-lg font-semibold text-white">{menu.title}</h1>
          <p className="truncate text-[11px] text-slate-500">
            {isOwner
              ? `Your ${L.listing}`
              : canManage
                ? `Co-managing ${menu.chef.name}'s ${L.listing}`
                : `by ${menu.chef.name} · B${menu.chef.block} · ${menu.chef.flatNumber}`}
          </p>
        </div>
        {canManage && (
          <>
            <button
              type="button"
              onClick={() => void shareMenu()}
              aria-label="Share menu"
              className="flex h-9 w-9 items-center justify-center rounded-full text-green-400 active:bg-slate-800"
            >
              <Share2 size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigate(`${L.sectionPath}/menus/${menu.id}/edit`)}
              aria-label="Edit"
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
            >
              <Pencil size={16} />
            </button>
          </>
        )}
      </header>

      {menu.description && (
        <p className="mb-3 rounded-xl border border-slate-700 bg-slate-800/40 px-3 py-2 text-[12px] text-slate-300">
          {menu.description}
        </p>
      )}
      <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
        {menu.orderByAt && (
          <span className="inline-flex items-center gap-1">
            <Clock size={11} /> Order by {fmtDateTime(menu.orderByAt)}
          </span>
        )}
        {menu.pickupInfo && <span>📍 {menu.pickupInfo}</span>}
        {!canManage && menu.chef.phone && (
          <a href={`tel:${menu.chef.phone}`} className="inline-flex items-center gap-1 text-indigo-300">
            <Phone size={11} /> {menu.chef.phone}
          </a>
        )}
      </div>

      {/* Follow toggle — buyers can follow a chef to get a push when they
          publish a new menu. */}
      {!canManage && (
        <button
          type="button"
          onClick={toggleFollow}
          disabled={followBusy}
          className={clsx(
            "mb-3 inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[12px] font-semibold",
            menu.chef.following
              ? "bg-slate-800 text-slate-300 active:bg-slate-700"
              : "bg-indigo-500 text-white active:bg-indigo-600"
          )}
        >
          {followBusy ? (
            <Loader2 size={13} className="animate-spin" />
          ) : menu.chef.following ? (
            <BellOff size={13} />
          ) : (
            <Bell size={13} />
          )}
          {menu.chef.following
            ? `Following ${menu.chef.name.split(" ")[0]}`
            : `Follow ${menu.chef.name.split(" ")[0]}`}
        </button>
      )}

      {/* ── CHEF VIEW (owner + co-managers): status controls + orders ── */}
      {canManage && (
        <>
          <div className="mb-3 flex gap-2">
            {menu.status === "OPEN" ? (
              <button type="button" onClick={() => setMenuStatus("CLOSED")} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-800 py-2 text-[12px] font-semibold text-amber-200 active:bg-slate-700">
                <Power size={13} /> Close {L.listing}
              </button>
            ) : (
              <button type="button" onClick={() => setMenuStatus("OPEN")} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-500 py-2 text-[12px] font-semibold text-white active:bg-emerald-600">
                <Power size={13} /> Reopen {L.listing}
              </button>
            )}
            {/* Delete stays owner-only. */}
            {isOwner && (
              <button type="button" onClick={deleteMenu} aria-label="Delete" className="flex h-9 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-400 active:bg-slate-700 active:text-red-300">
                <Trash2 size={15} />
              </button>
            )}
          </div>

          {/* Co-managers — owner + co-managers can add; only the owner removes. */}
          <CoManagers menuId={menu.id} L={L} managers={menu.managers ?? []} canRemove={isOwner} token={token} onChange={refresh} />

          {/* Dishes with sold-out toggles */}
          <section className="mb-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{L.itemPlural}</h2>
            <ul className="space-y-1.5">
              {menu.items.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
                  <span className="flex-1 truncate text-sm text-white">{d.name}</span>
                  <span className="text-[12px] tabular-nums text-slate-300">{formatUnitPrice(d.price, d.unit)}</span>
                  <button
                    type="button"
                    onClick={() => toggleSoldOut(d)}
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      d.soldOut ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"
                    )}
                  >
                    {d.soldOut ? "SOLD OUT" : "Available"}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Orders */}
          <section className="pb-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Orders ({menu.orders.length})
              </h2>
              <div className="flex items-center gap-3">
                {menu.orders.some((o) => o.status !== "CANCELLED") && (
                  <button
                    type="button"
                    onClick={() => void shareOrderList()}
                    className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-300 active:text-emerald-200"
                  >
                    <Share2 size={13} /> Share list
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowManual((s) => !s)}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-indigo-300 active:text-indigo-200"
                >
                  <Plus size={13} /> Offline order
                </button>
              </div>
            </div>

            {showManual && (
              <div className="mb-3 space-y-2.5 rounded-2xl border border-indigo-700/40 bg-indigo-900/10 p-3">
                <p className="text-[11px] text-slate-400">
                  Log a WhatsApp / phone order so everything stays in one place.
                </p>
                <input
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  placeholder="Buyer's name (e.g. Mrs. Sharma B2-301)"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                />
                <div className="space-y-1.5">
                  {menu.items.map((d) => (
                    <div key={d.id} className="flex items-center gap-2">
                      <span className="flex-1 text-[13px] text-slate-200">{d.name} <span className="text-slate-500">· {formatUnitPrice(d.price, d.unit)}</span></span>
                      <div className="flex items-center gap-1.5">
                        {(mCart[d.id] ?? 0) > 0 && (
                          <>
                            <button type="button" onClick={() => setMQty(d.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-white active:bg-slate-600"><Minus size={13} /></button>
                            <span className="w-5 text-center text-sm font-bold tabular-nums text-white">{mCart[d.id]}</span>
                          </>
                        )}
                        <button type="button" onClick={() => setMQty(d.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-white active:bg-indigo-600"><Plus size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-[13px] text-slate-300">
                  <input type="checkbox" checked={mPaid} onChange={(e) => setMPaid(e.target.checked)} />
                  Already paid
                </label>
                {mErr && <p className="text-[11px] text-red-300">{mErr}</p>}
                <button
                  type="button"
                  onClick={() => void addManualOrder()}
                  disabled={mBusy}
                  className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
                >
                  {mBusy ? "Adding…" : `Add order${mCount > 0 ? ` · ₹${mTotal}` : ""}`}
                </button>
              </div>
            )}

            {menu.orders.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-center text-[11px] text-slate-500">
                No orders yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {menu.orders.map((o) => (
                  <ChefOrderCard
                    key={o.id}
                    order={o}
                    busy={busyOrderId === o.id}
                    onConfirm={() => orderAction(o.id, "confirm_paid")}
                    onUnconfirm={() => orderAction(o.id, "unconfirm_paid")}
                    onCancel={() => orderAction(o.id, "cancel")}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {/* ── BUYER VIEW: my existing orders + order form ── */}
      {!canManage && (
        <>
          {myOrders.length > 0 && (
            <section className="mb-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Your orders</h2>
              <ul className="space-y-2">
                {myOrders.map((o) => (
                  <li key={o.id} className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{o.status}</span>
                      <span className="text-sm font-bold tabular-nums text-white">₹{o.totalAmount}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {o.items.map(lineText).join(", ")}
                    </p>
                    <div className="mt-2">
                      {o.chefPaid ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">PAID ✓ confirmed</span>
                      ) : o.buyerPaid ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">PAID — awaiting confirm</span>
                          <button type="button" onClick={() => orderAction(o.id, "unclaim_paid")} disabled={busyOrderId === o.id} className="text-[10px] text-slate-500 active:text-slate-300">undo</button>
                        </span>
                      ) : o.status !== "CANCELLED" ? (
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => orderAction(o.id, "claim_paid")} disabled={busyOrderId === o.id} className="rounded-full bg-indigo-500 px-2.5 py-0.5 text-[10px] font-bold text-white active:bg-indigo-600 disabled:opacity-50">I've paid</button>
                          {o.status === "PLACED" && (
                            <button type="button" onClick={() => orderAction(o.id, "cancel")} disabled={busyOrderId === o.id} className="rounded-full border border-slate-700 px-2.5 py-0.5 text-[10px] font-bold text-slate-400 active:bg-slate-800">Cancel</button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {menu.orderable ? (
            <>
              <section className="mb-3">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{isMarket ? "On offer" : "Menu"}</h2>
                <ul className="space-y-2">
                  {menu.items.map((d) => (
                    <li key={d.id} className={clsx("flex gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-2", d.soldOut && "opacity-50")}>
                      {d.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.imageUrl} alt="" className="h-16 w-16 flex-shrink-0 rounded-lg object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{d.name}</p>
                        {d.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-400">{d.description}</p>}
                        <p className="mt-0.5 text-[12px] font-semibold text-slate-200">{formatUnitPrice(d.price, d.unit)}</p>
                      </div>
                      {d.soldOut ? (
                        <span className="self-center rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">SOLD OUT</span>
                      ) : (
                        <div className="flex items-center gap-2 self-center">
                          {(cart[d.id] ?? 0) > 0 && (
                            <>
                              <button type="button" onClick={() => setQty(d.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-white active:bg-slate-600"><Minus size={13} /></button>
                              <span className="w-5 text-center text-sm font-bold tabular-nums text-white">{cart[d.id]}</span>
                            </>
                          )}
                          <button type="button" onClick={() => setQty(d.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-white active:bg-indigo-600"><Plus size={13} /></button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              {cartCount > 0 && (
                <section className="mb-4 space-y-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={isMarket ? "Note for the seller (optional)" : "Note for the chef (optional) — e.g. less spicy"}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                  />
                  {error && <p className="rounded-lg border border-red-700/60 bg-red-900/20 px-3 py-1.5 text-[11px] text-red-200">{error}</p>}
                  <button
                    type="button"
                    onClick={placeOrder}
                    disabled={placing}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-white active:bg-indigo-600 disabled:opacity-50"
                  >
                    {placing ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                    Place order · {cartCount} item{cartCount !== 1 ? "s" : ""} · ₹{cartTotal}
                  </button>
                </section>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-500">
              <EmptyIcon size={24} className="mx-auto mb-2 text-slate-600" />
              This {L.listing} isn't taking orders right now.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Co-managers (owner-only) ────────────────────────────────────────────────

function CoManagers({
  menuId,
  L,
  managers,
  canRemove,
  token,
  onChange,
}: {
  menuId: string;
  L: (typeof KIND_LABELS)[FoodKind];
  managers: Manager[];
  canRemove: boolean;
  token: string | null;
  onChange: () => Promise<void> | void;
}) {
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Manager[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!adding) return;
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/residents/search?q=${encodeURIComponent(term)}`, { token });
        if (res.ok) {
          const data = await res.json();
          const existing = new Set(managers.map((m) => m.id));
          setResults((data.residents ?? []).filter((r: Manager) => !existing.has(r.id)));
        }
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q, adding, managers, token]);

  async function add(residentId: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch(`/api/food/menus/${menuId}/managers`, {
        method: "POST",
        token,
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
      const res = await apiFetch(`/api/food/menus/${menuId}/managers?residentId=${encodeURIComponent(residentId)}`, { method: "DELETE", token });
      if (res.ok) await onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-slate-700 bg-slate-800/40 p-3">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Users size={13} /> Co-managers
        </h2>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-[12px] font-medium text-indigo-300 active:text-indigo-200">
            <UserPlus size={13} /> Add
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        They can edit {L.itemPlural}, manage orders, and add other co-managers. Only the owner can remove them or delete it.
      </p>

      {managers.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {managers.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-xl bg-slate-900/60 px-3 py-2">
              <span className="text-[13px] text-slate-200">{m.name} <span className="text-slate-500">· B{m.block}-{m.flatNumber}</span></span>
              {canRemove && (
                <button type="button" onClick={() => remove(m.id)} disabled={busy} className="text-slate-500 active:text-red-300 disabled:opacity-50"><X size={15} /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="mt-2 space-y-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a resident by name…"
            className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
          />
          {err && <p className="text-[11px] text-red-300">{err}</p>}
          {results.length > 0 && (
            <ul className="overflow-hidden rounded-xl border border-slate-700">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => add(r.id)} disabled={busy} className="w-full px-3 py-2 text-left text-[13px] text-slate-200 active:bg-slate-700 disabled:opacity-50">
                    {r.name} <span className="text-slate-500">· B{r.block}-{r.flatNumber}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => { setAdding(false); setQ(""); setResults([]); setErr(null); }} className="text-[11px] text-slate-500 active:text-slate-300">Cancel</button>
        </div>
      )}
    </div>
  );
}

// ── Chef order card ─────────────────────────────────────────────────────────

function ChefOrderCard({
  order,
  busy,
  onConfirm,
  onUnconfirm,
  onCancel,
}: {
  order: Order;
  busy: boolean;
  onConfirm: () => void;
  onUnconfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <li className={clsx("rounded-2xl border p-3", order.status === "CANCELLED" ? "border-slate-700 bg-slate-800/30 opacity-70" : "border-slate-700 bg-slate-800/60")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold text-white">
          {order.manual
            ? order.manualBuyerName || "Offline order"
            : order.buyer
              ? `${order.buyer.name} · B${order.buyer.block}-${order.buyer.flatNumber}`
              : "Order"}
          {order.manual && (
            <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">OFFLINE</span>
          )}
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums text-white">₹{order.totalAmount}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">
        {order.items.map(lineText).join(", ")}
      </p>
      {order.note && <p className="mt-1 rounded-lg bg-slate-900/50 px-2 py-1 text-[11px] italic text-slate-400">“{order.note}”</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-bold", order.status === "CONFIRMED" ? "bg-emerald-500/20 text-emerald-300" : order.status === "CANCELLED" ? "bg-red-500/20 text-red-300" : "bg-slate-700 text-slate-300")}>{order.status}</span>
        {order.chefPaid ? (
          <span className="inline-flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">{order.manual ? "PAID ✓" : "RECEIVED ✓"}</span>
            <button type="button" onClick={onUnconfirm} disabled={busy} className="text-[10px] text-slate-500 active:text-slate-300">undo</button>
          </span>
        ) : order.manual ? (
          order.status !== "CANCELLED" ? (
            <button type="button" onClick={onConfirm} disabled={busy} className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white active:bg-emerald-600 disabled:opacity-50">
              {busy ? "…" : "Mark paid"}
            </button>
          ) : null
        ) : order.buyerPaid ? (
          <button type="button" onClick={onConfirm} disabled={busy} className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white active:bg-emerald-600 disabled:opacity-50">
            {busy ? "…" : "Confirm received"}
          </button>
        ) : (
          <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-400">unpaid</span>
        )}
        {order.buyer?.phone && (
          <a href={`tel:${order.buyer.phone}`} className="inline-flex items-center gap-0.5 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] text-indigo-300"><Phone size={9} /> call</a>
        )}
        {order.status !== "CANCELLED" && (
          <button type="button" onClick={onCancel} disabled={busy} className="ml-auto text-[10px] text-slate-500 active:text-red-300">cancel</button>
        )}
      </div>
    </li>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

// WhatsApp-ready delivery/packing list of every active order on a listing.
// Mirrored in src/app/food/MenuDetail.tsx.
function buildOrderListText(menu: MenuDetail): string {
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
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
