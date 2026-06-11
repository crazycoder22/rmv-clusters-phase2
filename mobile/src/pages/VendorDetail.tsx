import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Loader2, MessageCircle, Pencil, Phone, Share2, Store, Trash2, Truck } from "lucide-react";
import { Share } from "@capacitor/share";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { formatUnitPrice } from "../lib/market";
import { buildVendorShareText, waOrderLink } from "../lib/vendors";

interface Item { id: string; name: string; price: number; unit: string | null; section: string | null; note: string | null; }
interface VendorDetail {
  id: string; name: string; phone: string; description: string | null; notes: string | null;
  deliveryInfo: string | null; photoUrl: string | null; forDate: string | null; active: boolean;
  canEdit: boolean;
  addedBy: { name: string; block: number | null; flatNumber: string };
  items: Item[];
}

export default function VendorDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [v, setV] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/vendors/${id}`, { token });
      if (!res.ok) { setError(res.status === 404 ? "Not found" : "Could not load"); return; }
      setV(await res.json());
    } catch { setError("Network error"); } finally { setLoading(false); }
  }, [id, token]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function del() {
    if (!v || !confirm(`Remove "${v.name}" from Food Vendors?`)) return;
    const res = await apiFetch(`/api/vendors/${v.id}`, { method: "DELETE", token });
    if (res.ok) navigate("/food", { replace: true });
  }

  async function share() {
    if (!v) return;
    try {
      await Share.share({ title: v.name, text: buildVendorShareText(v), dialogTitle: "Share vendor menu" });
    } catch { /* cancelled */ }
  }

  if (loading) return <div className="flex flex-1 items-center justify-center text-slate-500"><Loader2 size={20} className="animate-spin" /></div>;
  if (error || !v) {
    return (
      <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
        <button onClick={() => navigate("/food")} className="flex items-center gap-1 py-4 text-sm text-slate-400"><ArrowLeft size={16} /> Food &amp; Bazaar</button>
        <p className="rounded-xl border border-red-700/60 bg-red-900/20 px-4 py-3 text-xs text-red-200">{error ?? "Not found"}</p>
      </div>
    );
  }

  const order = waOrderLink(v.phone, v.name);
  const sectionOrder: string[] = [];
  const bySection = new Map<string, Item[]>();
  for (const it of v.items) {
    const key = it.section?.trim() || "";
    if (!bySection.has(key)) { bySection.set(key, []); sectionOrder.push(key); }
    bySection.get(key)!.push(it);
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-8">
      <header className="flex items-center gap-2 py-4">
        <Link to="/food" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"><ArrowLeft size={20} /></Link>
        <h1 className="flex-1 truncate text-lg font-semibold text-white">{v.name}</h1>
        {v.canEdit && (
          <>
            <button onClick={() => navigate(`/vendors/${v.id}/edit`)} aria-label="Edit" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800"><Pencil size={16} /></button>
            <button onClick={del} aria-label="Delete" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 active:bg-slate-800 active:text-red-300"><Trash2 size={16} /></button>
          </>
        )}
      </header>

      {v.photoUrl
        ? <img src={v.photoUrl} alt={v.name} className="mb-3 max-h-64 w-full rounded-xl border border-slate-700 object-cover" />
        : <div className="mb-3 flex h-24 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/40 text-amber-300"><Store size={28} /></div>}

      {v.description && <p className="mb-2 text-sm text-slate-300">{v.description}</p>}
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-400">
        {v.forDate && <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {new Date(v.forDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>}
        {v.deliveryInfo && <span className="inline-flex items-center gap-1"><Truck size={12} /> {v.deliveryInfo}</span>}
      </div>
      {v.notes && <p className="mb-3 whitespace-pre-line rounded-xl border border-amber-700/40 bg-amber-900/15 px-3 py-2 text-[12px] text-amber-200">{v.notes}</p>}

      {/* Order actions */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {order && <a href={order} target="_blank" rel="noopener noreferrer" className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white active:bg-emerald-600"><MessageCircle size={16} /> Order on WhatsApp</a>}
        <a href={`tel:${v.phone}`} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-[13px] font-medium text-slate-200 active:bg-slate-700"><Phone size={15} /> Call</a>
        <button onClick={() => void share()} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-[13px] font-medium text-emerald-300 active:bg-slate-700"><Share2 size={15} /> Share</button>
      </div>

      {/* Menu */}
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Menu</h2>
      <div className="space-y-3">
        {sectionOrder.map((key) => (
          <div key={key || "untagged"}>
            {key && <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{key}</p>}
            <ul className="space-y-1.5">
              {bySection.get(key)!.map((it) => (
                <li key={it.id} className="flex items-baseline justify-between gap-3 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5">
                  <span className="text-sm text-white">{it.name}{it.note && <span className="text-slate-500"> · {it.note}</span>}</span>
                  <span className="whitespace-nowrap text-[12px] font-semibold tabular-nums text-slate-300">{formatUnitPrice(it.price, it.unit)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-5 text-[11px] text-slate-500">Listed by {v.addedBy.name}. RMV doesn't handle these orders — you order directly with the vendor.</p>
    </div>
  );
}
