import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChefHat,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  ShoppingBag,
  ShoppingBasket,
} from "lucide-react";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { type FoodKind, KIND_LABELS, formatUnitPrice, unitLabel, asKind } from "../lib/market";

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

type Tab = "order" | "kitchen" | "bazaar" | "orders";

/** "3 kg Apples" (market) | "2× Dosa" (kitchen). */
function lineText(i: { qty: number; name: string; unit: string | null }): string {
  return i.unit ? `${i.qty} ${unitLabel(i.unit)} ${i.name}` : `${i.qty}× ${i.name}`;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Food() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("order");

  const [browse, setBrowse] = useState<MenuCard[]>([]);
  const [mineKitchen, setMineKitchen] = useState<MenuCard[]>([]);
  const [mineBazaar, setMineBazaar] = useState<MenuCard[]>([]);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [b, k, z, o] = await Promise.all([
        apiFetch("/api/food/menus?kind=ALL", { token }),
        apiFetch("/api/food/menus?mine=chef&kind=KITCHEN", { token }),
        apiFetch("/api/food/menus?mine=chef&kind=MARKET", { token }),
        apiFetch("/api/food/orders", { token }),
      ]);
      if (b.ok) setBrowse((await b.json()).menus ?? []);
      if (k.ok) setMineKitchen((await k.json()).menus ?? []);
      if (z.ok) setMineBazaar((await z.json()).menus ?? []);
      if (o.ok) setOrders((await o.json()).orders ?? []);
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
        : null;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to="/more"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white">Food &amp; Bazaar</h1>
          <p className="truncate text-[11px] text-slate-500">
            Home kitchens &amp; fresh produce from the community
          </p>
        </div>
        {createCta && (
          <button
            type="button"
            onClick={() => navigate(createCta.path)}
            className="flex h-9 items-center gap-1 rounded-full bg-indigo-500 px-3 text-sm font-medium text-white active:bg-indigo-600"
          >
            <Plus size={14} />
            {createCta.label}
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className="mb-4 flex rounded-xl bg-slate-800 p-0.5">
        <TabButton active={tab === "order"} onClick={() => setTab("order")} icon={ShoppingBag}>
          Order
        </TabButton>
        <TabButton active={tab === "kitchen"} onClick={() => setTab("kitchen")} icon={ChefHat}>
          Kitchen
        </TabButton>
        <TabButton active={tab === "bazaar"} onClick={() => setTab("bazaar")} icon={ShoppingBasket}>
          Bazaar
        </TabButton>
        <TabButton active={tab === "orders"} onClick={() => setTab("orders")} icon={ShoppingBag}>
          Orders
        </TabButton>
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-2.5 text-xs text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-10 text-slate-500">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <div className="flex-1 pb-4">
          {tab === "order" && (
            browseOthers.length === 0 ? (
              <Empty icon={ShoppingBag} text="Nothing open right now. Check back soon!" />
            ) : (
              <ul className="space-y-2">
                {browseOthers.map((m) => (
                  <MenuRow key={m.id} menu={m} />
                ))}
              </ul>
            )
          )}

          {tab === "kitchen" && (
            mineKitchen.length === 0 ? (
              <Empty icon={ChefHat} text="You haven't published a menu yet. Tap “Menu” to cook for the community!" />
            ) : (
              <ul className="space-y-2">
                {mineKitchen.map((m) => (
                  <MenuRow key={m.id} menu={m} chefView />
                ))}
              </ul>
            )
          )}

          {tab === "bazaar" && (
            mineBazaar.length === 0 ? (
              <Empty icon={ShoppingBasket} text="You haven't listed any goods yet. Tap “Stall” to sell produce by the unit!" />
            ) : (
              <ul className="space-y-2">
                {mineBazaar.map((m) => (
                  <MenuRow key={m.id} menu={m} chefView />
                ))}
              </ul>
            )
          )}

          {tab === "orders" && (
            orders.length === 0 ? (
              <Empty icon={ShoppingBag} text="No orders yet. Browse the Order tab to get started." />
            ) : (
              <ul className="space-y-2">
                {orders.map((o) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    busy={busyId === o.id}
                    onMarkPaid={() => markPaid(o.id)}
                  />
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

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ChefHat;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[12px] font-medium",
        active ? "bg-slate-700 text-white" : "text-slate-400"
      )}
    >
      <Icon size={13} />
      {children}
    </button>
  );
}

function MenuRow({ menu, chefView }: { menu: MenuCard; chefView?: boolean }) {
  const L = KIND_LABELS[asKind(menu.kind)];
  const isMarket = menu.kind === "MARKET";
  const Icon = isMarket ? ShoppingBasket : ChefHat;
  return (
    <Link
      to={`${L.sectionPath}/menus/${menu.id}`}
      className={clsx(
        "flex items-start gap-3 rounded-2xl border p-3 active:bg-slate-800",
        menu.orderable
          ? "border-slate-700 bg-slate-800/60"
          : "border-slate-700 bg-slate-800/30"
      )}
    >
      <div className={clsx("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full", isMarket ? "bg-emerald-500/20 text-emerald-300" : "bg-orange-500/20 text-orange-300")}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-white">{menu.title}</h3>
          <StatusBadge status={menu.status} orderable={menu.orderable} />
        </div>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">
          {chefView
            ? `${menu.orderCount} order${menu.orderCount !== 1 ? "s" : ""}`
            : `by ${menu.chef.name} · B${menu.chef.block}`}
          {menu.itemCount > 0 && ` · ${menu.itemCount} ${menu.itemCount !== 1 ? L.itemPlural : L.item}`}
          {menu.minPrice > 0 && ` · from ${formatUnitPrice(menu.minPrice, menu.minPriceUnit)}`}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500">
          {menu.orderByAt && (
            <span className="inline-flex items-center gap-0.5">
              <Clock size={9} /> order by {fmtTime(menu.orderByAt)}
            </span>
          )}
          {!chefView && menu.iOrdered && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-300">
              ORDERED
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={16} className="mt-1 flex-shrink-0 text-slate-500" />
    </Link>
  );
}

function OrderRow({
  order,
  busy,
  onMarkPaid,
}: {
  order: MyOrder;
  busy: boolean;
  onMarkPaid: () => void;
}) {
  const L = KIND_LABELS[asKind(order.kind)];
  const itemLine = order.items.map(lineText).join(", ");
  return (
    <li
      className={clsx(
        "rounded-2xl border p-3",
        order.status === "CANCELLED"
          ? "border-slate-700 bg-slate-800/30 opacity-70"
          : "border-slate-700 bg-slate-800/60"
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <Link to={`${L.sectionPath}/menus/${order.menuId}`} className="truncate text-sm font-semibold text-white active:underline">
          {order.menuTitle}
        </Link>
        <span className="shrink-0 text-sm font-bold tabular-nums text-white">
          ₹{order.totalAmount}
        </span>
      </div>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">{itemLine}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        {order.chef.name} · B{order.chef.block} · {order.chef.flatNumber}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <OrderStatusPill status={order.status} />
        {order.chefPaid ? (
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            PAID ✓ confirmed
          </span>
        ) : order.buyerPaid ? (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
            PAID — awaiting confirm
          </span>
        ) : order.status !== "CANCELLED" ? (
          <button
            type="button"
            onClick={onMarkPaid}
            disabled={busy}
            className="rounded-full bg-indigo-500 px-2.5 py-0.5 text-[10px] font-bold text-white active:bg-indigo-600 disabled:opacity-50"
          >
            {busy ? "…" : "I've paid"}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function StatusBadge({
  status,
  orderable,
}: {
  status: string;
  orderable: boolean;
}) {
  if (orderable)
    return (
      <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
        OPEN
      </span>
    );
  return (
    <span className="shrink-0 rounded-full bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">
      {status === "OPEN" ? "CLOSED" : status}
    </span>
  );
}

function OrderStatusPill({ status }: { status: string }) {
  const cls =
    status === "CONFIRMED"
      ? "bg-emerald-500/20 text-emerald-300"
      : status === "CANCELLED"
        ? "bg-red-500/20 text-red-300"
        : "bg-slate-700 text-slate-300";
  return (
    <span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-bold", cls)}>
      {status}
    </span>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof ChefHat; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
      <Icon size={28} className="mx-auto mb-2 text-slate-600" />
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
