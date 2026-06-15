import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGoBack } from "../lib/useGoBack";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { track } from "../lib/track";
import { useAuth } from "../auth/AuthProvider";
import { type FoodKind, KIND_LABELS, formatUnitPrice, unitLabel, asKind } from "../lib/market";
import { waOrderLink } from "../lib/vendors";

// ── Types ──────────────────────────────────────────────────────────────────

interface MenuCard {
  id: string;
  title: string;
  description: string | null;
  date: string;
  orderByAt: string | null;
  pickupInfo: string | null;
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  kind: FoodKind;
  orderable: boolean;
  itemCount: number;
  minPrice: number;
  minPriceUnit: string | null;
  orderCount: number;
  iOrdered?: boolean;
  coManaging?: boolean;
  chef: { id: string; name: string; block: number; flatNumber: string; isMe: boolean };
}

interface MyOrder {
  id: string;
  menuId: string;
  menuTitle: string;
  kind: FoodKind;
  chef: { name: string; block: number; flatNumber: string };
  status: "PLACED" | "CONFIRMED" | "CANCELLED";
  totalAmount: number;
  buyerPaid: boolean;
  chefPaid: boolean;
  createdAt: string;
  items: { name: string; price: number; unit: string | null; qty: number }[];
}

interface VendorCard {
  id: string;
  name: string;
  phone: string;
  deliveryInfo: string | null;
  photoUrl: string | null;
  itemCount: number;
  minPrice: number;
  sections: string[];
}

type Tab = "order" | "vendors" | "kitchen" | "bazaar" | "orders";

const TABS: { key: Tab; ms: string; label: string }[] = [
  { key: "order", ms: "restaurant", label: "Order" },
  { key: "vendors", ms: "storefront", label: "Vendors" },
  { key: "kitchen", ms: "cooking", label: "Kitchen" },
  { key: "bazaar", ms: "shopping_basket", label: "Bazaar" },
  { key: "orders", ms: "receipt_long", label: "Orders" },
];

