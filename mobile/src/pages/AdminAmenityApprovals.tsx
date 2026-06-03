import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ClipboardList, Loader2, XCircle } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Pending = {
  id: string;
  amenityName: string;
  bookerName: string;
  bookerBlock: number;
  bookerFlat: string;
  startAt: string;
  endAt: string;
  feeSnapshot: number;
  note: string | null;
};

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function AdminAmenityApprovals() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Pending[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch("/api/amenities/bookings?scope=pending", { token });
      if (res.ok) {
        const data = await res.json();
        setItems(data.bookings ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    if (!token || busyId) return;
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/amenities/bookings/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ action }),
      });
      if (res.ok) setItems((prev) => prev.filter((p) => p.id !== id));
      else window.alert((await res.json().catch(() => null))?.error ?? "Action failed");
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))] pb-8">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-sm text-slate-400 active:text-white">
        <ArrowLeft size={18} /> Back
      </button>
      <h1 className="text-2xl font-semibold tracking-tight text-white">Approvals</h1>
      <p className="mt-0.5 text-xs text-slate-400">Pending booking requests</p>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-slate-500" size={22} />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-10 text-center">
            <ClipboardList size={24} className="mx-auto mb-2 text-slate-600" />
            <p className="text-sm text-slate-400">No pending requests.</p>
          </div>
        ) : (
          items.map((b) => (
            <div key={b.id} className="rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3">
              <p className="text-sm font-semibold text-white">{b.amenityName}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {b.bookerName} · Block {b.bookerBlock}, Flat {b.bookerFlat}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">{fmt(b.startAt)}</p>
              {b.feeSnapshot > 0 ? <p className="mt-0.5 text-[11px] text-amber-300">Fee ₹{b.feeSnapshot}</p> : null}
              {b.note ? <p className="mt-1 text-xs text-slate-400">“{b.note}”</p> : null}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => void decide(b.id, "approve")}
                  disabled={busyId === b.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white active:bg-emerald-700 disabled:opacity-60"
                >
                  {busyId === b.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Approve
                </button>
                <button
                  onClick={() => void decide(b.id, "reject")}
                  disabled={busyId === b.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 active:bg-red-500/20 disabled:opacity-60"
                >
                  <XCircle size={14} /> Decline
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
