import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Share } from "@capacitor/share";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { track } from "../lib/track";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthProvider";
import { type FoodKind, KIND_LABELS, formatUnitPrice, unitLabel, waNumber } from "../lib/market";

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
  myRemaining?: number | null; // how many more I can order (null = no cap)
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
  manualBuyerFlat?: string | null;
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
  const [mFlat, setMFlat] = useState("");
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
      const m: MenuDetail = await res.json();
      setMenu(m);
      setError(null);
      track(token, m.kind === "MARKET" ? "bazaar" : "food", "detail", m.id);
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

  // Most a buyer can add of one item = min(stock left, their per-person remaining).
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
        body: JSON.stringify({ buyerName: mName.trim(), buyerFlat: mFlat.trim() || null, items, paid: mPaid }),
      });
      if (!res.ok) {
        setMErr((await res.json().catch(() => null))?.error ?? "Could not add order");
        return;
      }
      setMName(""); setMFlat(""); setMCart({}); setMPaid(false); setShowManual(false);
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
      <div className="one-surface flex flex-1 items-center justify-center" style={{ background: "var(--bg)" }}>
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} />
      </div>
    );
  }
  if (error && !menu) {
    return (
      <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)]" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <header className="flex items-center gap-3 py-3">
          <Link to={L.sectionPath} className="flex active:opacity-70" aria-label="Back">
            <Icon name="arrow_back" size={23} style={{ color: "var(--text-2)" }} />
          </Link>
          <h1 className="text-[21px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>{L.section}</h1>
        </header>
        <p className="rounded-[12px] px-4 py-3 text-[13px]" style={{ background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)" }}>{error}</p>
      </div>
    );
  }
  if (!menu) return null;

  const isOwner = menu.role === "chef";
  // Owner + nominated co-managers both see the management view.
  const canManage = menu.role === "chef" || menu.role === "comanager";
  const myOrders = !canManage ? menu.orders : [];
  const emptyIcon = isMarket ? "storefront" : "cooking";

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
    const cta = "🛒 Tap the link to order online (RMV residents):";
    // Tap-to-WhatsApp link straight to the chef, with a pre-filled message.
    const wa = waNumber(menu.chef.phone);
    const firstName = menu.chef.name.split(" ")[0];
    const dm = wa
      ? `\n💬 Or WhatsApp ${firstName} to order: https://wa.me/${wa}?text=${encodeURIComponent(
          `Hi ${firstName}! I'd like to order from your ${L.stall} "${menu.title}".`
        )}`
      : "";
    // url + dm are embedded in `text` (so both links render in WhatsApp); don't
    // also pass `url` separately or the order link would appear twice.
    const text = `${headline}\n${orderBy}${pickup}\n${heading}\n${itemLines}\n\n${cta}\n${url}${dm}`;
    try {
      await Share.share({ title: menu.title, text, dialogTitle: `Share ${L.listing}` });
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
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-start gap-3 py-3">
        <Link to={L.sectionPath} className="mt-0.5 flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={23} style={{ color: "var(--text-2)" }} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[21px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>{menu.title}</h1>
          <p className="truncate text-[12.5px]" style={{ color: "var(--text-3)" }}>
            {isOwner
              ? `Your ${L.listing}`
              : canManage
                ? `Co-managing ${menu.chef.name}'s ${L.listing}`
                : `by ${menu.chef.name} · B${menu.chef.block} · ${menu.chef.flatNumber}`}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-shrink-0 items-center gap-4">
            <button type="button" onClick={() => void shareMenu()} aria-label="Share menu" className="flex active:opacity-70">
              <Icon name="share" size={20} style={{ color: "var(--success)" }} />
            </button>
            <button type="button" onClick={() => navigate(`${L.sectionPath}/menus/${menu.id}/edit`)} aria-label="Edit" className="flex active:opacity-70">
              <Icon name="edit" size={20} style={{ color: "var(--text-2)" }} />
            </button>
          </div>
        )}
      </header>

      {menu.description && (
        <div className="mb-3.5 rounded-[13px] px-[15px] py-3 text-[14px] leading-snug" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}>
          {menu.description}
        </div>
      )}
      <div className="mb-3 flex flex-col gap-2.5">
        {menu.orderByAt && (
          <span className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-2)" }}>
            <Icon name="schedule" size={17} style={{ color: "var(--text-3)" }} /> Order by <b style={{ fontWeight: 700, color: "var(--text)" }}>{fmtDateTime(menu.orderByAt)}</b>
          </span>
        )}
        {menu.pickupInfo && (
          <span className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-2)" }}>
            <Icon name="location_on" size={17} style={{ color: "var(--produce)" }} /> {menu.pickupInfo}
          </span>
        )}
        {!canManage && menu.chef.phone && (
          <a href={`tel:${menu.chef.phone}`} className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--accent)" }}>
            <Icon name="call" size={17} style={{ color: "var(--accent)" }} /> {menu.chef.phone}
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
          className="mb-3 inline-flex items-center gap-1.5 self-start rounded-full px-3.5 py-2 text-[13px] font-bold active:opacity-90"
          style={
            menu.chef.following
              ? { background: "var(--surface-3)", color: "var(--text-2)", border: "1px solid var(--border)" }
              : { background: "var(--accent-strong)", color: "#fff" }
          }
        >
          {followBusy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Icon name={menu.chef.following ? "notifications_off" : "notifications"} size={16} fill={!menu.chef.following} style={{ color: menu.chef.following ? "var(--text-2)" : "#fff" }} />
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
              <button type="button" onClick={() => setMenuStatus("CLOSED")} className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] py-2.5 text-[13px] font-bold active:opacity-90" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--warning)" }}>
                <Icon name="power_settings_new" size={16} style={{ color: "var(--warning)" }} /> Close {L.listing}
              </button>
            ) : (
              <button type="button" onClick={() => setMenuStatus("OPEN")} className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] py-2.5 text-[13px] font-bold text-white active:opacity-90" style={{ background: "var(--success)" }}>
                <Icon name="power_settings_new" size={16} style={{ color: "#fff" }} /> Reopen {L.listing}
              </button>
            )}
            {/* Delete stays owner-only. */}
            {isOwner && (
              <button type="button" onClick={deleteMenu} aria-label="Delete" className="flex h-[42px] w-[46px] items-center justify-center rounded-[12px] active:opacity-90" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text-3)" }}>
                <Icon name="delete" size={18} style={{ color: "var(--text-3)" }} />
              </button>
            )}
          </div>

          {/* Co-managers — owner + co-managers can add; only the owner removes. */}
          <CoManagers menuId={menu.id} L={L} managers={menu.managers ?? []} canRemove={isOwner} token={token} onChange={refresh} />

          {/* Dishes with sold-out toggles */}
          <section className="mb-5">
            <p className="one-mono mb-2.5 text-[10px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>{L.itemPlural.toUpperCase()}</p>
            <div className="flex flex-col gap-2">
              {menu.items.map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-[12px] px-3.5 py-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <span className="flex-1 truncate text-[14px]" style={{ color: "var(--text)" }}>
                    {d.name}
                    {d.maxPerPerson != null && <span className="ml-1.5 text-[10px]" style={{ color: "var(--text-3)" }}>· max {d.maxPerPerson}/person</span>}
                  </span>
                  {d.stockQty != null && (
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: "var(--warning)" }}>{d.remaining ?? d.stockQty}/{d.stockQty}</span>
                  )}
                  <span className="text-[12px] tabular-nums" style={{ color: "var(--text-2)" }}>{formatUnitPrice(d.price, d.unit)}</span>
                  <button
                    type="button"
                    onClick={() => toggleSoldOut(d)}
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold"
                    style={d.soldOut ? { background: "var(--danger-soft)", color: "var(--danger)" } : { background: "var(--success-soft)", color: "var(--success)" }}
                  >
                    {d.soldOut ? "SOLD OUT" : "Available"}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Orders */}
          <section className="pb-4">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="one-mono text-[10px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>
                ORDERS ({menu.orders.length})
              </p>
              <div className="flex items-center gap-3.5">
                {menu.orders.some((o) => o.status !== "CANCELLED") && (
                  <button type="button" onClick={() => void shareOrderList()} className="flex items-center gap-1 text-[12px] font-semibold active:opacity-80" style={{ color: "var(--success)" }}>
                    <Icon name="share" size={14} style={{ color: "var(--success)" }} /> Share list
                  </button>
                )}
                <button type="button" onClick={() => setShowManual((s) => !s)} className="flex items-center gap-1 text-[12px] font-semibold active:opacity-80" style={{ color: "var(--accent)" }}>
                  <Icon name="add" size={15} style={{ color: "var(--accent)" }} /> Offline order
                </button>
              </div>
            </div>

            {showManual && (
              <div className="mb-3 flex flex-col gap-2.5 rounded-[16px] p-3.5" style={{ background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 30%, var(--border))" }}>
                <p className="text-[12px]" style={{ color: "var(--text-2)" }}>
                  Log a WhatsApp / phone order so everything stays in one place.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={mName}
                    onChange={(e) => setMName(e.target.value)}
                    placeholder="Buyer's name"
                    className="one-input w-full rounded-[12px] px-3.5 py-2.5 text-[14px] outline-none"
                  />
                  <input
                    value={mFlat}
                    onChange={(e) => setMFlat(e.target.value)}
                    placeholder="Flat / Block"
                    className="one-input w-full rounded-[12px] px-3.5 py-2.5 text-[14px] outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  {menu.items.map((d) => (
                    <div key={d.id} className="flex items-center gap-2">
                      <span className="flex-1 text-[13px]" style={{ color: "var(--text)" }}>{d.name} <span style={{ color: "var(--text-3)" }}>· {formatUnitPrice(d.price, d.unit)}</span></span>
                      <div className="flex items-center gap-1.5">
                        {(mCart[d.id] ?? 0) > 0 && (
                          <>
                            <button type="button" onClick={() => setMQty(d.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-full text-white active:opacity-90" style={{ background: "var(--surface-3)", color: "var(--text)" }}><Icon name="remove" size={14} style={{ color: "var(--text)" }} /></button>
                            <span className="w-5 text-center text-[14px] font-bold tabular-nums" style={{ color: "var(--text)" }}>{mCart[d.id]}</span>
                          </>
                        )}
                        <button type="button" onClick={() => setMQty(d.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-full text-white active:opacity-90" style={{ background: "var(--accent-strong)" }}><Icon name="add" size={14} style={{ color: "#fff" }} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-2)" }}>
                  <input type="checkbox" checked={mPaid} onChange={(e) => setMPaid(e.target.checked)} />
                  Already paid
                </label>
                {mErr && <p className="text-[12px]" style={{ color: "var(--danger)" }}>{mErr}</p>}
                <button
                  type="button"
                  onClick={() => void addManualOrder()}
                  disabled={mBusy}
                  className="w-full rounded-[12px] py-2.5 text-[14px] font-bold text-white active:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--accent-strong)" }}
                >
                  {mBusy ? "Adding…" : `Add order${mCount > 0 ? ` · ₹${mTotal}` : ""}`}
                </button>
              </div>
            )}

            {menu.orders.length === 0 ? (
              <p className="rounded-[16px] px-4 py-6 text-center text-[12px]" style={{ border: "1.5px dashed var(--border-strong)", color: "var(--text-3)" }}>
                No orders yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
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
              </div>
            )}
          </section>
        </>
      )}

      {/* ── BUYER VIEW: my existing orders + order form ── */}
      {!canManage && (
        <>
          {myOrders.length > 0 && (
            <section className="mb-4">
              <p className="one-mono mb-2.5 text-[10px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>YOUR ORDERS</p>
              <div className="flex flex-col gap-2">
                {myOrders.map((o) => (
                  <div key={o.id} className="rounded-[16px] p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                    <div className="flex items-baseline justify-between">
                      <span className="one-mono text-[11px] font-bold" style={{ color: "var(--text-3)", letterSpacing: "0.08em" }}>{o.status}</span>
                      <span className="text-[15px] font-bold tabular-nums" style={{ color: "var(--text)" }}>₹{o.totalAmount}</span>
                    </div>
                    <p className="mt-1 text-[12px]" style={{ color: "var(--text-2)" }}>
                      {o.items.map(lineText).join(", ")}
                    </p>
                    <div className="mt-2.5">
                      {o.chefPaid ? (
                        <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: "var(--success-soft)", color: "var(--success)" }}>PAID ✓ confirmed</span>
                      ) : o.buyerPaid ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>PAID — awaiting confirm</span>
                          <button type="button" onClick={() => orderAction(o.id, "unclaim_paid")} disabled={busyOrderId === o.id} className="text-[10px] active:opacity-70" style={{ color: "var(--text-3)" }}>undo</button>
                        </span>
                      ) : o.status !== "CANCELLED" ? (
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => orderAction(o.id, "claim_paid")} disabled={busyOrderId === o.id} className="rounded-full px-3 py-1 text-[10px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>I've paid</button>
                          {o.status === "PLACED" && (
                            <button type="button" onClick={() => orderAction(o.id, "cancel")} disabled={busyOrderId === o.id} className="rounded-full px-3 py-1 text-[10px] font-bold active:opacity-80" style={{ border: "1px solid var(--border)", color: "var(--text-3)" }}>Cancel</button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {menu.orderable ? (
            <>
              <section className="mb-3">
                <p className="one-mono mb-2.5 text-[10px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>{isMarket ? "ON OFFER" : "MENU"}</p>
                <div className="flex flex-col gap-2.5">
                  {menu.items.map((d) => {
                    const have = cart[d.id] ?? 0;
                    const max = dishMax(d);
                    const out = d.soldOut || d.remaining === 0 || max <= 0;
                    return (
                    <div key={d.id} className="flex gap-3 rounded-[16px] p-2.5" style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: out ? 0.5 : 1 }}>
                      {d.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.imageUrl} alt="" className="h-[66px] w-[66px] flex-shrink-0 rounded-[12px] object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold" style={{ color: "var(--text)" }}>{d.name}</p>
                        {d.description && <p className="mt-0.5 line-clamp-2 text-[12px]" style={{ color: "var(--text-3)" }}>{d.description}</p>}
                        <p className="mt-1 text-[14px] font-bold" style={{ color: "var(--text)" }}>{formatUnitPrice(d.price, d.unit)}</p>
                        {!out && d.remaining != null && d.remaining > 0 && (
                          <p className="mt-0.5 text-[11px] font-bold" style={{ color: "var(--warning)" }}>Only {d.remaining} left</p>
                        )}
                        {d.maxPerPerson != null && (
                          <p className="mt-0.5 text-[10.5px]" style={{ color: "var(--text-3)" }}>Max {d.maxPerPerson} per person</p>
                        )}
                      </div>
                      {out ? (
                        <span className="self-center rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>SOLD OUT</span>
                      ) : have > 0 ? (
                        <div className="flex items-center gap-2.5 self-center rounded-full p-1.5" style={{ background: "var(--accent-soft)" }}>
                          <button type="button" onClick={() => setQty(d.id, -1)} className="flex h-7 w-7 items-center justify-center rounded-full active:opacity-90" style={{ background: "var(--surface)", color: "var(--accent)" }}><Icon name="remove" size={16} style={{ color: "var(--accent)" }} /></button>
                          <span className="w-3.5 text-center text-[15px] font-extrabold tabular-nums" style={{ color: "var(--accent)" }}>{have}</span>
                          <button type="button" disabled={have >= max} onClick={() => setQty(d.id, 1)} className="flex h-7 w-7 items-center justify-center rounded-full text-white active:opacity-90 disabled:opacity-40" style={{ background: "var(--accent-strong)" }}><Icon name="add" size={16} style={{ color: "#fff" }} /></button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setQty(d.id, 1)} className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center self-center rounded-full text-white active:opacity-90" style={{ background: "var(--accent-strong)", boxShadow: "0 4px 12px var(--accent-soft)" }}><Icon name="add" size={22} style={{ color: "#fff" }} /></button>
                      )}
                    </div>
                    );
                  })}
                </div>
              </section>

              {cartCount > 0 && (
                <section className="mb-4 flex flex-col gap-2.5">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={isMarket ? "Note for the seller (optional)" : "Note for the chef (optional) — e.g. less spicy"}
                    rows={2}
                    className="one-input w-full resize-none rounded-[12px] px-3.5 py-2.5 text-[14px] outline-none"
                  />
                  {error && <p className="rounded-[10px] px-3 py-2 text-[12px]" style={{ background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)" }}>{error}</p>}
                  <button
                    type="button"
                    onClick={placeOrder}
                    disabled={placing}
                    className="flex w-full items-center justify-center gap-2 rounded-[12px] py-3.5 text-[15px] font-bold text-white active:opacity-90 disabled:opacity-50"
                    style={{ background: "var(--accent-strong)", boxShadow: "0 6px 16px var(--accent-soft)" }}
                  >
                    {placing ? <Loader2 size={17} className="animate-spin" /> : <Icon name="shopping_cart" size={18} style={{ color: "#fff" }} />}
                    Place order · {cartCount} item{cartCount !== 1 ? "s" : ""} · ₹{cartTotal}
                  </button>
                </section>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-[16px] px-4 py-8 text-center text-[14px]" style={{ border: "1.5px dashed var(--border-strong)", color: "var(--text-3)" }}>
              <Icon name={emptyIcon} size={26} style={{ color: "var(--text-3)" }} />
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
    <div className="mb-4 rounded-[16px] p-3.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <p className="one-mono flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: "var(--text-2)", letterSpacing: "0.12em" }}>
          <Icon name="group" size={14} style={{ color: "var(--text-2)" }} /> CO-MANAGERS
        </p>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 text-[12px] font-semibold active:opacity-80" style={{ color: "var(--accent)" }}>
            <Icon name="person_add" size={14} style={{ color: "var(--accent)" }} /> Add
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-snug" style={{ color: "var(--text-3)" }}>
        They can edit {L.itemPlural}, manage orders, and add other co-managers. Only the owner can remove them or delete it.
      </p>

      {managers.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {managers.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-[12px] px-3 py-2" style={{ background: "var(--surface)" }}>
              <span className="text-[13px]" style={{ color: "var(--text)" }}>{m.name} <span style={{ color: "var(--text-3)" }}>· B{m.block}-{m.flatNumber}</span></span>
              {canRemove && (
                <button type="button" onClick={() => remove(m.id)} disabled={busy} className="flex active:opacity-70 disabled:opacity-50"><Icon name="close" size={16} style={{ color: "var(--text-3)" }} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-2.5 flex flex-col gap-2">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a resident by name…"
            className="one-input w-full rounded-[12px] px-3.5 py-2.5 text-[14px] outline-none"
          />
          {err && <p className="text-[12px]" style={{ color: "var(--danger)" }}>{err}</p>}
          {results.length > 0 && (
            <div className="overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--border)" }}>
              {results.map((r) => (
                <button key={r.id} type="button" onClick={() => add(r.id)} disabled={busy} className="block w-full px-3.5 py-2.5 text-left text-[13px] active:opacity-80 disabled:opacity-50" style={{ color: "var(--text)" }}>
                  {r.name} <span style={{ color: "var(--text-3)" }}>· B{r.block}-{r.flatNumber}</span>
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => { setAdding(false); setQ(""); setResults([]); setErr(null); }} className="self-start text-[11px] active:opacity-70" style={{ color: "var(--text-3)" }}>Cancel</button>
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
    <div className="rounded-[16px] p-3.5" style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: order.status === "CANCELLED" ? 0.7 : 1 }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[14px] font-bold" style={{ color: "var(--text)" }}>
          {order.manual
            ? `${order.manualBuyerName || "Offline order"}${order.manualBuyerFlat ? ` · ${order.manualBuyerFlat}` : ""}`
            : order.buyer
              ? `${order.buyer.name} · B${order.buyer.block}-${order.buyer.flatNumber}`
              : "Order"}
          {order.manual && (
            <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>OFFLINE</span>
          )}
        </span>
        <span className="shrink-0 text-[14px] font-bold tabular-nums" style={{ color: "var(--text)" }}>₹{order.totalAmount}</span>
      </div>
      <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-2)" }}>
        {order.items.map(lineText).join(", ")}
      </p>
      {order.note && <p className="mt-1.5 rounded-[8px] px-2.5 py-1.5 text-[12px] italic" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>“{order.note}”</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={order.status === "CONFIRMED" ? { background: "var(--success-soft)", color: "var(--success)" } : order.status === "CANCELLED" ? { background: "var(--danger-soft)", color: "var(--danger)" } : { background: "var(--surface-3)", color: "var(--text-2)" }}>{order.status}</span>
        {order.chefPaid ? (
          <span className="inline-flex items-center gap-2">
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--success-soft)", color: "var(--success)" }}>{order.manual ? "PAID ✓" : "RECEIVED ✓"}</span>
            <button type="button" onClick={onUnconfirm} disabled={busy} className="text-[10px] active:opacity-70" style={{ color: "var(--text-3)" }}>undo</button>
          </span>
        ) : order.manual ? (
          order.status !== "CANCELLED" ? (
            <button type="button" onClick={onConfirm} disabled={busy} className="rounded-full px-3 py-0.5 text-[10px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--success)" }}>
              {busy ? "…" : "Mark paid"}
            </button>
          ) : null
        ) : order.buyerPaid ? (
          <button type="button" onClick={onConfirm} disabled={busy} className="rounded-full px-3 py-0.5 text-[10px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--success)" }}>
            {busy ? "…" : "Confirm received"}
          </button>
        ) : order.status !== "CANCELLED" ? (
          <button type="button" onClick={onConfirm} disabled={busy} className="rounded-full px-3 py-0.5 text-[10px] font-bold active:opacity-90 disabled:opacity-50" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
            {busy ? "…" : "Mark paid"}
          </button>
        ) : (
          <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--surface-3)", color: "var(--text-3)" }}>unpaid</span>
        )}
        {order.buyer?.phone && (
          <a href={`tel:${order.buyer.phone}`} className="flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--surface-2)", color: "var(--accent)" }}><Icon name="call" size={11} style={{ color: "var(--accent)" }} /> call</a>
        )}
        {order.status !== "CANCELLED" && (
          <button type="button" onClick={onCancel} disabled={busy} className="ml-auto text-[10px] active:opacity-70" style={{ color: "var(--text-3)" }}>cancel</button>
        )}
      </div>
    </div>
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
      : `${o.manualBuyerName ?? "Offline"}${o.manualBuyerFlat ? ` (${o.manualBuyerFlat})` : ""} (offline)`;
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
