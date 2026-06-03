import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  XCircle,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Booking = {
  id: string;
  amenityName: string;
  location: string | null;
  bookerName: string;
  bookerBlock: number;
  bookerFlat: string;
  startAt: string;
  endAt: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "REJECTED" | "COMPLETED";
  feeSnapshot: number;
  note: string | null;
  bookerPaid: boolean;
  adminConfirmedPaid: boolean;
  cancelledBy: string | null;
  amBooker: boolean;
  canManage: boolean;
  payInfo: string | null;
  payQrUrl: string | null;
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

const STATUS_UI: Record<Booking["status"], { label: string; cls: string }> = {
  PENDING: { label: "Awaiting approval", cls: "border-sky-500/40 bg-sky-500/10 text-sky-300" },
  CONFIRMED: { label: "Confirmed", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  CANCELLED: { label: "Cancelled", cls: "border-slate-600 bg-slate-700/40 text-slate-400" },
  REJECTED: { label: "Declined", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
  COMPLETED: { label: "Completed", cls: "border-slate-600 bg-slate-700/40 text-slate-400" },
};

export default function AmenityBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [b, setB] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const res = await apiFetch(`/api/amenities/bookings/${id}`, { token });
      if (res.ok) setB(await res.json());
    } catch {
      // keep
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string) {
    if (!token || !id || busy) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/amenities/bookings/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ action }),
      });
      if (res.ok) await load();
      else window.alert((await res.json().catch(() => null))?.error ?? "Action failed");
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!token || !id || busy) return;
    if (!window.confirm("Cancel this booking?")) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/amenities/bookings/${id}`, { method: "DELETE", token });
      if (res.ok) await load();
      else window.alert((await res.json().catch(() => null))?.error ?? "Could not cancel");
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-slate-500" size={22} />
      </div>
    );
  }

  if (!b) {
    return (
      <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))]">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-1.5 text-sm text-slate-400 active:text-white">
          <ArrowLeft size={18} /> Back
        </button>
        <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-400">
          This booking isn't available.
        </p>
      </div>
    );
  }

  const ui = STATUS_UI[b.status];
  const isActive = b.status === "PENDING" || b.status === "CONFIRMED";
  const upcoming = new Date(b.startAt).getTime() > Date.now();

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))] pb-8">
      <button onClick={() => navigate(-1)} className="mb-5 flex items-center gap-1.5 text-sm text-slate-400 active:text-white">
        <ArrowLeft size={18} /> Back
      </button>

      <div className={`rounded-2xl border px-4 py-4 ${ui.cls}`}>
        <p className="text-xs font-bold uppercase tracking-wide">{ui.label}</p>
        <p className="mt-2 text-lg font-semibold text-white">{b.amenityName}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-300">
          <Clock size={14} /> {fmt(b.startAt)} – {new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).format(new Date(b.endAt))}
        </p>
        {b.location ? (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <MapPin size={12} /> {b.location}
          </p>
        ) : null}
      </div>

      {/* Manager sees who booked */}
      {b.canManage && !b.amBooker ? (
        <p className="mt-3 text-sm text-slate-300">
          Booked by <span className="font-medium text-white">{b.bookerName}</span> · Block {b.bookerBlock}, Flat {b.bookerFlat}
        </p>
      ) : null}
      {b.note ? <p className="mt-2 text-sm text-slate-400">“{b.note}”</p> : null}

      {/* Fee + payment (booker only) */}
      {b.amBooker && b.feeSnapshot > 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-white">Fee ₹{b.feeSnapshot}</p>
            {b.adminConfirmedPaid ? (
              <span className="text-xs text-emerald-300">Payment confirmed</span>
            ) : b.bookerPaid ? (
              <span className="text-xs text-amber-300">Marked paid</span>
            ) : (
              <span className="text-xs text-slate-500">Unpaid</span>
            )}
          </div>
          {b.payInfo ? <p className="mt-1 text-xs text-slate-400">Pay to: {b.payInfo}</p> : null}
          {b.payQrUrl ? (
            <img src={b.payQrUrl} alt="Payment QR" className="mt-2 h-40 w-40 rounded-lg object-contain" />
          ) : null}
          {isActive && !b.adminConfirmedPaid ? (
            <button
              onClick={() => void act(b.bookerPaid ? "unmarkPaid" : "markPaid")}
              disabled={busy}
              className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 active:bg-slate-700 disabled:opacity-60"
            >
              {b.bookerPaid ? "Undo “I've paid”" : "I've paid"}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Manager: approve / reject pending */}
      {b.canManage && b.status === "PENDING" ? (
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => void act("approve")}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-60"
          >
            <CheckCircle2 size={16} /> Approve
          </button>
          <button
            onClick={() => void act("reject")}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 active:bg-red-500/20 disabled:opacity-60"
          >
            <XCircle size={16} /> Decline
          </button>
        </div>
      ) : null}

      {/* Manager: confirm payment receipt */}
      {b.canManage && b.status === "CONFIRMED" && b.feeSnapshot > 0 ? (
        <button
          onClick={() => void act(b.adminConfirmedPaid ? "unconfirmPaid" : "confirmPaid")}
          disabled={busy}
          className="mt-3 w-full rounded-2xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 active:bg-slate-700 disabled:opacity-60"
        >
          {b.adminConfirmedPaid ? "Undo payment confirmation" : "Confirm payment received"}
        </button>
      ) : null}

      {/* Cancel */}
      {isActive && upcoming && (b.amBooker || b.canManage) ? (
        <button
          onClick={() => void cancel()}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-300 active:bg-red-500/15 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
          Cancel booking
        </button>
      ) : null}

      {b.status === "CANCELLED" && b.cancelledBy === "admin" ? (
        <p className="mt-4 text-center text-xs text-slate-500">Cancelled by management.</p>
      ) : null}
    </div>
  );
}
