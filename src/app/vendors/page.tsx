"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Store, Truck, MessageCircle } from "lucide-react";
import { formatUnitPrice } from "@/lib/market";
import { waOrderLink } from "@/lib/vendors";

interface VendorCard {
  id: string;
  name: string;
  phone: string;
  description: string | null;
  deliveryInfo: string | null;
  photoUrl: string | null;
  forDate: string | null;
  itemCount: number;
  minPrice: number;
  sections: string[];
  addedBy: { name: string; block: number | null; flatNumber: string; isMe: boolean };
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorCard[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vendors${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
      if (res.ok) setVendors((await res.json()).vendors);
    } finally { setLoading(false); }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Store className="text-amber-600" /> Food Vendors</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Outside kitchens &amp; caterers — menus, rates &amp; WhatsApp ordering.</p>
          </div>
          <Link href="/vendors/new" className="shrink-0 inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700"><Plus size={15} /> Add</Link>
        </div>

        <div className="relative mt-4 mb-5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendors…" className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" /></div>
        ) : vendors.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-12 text-center text-gray-500 dark:text-gray-400">
            <Store size={28} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            No vendors yet. Know a good one? <Link href="/vendors/new" className="text-blue-600 font-medium">Add it</Link>.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {vendors.map((v) => <VendorCardView key={v.id} v={v} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function VendorCardView({ v }: { v: VendorCard }) {
  const order = waOrderLink(v.phone, v.name);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition flex flex-col">
      <Link href={`/vendors/${v.id}`} className="block">
        {v.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.photoUrl} alt="" className="w-full h-32 object-cover" />
        )}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{v.name}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {v.sections.map((s) => (
              <span key={s} className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${s.toLowerCase().startsWith("veg") ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : s.toLowerCase().startsWith("non") ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>{s}</span>
            ))}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {v.itemCount} item{v.itemCount !== 1 ? "s" : ""}{v.minPrice > 0 && ` · from ${formatUnitPrice(v.minPrice, null)}`}
          </p>
          {v.deliveryInfo && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 inline-flex items-center gap-1"><Truck size={12} /> {v.deliveryInfo}</p>}
        </div>
      </Link>
      {order && (
        <a href={order} target="_blank" rel="noopener noreferrer" className="mt-auto flex items-center justify-center gap-1.5 border-t border-gray-100 dark:border-gray-700 py-2.5 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20">
          <MessageCircle size={15} /> Order on WhatsApp
        </a>
      )}
    </div>
  );
}
