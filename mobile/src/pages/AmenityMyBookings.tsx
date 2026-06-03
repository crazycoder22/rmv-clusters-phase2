import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarClock, Loader2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Booking = {
  id: string;
  amenityName: string;
  startAt: string;
  endAt: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "REJECTED" | "COMPLETED";
  feeSnapshot: number;
  bookerPaid: boolean;
  adminConfirmedPaid: boolean;
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

const STATUS_CLS: Record<Booking["status"], string> = {
  PENDING: "text-sky-300",
  CONFIRMED: "text-emerald-300",
  CANCELLED: "text-slate-500",
  REJECTED: "text-red-300",
  COMPLETED: "text-slate-500",
};

export default function AmenityMyBookings() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/amenities/bookings?when=${tab}`, { token });
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))] pb-8">
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-sm text-slate-400 active:text-white">
        <ArrowLeft size={18} /> Back
      </button>
      <h1 className="text-2xl font-semibold tracking-tight text-white">My bookings</h1>

      <div className="mt-4 flex gap-2">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white"
                : "flex-1 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm font-medium text-slate-300 active:bg-slate-700"
            }
          >
            {t === "upcoming" ? "Upcoming" : "Past"}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-slate-500" size={22} />
          </div>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-8 text-center">
            <CalendarClock size={24} className="mx-auto mb-2 text-slate-600" />
            <p className="text-sm text-slate-400">
              No {tab} bookings.{" "}
              <Link to="/amenities" className="text-indigo-300">Browse amenities</Link>
            </p>
          </div>
        ) : (
          bookings.map((b) => (
            <Link
              key={b.id}
              to={`/amenities/booking/${b.id}`}
              className="block rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3 active:bg-slate-700"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">{b.amenityName}</p>
                <span className={`text-[11px] font-medium ${STATUS_CLS[b.status]}`}>
                  {b.status === "PENDING" ? "Awaiting approval" : b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">{fmt(b.startAt)}</p>
              {b.feeSnapshot > 0 ? (
                <p className="mt-0.5 text-[11px] text-amber-300">
                  ₹{b.feeSnapshot}
                  {b.adminConfirmedPaid ? " · paid ✓" : b.bookerPaid ? " · marked paid" : " · unpaid"}
                </p>
              ) : null}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
