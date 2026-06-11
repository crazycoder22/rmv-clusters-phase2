"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Phone, Pencil, Trash2, Share2, Truck, CalendarDays, Store } from "lucide-react";
import { formatUnitPrice } from "@/lib/market";
import { buildVendorShareText, waOrderLink } from "@/lib/vendors";

interface Item { id: string; name: string; price: number; unit: string | null; section: string | null; note: string | null; }
interface VendorDetail {
  id: string; name: string; phone: string; description: string | null; notes: string | null;
  deliveryInfo: string | null; photoUrl: string | null; forDate: string | null; active: boolean;
  canEdit: boolean;
  addedBy: { name: string; block: number | null; flatNumber: string };
  items: Item[];
}

export default function VendorDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [v, setV] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/vendors/${id}`);
      if (!res.ok) { setError(res.status === 404 ? "Not found" : "Could not load"); return; }
      setV(await res.json());
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { if (id) void refresh(); }, [id, refresh]);

  async function del() {
    if (!v || !confirm(`Remove "${v.name}" from Food Vendors?`)) return;
    const res = await fetch(`/api/vendors/${v.id}`, { method: "DELETE" });
    if (res.ok) router.push("/vendors");
  }

  function share() {
    if (!v) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(buildVendorShareText(v))}`, "_blank");
  }

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center pt-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (error || !v) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Link href="/vendors" className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300"><ArrowLeft size={16} /> Food Vendors</Link>
          <p className="bg-red-50 dark:bg-red-900/30 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mt-4">{error ?? "Not found"}</p>
        </div>
      </div>
    );
  }

  const order = waOrderLink(v.phone, v.name);
  // Group items by section, untagged last.
  const order2: string[] = [];
  const bySection = new Map<string, Item[]>();
  for (const it of v.items) {
    const key = it.section?.trim() || "";
    if (!bySection.has(key)) { bySection.set(key, []); order2.push(key); }
    bySection.get(key)!.push(it);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/vendors" className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"><ArrowLeft size={16} /> Food Vendors</Link>

        <div className="flex items-start justify-between gap-2 mt-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Store className="text-amber-600" /> {v.name}</h1>
            {v.description && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{v.description}</p>}
          </div>
          {v.canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              <Link href={`/vendors/${v.id}/edit`} className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800"><Pencil size={14} /> Edit</Link>
              <button type="button" onClick={del} className="inline-flex items-center text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-800 hover:text-red-600"><Trash2 size={15} /></button>
            </div>
          )}
        </div>

        {v.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.photoUrl} alt={v.name} className="mt-3 w-full max-h-72 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400 mt-3">
          {v.forDate && <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> {new Date(v.forDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>}
          {v.deliveryInfo && <span className="inline-flex items-center gap-1"><Truck size={14} /> {v.deliveryInfo}</span>}
        </div>
        {v.notes && <p className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200 rounded-lg px-3 py-2 text-sm mt-3 whitespace-pre-line">{v.notes}</p>}

        {/* Order actions */}
        <div className="flex flex-wrap gap-2 mt-4">
          {order && (
            <a href={order} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-green-700"><MessageCircle size={16} /> Order on WhatsApp</a>
          )}
          <a href={`tel:${v.phone}`} className="inline-flex items-center gap-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium bg-white dark:bg-gray-800"><Phone size={16} /> {v.phone}</a>
          <button type="button" onClick={share} className="inline-flex items-center gap-1.5 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg px-4 py-2.5 text-sm font-medium bg-white dark:bg-gray-800"><Share2 size={16} /> Share</button>
        </div>

        {/* Menu */}
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-6 mb-2">Menu</h2>
        <div className="space-y-4">
          {order2.map((key) => (
            <div key={key || "untagged"}>
              {key && <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">{key}</p>}
              <div className="space-y-1.5">
                {bySection.get(key)!.map((it) => (
                  <div key={it.id} className="flex items-baseline justify-between gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5">
                    <span className="text-gray-900 dark:text-gray-100">{it.name}{it.note && <span className="text-gray-400 dark:text-gray-500 text-sm"> · {it.note}</span>}</span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatUnitPrice(it.price, it.unit)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 mt-5">Listed by {v.addedBy.name}. RMV doesn&apos;t handle these orders — you order directly with the vendor.</p>
      </div>
    </div>
  );
}
