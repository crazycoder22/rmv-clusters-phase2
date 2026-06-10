"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UtensilsCrossed,
  ChefHat,
  ShoppingBag,
  ShoppingBasket,
  Store,
  Plus,
  Clock,
} from "lucide-react";
import { type FoodKind, KIND_LABELS, formatUnitPrice, unitLabel, asKind } from "@/lib/market";

// ── Types ──────────────────────────────────────────────────────────────────

interface MenuCard {
  id: string;
  title: string;
  description: string | null;
  date: string;
  orderByAt: string | null;
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
  items: { name: string; price: number; unit: string | null; qty: number }[];
}

type Tab = "order" | "kitchen" | "orders";

/** How an order line reads: "3 kg Apples" (market) | "2× Dosa" (kitchen). */
function lineText(i: { qty: number; name: string; unit: string | null }): string {
  return i.unit ? `${i.qty} ${unitLabel(i.unit)} ${i.name}` : `${i.qty}× ${i.name}`;
}

export default function FoodHub({ kind = "KITCHEN" }: { kind?: FoodKind }) {
  const L = KIND_LABELS[kind];
  const isMarket = kind === "MARKET";
  const SectionIcon = isMarket ? ShoppingBasket : UtensilsCrossed;
  const StallIcon = isMarket ? Store : ChefHat;

  const { status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("order");

  const [browse, setBrowse] = useState<MenuCard[]>([]);
  const [mine, setMine] = useState<MenuCard[]>([]);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [b, m, o] = await Promise.all([
        fetch(`/api/food/menus?kind=${kind}`),
        fetch(`/api/food/menus?mine=chef&kind=${kind}`),
        fetch("/api/food/orders"),
      ]);
      if (b.ok) setBrowse((await b.json()).menus ?? []);
      if (m.ok) setMine((await m.json()).menus ?? []);
      if (o.ok) setOrders((await o.json()).orders ?? []);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function markPaid(orderId: string) {
    setBusyId(orderId);
    try {
      const res = await fetch(`/api/food/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim_paid" }),
      });
      if (res.ok)
        setOrders((p) =>
          p.map((o) => (o.id === orderId ? { ...o, buyerPaid: true } : o))
        );
    } finally {
      setBusyId(null);
    }
  }

  const browseOthers = browse.filter((m) => !m.chef.isMe);
  // The orders endpoint returns every kind; show only this section's.
  const sectionOrders = orders.filter((o) => asKind(o.kind) === kind);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <SectionIcon className={isMarket ? "text-emerald-500" : "text-orange-500"} /> {L.section}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {isMarket ? "Fresh produce & goods from neighbours" : "Home kitchens in the community"}
            </p>
          </div>
          {tab === "kitchen" && (
            <Link
              href={`${L.sectionPath}/menus/new`}
              className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} /> {L.newCta}
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 w-fit">
          <TabBtn active={tab === "order"} onClick={() => setTab("order")} icon={SectionIcon}>
            Order
          </TabBtn>
          <TabBtn active={tab === "kitchen"} onClick={() => setTab("kitchen")} icon={StallIcon}>
            My {L.stall}
          </TabBtn>
          <TabBtn active={tab === "orders"} onClick={() => setTab("orders")} icon={ShoppingBag}>
            My orders
          </TabBtn>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            {tab === "order" &&
              (browseOthers.length === 0 ? (
                <Empty
                  icon={SectionIcon}
                  text={isMarket ? "No stalls open right now. Check back soon!" : "No open menus right now. Check back at meal times!"}
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {browseOthers.map((m) => (
                    <MenuCardView key={m.id} menu={m} L={L} />
                  ))}
                </div>
              ))}

            {tab === "kitchen" &&
              (mine.length === 0 ? (
                <Empty
                  icon={StallIcon}
                  text={
                    isMarket
                      ? `You haven't listed any goods yet. Click “${L.newCta}” to sell to the community!`
                      : `You haven't published a menu yet. Click “${L.newCta}” to cook for the community!`
                  }
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {mine.map((m) => (
                    <MenuCardView key={m.id} menu={m} L={L} chefView />
                  ))}
                </div>
              ))}

            {tab === "orders" &&
              (sectionOrders.length === 0 ? (
                <Empty icon={ShoppingBag} text="No orders yet. Browse the Order tab to get started." />
              ) : (
                <div className="space-y-3">
                  {sectionOrders.map((o) => (
                    <OrderCardView
                      key={o.id}
                      order={o}
                      L={L}
                      busy={busyId === o.id}
                      onMarkPaid={() => markPaid(o.id)}
                    />
                  ))}
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

type Labels = (typeof KIND_LABELS)[FoodKind];

function TabBtn({
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
      className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition ${
        active ? "bg-blue-600 text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
      }`}
    >
      <Icon size={15} />
      {children}
    </button>
  );
}

function MenuCardView({ menu, L, chefView }: { menu: MenuCard; L: Labels; chefView?: boolean }) {
  return (
    <Link
      href={`${L.sectionPath}/menus/${menu.id}`}
      className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{menu.title}</h3>
        <StatusBadge status={menu.status} orderable={menu.orderable} />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {chefView
          ? `${menu.orderCount} order${menu.orderCount !== 1 ? "s" : ""}`
          : `by ${menu.chef.name} · Block ${menu.chef.block}`}
        {menu.itemCount > 0 && ` · ${menu.itemCount} ${menu.itemCount !== 1 ? L.itemPlural : L.item}`}
        {menu.minPrice > 0 && ` · from ${formatUnitPrice(menu.minPrice, menu.minPriceUnit)}`}
      </p>
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
        {menu.orderByAt && (
          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> order by {fmtTime(menu.orderByAt)}
          </span>
        )}
        {!chefView && menu.iOrdered && (
          <span className="text-green-600 font-semibold">✓ ordered</span>
        )}
      </div>
    </Link>
  );
}

function OrderCardView({
  order,
  L,
  busy,
  onMarkPaid,
}: {
  order: MyOrder;
  L: Labels;
  busy: boolean;
  onMarkPaid: () => void;
}) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 ${
        order.status === "CANCELLED" ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`${L.sectionPath}/menus/${order.menuId}`} className="font-semibold text-gray-900 dark:text-gray-100 hover:underline">
          {order.menuTitle}
        </Link>
        <span className="font-bold text-gray-900 dark:text-gray-100">₹{order.totalAmount}</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        {order.items.map(lineText).join(", ")}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
        {order.chef.name} · Block {order.chef.block}, {order.chef.flatNumber}
      </p>
      <div className="flex items-center gap-2 mt-3">
        <OrderStatusPill status={order.status} />
        {order.chefPaid ? (
          <span className="text-xs font-semibold text-green-600">Paid ✓ confirmed</span>
        ) : order.buyerPaid ? (
          <span className="text-xs font-semibold text-amber-600">Paid — awaiting confirm</span>
        ) : order.status !== "CANCELLED" ? (
          <button
            type="button"
            onClick={onMarkPaid}
            disabled={busy}
            className="text-xs font-semibold bg-blue-600 text-white rounded-md px-3 py-1 hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "…" : "I've paid"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StatusBadge({ status, orderable }: { status: string; orderable: boolean }) {
  if (orderable)
    return <span className="shrink-0 text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5">Open</span>;
  return <span className="shrink-0 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5">{status === "OPEN" ? "Closed" : status}</span>;
}

function OrderStatusPill({ status }: { status: string }) {
  const cls =
    status === "CONFIRMED"
      ? "text-green-700 bg-green-100"
      : status === "CANCELLED"
        ? "text-red-700 bg-red-100"
        : "text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700";
  return <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${cls}`}>{status}</span>;
}

function Empty({ icon: Icon, text }: { icon: typeof ChefHat; text: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-16 text-center text-gray-500 dark:text-gray-400">
      <Icon size={32} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
      <p className="text-sm">{text}</p>
    </div>
  );
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}