/** "3 kg Apples" (market) | "2× Dosa" (kitchen). */
function lineText(i: { qty: number; name: string; unit: string | null }): string {
  return i.unit ? `${i.qty} ${unitLabel(i.unit)} ${i.name}` : `${i.qty}× ${i.name}`;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Food() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const goBack = useGoBack();
  const [tab, setTab] = useState<Tab>("order");

  const [browse, setBrowse] = useState<MenuCard[]>([]);
  const [mineKitchen, setMineKitchen] = useState<MenuCard[]>([]);
  const [mineBazaar, setMineBazaar] = useState<MenuCard[]>([]);
  const [vendors, setVendors] = useState<VendorCard[]>([]);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [b, k, z, o, vn] = await Promise.all([
        apiFetch("/api/food/menus?kind=ALL", { token }),
        apiFetch("/api/food/menus?mine=chef&kind=KITCHEN", { token }),
        apiFetch("/api/food/menus?mine=chef&kind=MARKET", { token }),
        apiFetch("/api/food/orders", { token }),
        apiFetch("/api/vendors", { token }),
      ]);
      if (b.ok) setBrowse((await b.json()).menus ?? []);
      if (k.ok) setMineKitchen((await k.json()).menus ?? []);
      if (z.ok) setMineBazaar((await z.json()).menus ?? []);
      if (o.ok) setOrders((await o.json()).orders ?? []);
      if (vn.ok) setVendors((await vn.json()).vendors ?? []);
      track(token, "food", "list");
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function markPaid(orderId: string) {
    setBusyId(orderId);
    try {
      const res = await apiFetch(`/api/food/orders/${orderId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ action: "claim_paid" }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, buyerPaid: true } : o))
        );
      }
    } finally {
      setBusyId(null);
    }
  }

  const browseOthers = browse.filter((m) => !m.chef.isMe);
  const createCta =
    tab === "kitchen"
      ? { path: KIND_LABELS.KITCHEN.createPath, label: "Menu" }
      : tab === "bazaar"
        ? { path: KIND_LABELS.MARKET.createPath, label: "Stall" }
        : tab === "vendors"
          ? { path: "/vendors/new", label: "Vendor" }
          : null;

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)]"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-start gap-3 py-3">
        <button type="button" onClick={goBack} className="flex pt-0.5" aria-label="Back">
          <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[21px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Food &amp; Bazaar</h1>
          <p className="truncate text-[12px]" style={{ color: "var(--text-3)" }}>
            Home kitchens &amp; fresh produce
          </p>
        </div>
        {createCta && (
          <button
            type="button"
            onClick={() => navigate(createCta.path)}
            className="flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-bold text-white active:opacity-90"
            style={{ background: "var(--accent-strong)" }}
          >
            <Icon name="add" size={17} style={{ color: "#fff" }} />
            {createCta.label}
          </button>
        )}
      </header>

      {/* Tabs — horizontally scrollable pills */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <TabPill key={t.key} active={tab === t.key} onClick={() => setTab(t.key)} ms={t.ms}>
            {t.label}
          </TabPill>
        ))}
      </div>

      {error && (
        <p className="mb-3 rounded-[11px] px-4 py-2.5 text-[13px]" style={{ background: "var(--danger-soft)", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)", color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10" style={{ color: "var(--text-3)" }}>
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <div className="flex-1 pb-4">
          {tab === "order" && (
            browseOthers.length === 0 ? (
              <Empty ms="restaurant" text="Nothing open right now. Check back soon!" />
            ) : (
              <ul className="space-y-3">
                {browseOthers.map((m) => <MenuRow key={m.id} menu={m} />)}
              </ul>
            )
          )}

          {tab === "vendors" && (
            vendors.length === 0 ? (
              <Empty ms="storefront" text="No outside vendors yet. Know a caterer? Tap “Vendor” to add one." />
            ) : (
              <ul className="space-y-3">
                {vendors.map((v) => <VendorRow key={v.id} v={v} onNavigate={(p) => navigate(p)} />)}
              </ul>
            )
          )}

          {tab === "kitchen" && (
            mineKitchen.length === 0 ? (
              <Empty ms="cooking" text="You haven't published a menu yet. Tap “Menu” to cook for the community!" />
            ) : (
              <ul className="space-y-3">
                {mineKitchen.map((m) => <MenuRow key={m.id} menu={m} chefView />)}
              </ul>
            )
          )}

          {tab === "bazaar" && (
            mineBazaar.length === 0 ? (
              <Empty ms="shopping_basket" text="You haven't listed any goods yet. Tap “Stall” to sell produce by the unit!" />
            ) : (
              <ul className="space-y-3">
                {mineBazaar.map((m) => <MenuRow key={m.id} menu={m} chefView />)}
              </ul>
            )
          )}

          {tab === "orders" && (
            orders.length === 0 ? (
              <Empty ms="receipt_long" text="No orders yet. Browse the Order tab to get started." />
            ) : (
              <ul className="space-y-3">
                {orders.map((o) => (
                  <OrderRow key={o.id} order={o} busy={busyId === o.id} onMarkPaid={() => markPaid(o.id)} />
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TabPill({ active, onClick, ms, children }: { active: boolean; onClick: () => void; ms: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[11px] px-3.5 py-2.5 text-[13px] font-bold"
      style={active
        ? { background: "var(--surface-3)", color: "var(--text)", boxShadow: "0 1px 5px rgba(0,0,0,0.18)" }
        : { background: "transparent", color: "var(--text-3)" }}
    >
      <Icon name={ms} size={16} style={{ color: active ? "var(--text)" : "var(--text-3)" }} />
      {children}
    </button>
  );
}

function VendorRow({ v, onNavigate }: { v: VendorCard; onNavigate: (path: string) => void }) {
  const order = waOrderLink(v.phone, v.name);
  return (
    <li className="overflow-hidden rounded-[16px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <button type="button" onClick={() => onNavigate(`/vendors/${v.id}`)} className="block w-full text-left active:opacity-90">
        {v.photoUrl && <img src={v.photoUrl} alt="" className="h-28 w-full object-cover" />}
        <div className="flex items-start gap-3 p-3.5">
          {!v.photoUrl && (
            <div className="flex h-[50px] w-[50px] flex-shrink-0 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--chef) 22%, transparent)" }}>
              <Icon name="storefront" size={26} style={{ color: "var(--chef)" }} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold" style={{ color: "var(--text)" }}>{v.name}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {v.sections.map((s) => {
                const l = s.toLowerCase();
                const tone = l.startsWith("veg") ? "var(--veg)" : l.startsWith("non") ? "var(--nonveg)" : "var(--text-3)";
                return (
                  <span key={s} className="rounded-[7px] px-2 py-0.5 text-[11px] font-bold" style={{ background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}>{s}</span>
                );
              })}
              <span className="text-[12px]" style={{ color: "var(--text-3)" }}>{v.itemCount} item{v.itemCount !== 1 ? "s" : ""}{v.minPrice > 0 && ` · from ${formatUnitPrice(v.minPrice, null)}`}</span>
            </div>
            {v.deliveryInfo && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-3)" }}>
                <Icon name="local_shipping" size={15} style={{ color: "var(--text-3)" }} /> {v.deliveryInfo}
              </p>
            )}
          </div>
          <Icon name="chevron_right" size={18} style={{ color: "var(--text-3)" }} />
        </div>
      </button>
      {order && (
        <a href={order} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 py-3 text-[14px] font-bold active:opacity-80" style={{ borderTop: "1px solid var(--border)", color: "var(--veg)" }}>
          <Icon name="chat" size={19} style={{ color: "var(--veg)" }} /> Order on WhatsApp
        </a>
      )}
    </li>
  );
}

function MenuRow({ menu, chefView }: { menu: MenuCard; chefView?: boolean }) {
  const L = KIND_LABELS[asKind(menu.kind)];
  const isMarket = menu.kind === "MARKET";
  const cat = isMarket ? "var(--produce)" : "var(--chef)";
  return (
    <Link
      to={`${L.sectionPath}/menus/${menu.id}`}
      className="flex items-start gap-3 rounded-[16px] p-3.5 active:opacity-90"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: menu.orderable ? 1 : 0.85 }}
    >
      <div className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${cat} 22%, transparent)` }}>
        <Icon name={isMarket ? "shopping_basket" : "cooking"} size={24} style={{ color: cat }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-[16px] font-bold" style={{ color: "var(--text)" }}>{menu.title}</h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {chefView && menu.coManaging && (
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>CO-MANAGING</span>
            )}
            <StatusBadge status={menu.status} orderable={menu.orderable} />
            <Icon name="chevron_right" size={18} style={{ color: "var(--text-3)" }} />
          </div>
        </div>
        <p className="mt-1 truncate text-[12px]" style={{ color: "var(--text-3)" }}>
          {chefView
            ? `${menu.orderCount} order${menu.orderCount !== 1 ? "s" : ""}`
            : `by ${menu.chef.name} · B${menu.chef.block}`}
          {menu.itemCount > 0 && ` · ${menu.itemCount} ${menu.itemCount !== 1 ? L.itemPlural : L.item}`}
          {menu.minPrice > 0 && ` · from ${formatUnitPrice(menu.minPrice, menu.minPriceUnit)}`}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5" style={{ color: "var(--text-3)" }}>
          {menu.orderByAt && (
            <span className="inline-flex items-center gap-1 text-[12px]">
              <Icon name="schedule" size={14} style={{ color: "var(--text-3)" }} /> order by {fmtTime(menu.orderByAt)}
            </span>
          )}
          {!chefView && menu.iOrdered && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--success-soft)", color: "var(--success)" }}>ORDERED</span>
          )}
        </div>
      </div>
    </Link>
  );
}

