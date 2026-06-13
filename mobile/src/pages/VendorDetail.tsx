import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Share } from "@capacitor/share";
import Icon from "../components/Icon";
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

// Section heading colour — veg green / non-veg red / neutral (OneRMV Food & Bazaar.dc.html).
function sectionColor(key: string): string {
  const k = key.toLowerCase();
  if (k.startsWith("veg")) return "var(--veg)";
  if (k.startsWith("non")) return "var(--nonveg)";
  return "var(--text-3)";
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

  if (loading) {
    return (
      <div className="one-surface flex flex-1 items-center justify-center" style={{ background: "var(--bg)" }}>
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} />
      </div>
    );
  }
  if (error || !v) {
    return (
      <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)]" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <button onClick={() => navigate("/food")} className="flex items-center gap-1.5 py-4 text-[14px]" style={{ color: "var(--text-2)" }}>
          <Icon name="arrow_back" size={18} style={{ color: "var(--text-2)" }} /> Food &amp; Bazaar
        </button>
        <p className="rounded-[12px] px-4 py-3 text-[13px]" style={{ background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)" }}>{error ?? "Not found"}</p>
      </div>
    );
  }

  const order = waOrderLink(v.phone, v.name);

  // Group items by section, preserving first-seen order.
  const sectionOrder: string[] = [];
  const bySection = new Map<string, Item[]>();
  for (const it of v.items) {
    const key = it.section?.trim() || "";
    if (!bySection.has(key)) { bySection.set(key, []); sectionOrder.push(key); }
    bySection.get(key)!.push(it);
  }

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 py-2.5">
        <button onClick={() => navigate("/food")} className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={23} style={{ color: "var(--text-2)" }} />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[21px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>{v.name}</h1>
        {v.canEdit && (
          <div className="flex flex-shrink-0 items-center gap-4">
            <button onClick={() => navigate(`/vendors/${v.id}/edit`)} aria-label="Edit" className="flex active:opacity-70">
              <Icon name="edit" size={20} style={{ color: "var(--text-2)" }} />
            </button>
            <button onClick={del} aria-label="Delete" className="flex active:opacity-70">
              <Icon name="delete" size={20} style={{ color: "var(--text-2)" }} />
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Banner */}
        {v.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.photoUrl} alt={v.name} className="h-[140px] w-full rounded-[16px] object-cover" style={{ border: "1px solid var(--border)" }} />
        ) : (
          <div className="flex h-[120px] w-full items-center justify-center rounded-[16px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <Icon name="storefront" size={32} style={{ color: "var(--text-3)" }} />
          </div>
        )}

        {v.description && (
          <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--text-2)" }}>{v.description}</p>
        )}

        {/* Meta */}
        {(v.forDate || v.deliveryInfo) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {v.forDate && (
              <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--text-2)" }}>
                <Icon name="calendar_today" size={16} style={{ color: "var(--text-3)" }} />
                {new Date(v.forDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            )}
            {v.deliveryInfo && (
              <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--text-2)" }}>
                <Icon name="local_shipping" size={17} style={{ color: "var(--text-3)" }} />
                {v.deliveryInfo}
              </span>
            )}
          </div>
        )}

        {/* Notes */}
        {v.notes && (
          <div
            className="mt-3.5 whitespace-pre-line rounded-[13px] px-[15px] py-3 text-[13px] leading-relaxed"
            style={{ background: "var(--warning-soft)", color: "var(--warning)", border: "1px solid color-mix(in srgb, var(--warning) 45%, var(--border))" }}
          >
            {v.notes}
          </div>
        )}

        {/* Order on WhatsApp */}
        {order && (
          <a
            href={order}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-[13px] py-[15px] text-[16px] font-bold text-white active:opacity-90"
            style={{ background: "var(--whatsapp)", boxShadow: "0 8px 20px color-mix(in srgb, var(--whatsapp) 35%, transparent)" }}
          >
            <Icon name="chat" size={21} fill style={{ color: "#fff" }} />Order on WhatsApp
          </a>
        )}

        {/* Call + Share */}
        <div className="mt-2.5 flex gap-3">
          <a
            href={`tel:${v.phone}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] py-3 text-[14px] font-bold active:opacity-90"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
          >
            <Icon name="call" size={19} style={{ color: "var(--text)" }} />Call
          </a>
          <button
            onClick={() => void share()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] py-3 text-[14px] font-bold active:opacity-90"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
          >
            <Icon name="share" size={19} style={{ color: "var(--veg)" }} />Share
          </button>
        </div>

        {/* Menu */}
        <p className="one-mono mt-6 text-[10px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.12em" }}>MENU</p>
        {v.items.length === 0 ? (
          <p className="mt-2 text-[13px]" style={{ color: "var(--text-3)" }}>No items listed yet.</p>
        ) : (
          sectionOrder.map((key) => (
            <div key={key || "untagged"} className="mt-3.5">
              {key && (
                <p className="one-mono mb-2 text-[10px] font-semibold" style={{ color: sectionColor(key), letterSpacing: "0.12em" }}>
                  {key.toUpperCase()}
                </p>
              )}
              <div className="flex flex-col gap-2.5">
                {bySection.get(key)!.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-2.5 rounded-[12px] px-[15px] py-3"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <span className="text-[14.5px] font-semibold" style={{ color: "var(--text)" }}>
                      {it.name}
                      {it.note && <span className="font-normal" style={{ color: "var(--text-3)" }}> · {it.note}</span>}
                    </span>
                    <span className="flex-shrink-0 whitespace-nowrap text-[13.5px] font-semibold tabular-nums" style={{ color: "var(--text-2)" }}>
                      {formatUnitPrice(it.price, it.unit)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        <p className="mt-5 text-[12.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          Listed by {v.addedBy.name}. RMV doesn't handle these orders — you order directly with the vendor.
        </p>
      </div>
    </div>
  );
}