function OrderRow({ order, busy, onMarkPaid }: { order: MyOrder; busy: boolean; onMarkPaid: () => void }) {
  const L = KIND_LABELS[asKind(order.kind)];
  const itemLine = order.items.map(lineText).join(", ");
  return (
    <li className="rounded-[16px] p-[15px]" style={{ background: "var(--surface)", border: "1px solid var(--border)", opacity: order.status === "CANCELLED" ? 0.7 : 1 }}>
      <div className="flex items-start justify-between gap-2">
        <Link to={`${L.sectionPath}/menus/${order.menuId}`} className="truncate text-[16px] font-bold active:underline" style={{ color: "var(--text)" }}>
          {order.menuTitle}
        </Link>
        <span className="shrink-0 text-[16px] font-extrabold tabular-nums" style={{ color: "var(--text)" }}>₹{order.totalAmount}</span>
      </div>
      <p className="mt-1 line-clamp-1 text-[13px]" style={{ color: "var(--text-2)" }}>{itemLine}</p>
      <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-3)" }}>{order.chef.name} · B{order.chef.block} · {order.chef.flatNumber}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <OrderStatusPill status={order.status} />
        {order.chefPaid ? (
          <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: "var(--success-soft)", color: "var(--success)" }}>PAID ✓ confirmed</span>
        ) : order.buyerPaid ? (
          <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>PAID — awaiting confirm</span>
        ) : order.status !== "CANCELLED" ? (
          <button type="button" onClick={onMarkPaid} disabled={busy} className="rounded-full px-3.5 py-1.5 text-[12px] font-bold text-white active:opacity-90 disabled:opacity-50" style={{ background: "var(--accent-strong)" }}>
            {busy ? "…" : "I've paid"}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function StatusBadge({ status, orderable }: { status: string; orderable: boolean }) {
  if (orderable)
    return <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--success-soft)", color: "var(--success)" }}>OPEN</span>;
  return (
    <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--surface-3)", color: "var(--text-3)" }}>
      {status === "OPEN" ? "CLOSED" : status}
    </span>
  );
}

function OrderStatusPill({ status }: { status: string }) {
  const style =
    status === "CONFIRMED"
      ? { background: "var(--success-soft)", color: "var(--success)" }
      : status === "CANCELLED"
        ? { background: "var(--danger-soft)", color: "var(--danger)" }
        : { background: "var(--surface-3)", color: "var(--text-2)" };
  return <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={style}>{status}</span>;
}

function Empty({ ms, text }: { ms: string; text: string }) {
  return (
    <div className="rounded-[18px] px-6 py-10 text-center text-[14px] leading-relaxed" style={{ border: "1.5px dashed var(--border-strong)", color: "var(--text-3)" }}>
      <Icon name={ms} size={42} className="mx-auto mb-3 block" style={{ color: "var(--text-3)" }} />
      {text}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  });
}
