import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Loader2,
  MapPin,
  Settings,
  Users,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageAmenities } from "../lib/roles";

type Amenity = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  capacity: number;
  requiresApproval: boolean;
  fee: number;
  feeNote: string | null;
  bookingWindowDays: number;
  active: boolean;
};

type Slot = {
  id: string;
  label: string | null;
  startAt: string;
  endAt: string;
  capacity: number;
  bookedCount: number;
  available: number;
  isPast: boolean;
  myBookingId: string | null;
  myStatus: string | null;
};

// IST "YYYY-MM-DD" for today + offset days.
function istYmd(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function dayLabels(ymd: string): { dow: string; day: string } {
  const d = new Date(`${ymd}T12:00:00+05:30`);
  return {
    dow: new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(d),
    day: new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", day: "numeric" }).format(d),
  };
}

function timeOf(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function AmenityDetail() {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const canManage = canManageAmenities(user?.roles);

  const [amenity, setAmenity] = useState<Amenity | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateIdx, setDateIdx] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const windowDays = amenity?.bookingWindowDays ?? 14;
  const dates = useMemo(
    () => Array.from({ length: Math.min(windowDays, 14) }, (_, i) => istYmd(i)),
    [windowDays]
  );
  const selectedDate = dates[dateIdx] ?? dates[0];

  useEffect(() => {
    if (!token || !id) return;
    let cancelled = false;
    apiFetch(`/api/amenities/${id}`, { token })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.amenity) setAmenity(data.amenity);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, id]);

  const loadAvailability = useCallback(async () => {
    if (!token || !id || !selectedDate) return;
    setSlotsLoading(true);
    try {
      const res = await apiFetch(`/api/amenities/${id}/availability?date=${selectedDate}`, { token });
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots ?? []);
      } else {
        setSlots([]);
      }
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [token, id, selectedDate]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  async function book(slot: Slot) {
    if (!token || !id || bookingId) return;
    setBookingId(slot.id);
    try {
      const res = await apiFetch(`/api/amenities/${id}/bookings`, {
        method: "POST",
        token,
        body: JSON.stringify({ date: selectedDate, slotId: slot.id }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.id) {
        navigate(`/amenities/booking/${data.id}`);
      } else {
        window.alert(data?.error ?? "Couldn't book this slot.");
        await loadAvailability();
      }
    } catch {
      window.alert("Couldn't book this slot. Check your connection.");
    } finally {
      setBookingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-slate-500" size={22} />
      </div>
    );
  }

  if (!amenity) {
    return (
      <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))]">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-1.5 text-sm text-slate-400 active:text-white">
          <ArrowLeft size={18} /> Back
        </button>
        <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-8 text-center text-sm text-slate-400">
          This amenity isn't available.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[max(2rem,env(safe-area-inset-top,0px))] pb-8">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-400 active:text-white">
          <ArrowLeft size={18} /> Back
        </button>
        {canManage ? (
          <button
            onClick={() => navigate(`/admin/amenities/${amenity.id}`)}
            className="flex items-center gap-1 text-xs text-slate-400 active:text-white"
          >
            <Settings size={14} /> Manage
          </button>
        ) : null}
      </div>

      <h1 className="text-xl font-semibold text-white">{amenity.name}</h1>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
        {amenity.location ? (
          <span className="inline-flex items-center gap-1"><MapPin size={12} /> {amenity.location}</span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <Users size={12} /> {amenity.capacity === 1 ? "One booking per slot" : `${amenity.capacity} per slot`}
        </span>
        {amenity.fee > 0 ? (
          <span className="text-amber-300">₹{amenity.fee}{amenity.feeNote ? ` · ${amenity.feeNote}` : ""}</span>
        ) : (
          <span className="text-emerald-300">Free</span>
        )}
      </div>
      {amenity.description ? (
        <p className="mt-3 text-sm text-slate-300">{amenity.description}</p>
      ) : null}
      {amenity.requiresApproval ? (
        <p className="mt-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
          Bookings here need management approval before they're confirmed.
        </p>
      ) : null}

      {/* Date strip */}
      <div className="mt-5 -mx-4 overflow-x-auto px-4">
        <div className="flex gap-2">
          {dates.map((ymd, i) => {
            const { dow, day } = dayLabels(ymd);
            const active = i === dateIdx;
            return (
              <button
                key={ymd}
                onClick={() => setDateIdx(i)}
                className={
                  active
                    ? "flex h-16 w-14 flex-shrink-0 flex-col items-center justify-center rounded-2xl bg-indigo-600 text-white"
                    : "flex h-16 w-14 flex-shrink-0 flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-800/60 text-slate-300 active:bg-slate-700"
                }
              >
                <span className="text-[10px] uppercase opacity-70">{dow}</span>
                <span className="text-lg font-semibold">{day}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots */}
      <div className="mt-5 space-y-2">
        {slotsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-slate-500" size={20} />
          </div>
        ) : slots.length === 0 ? (
          <p className="rounded-2xl border border-slate-700 bg-slate-800/40 px-4 py-6 text-center text-sm text-slate-400">
            No slots available on this day.
          </p>
        ) : (
          slots.map((s) => {
            const mine = !!s.myBookingId;
            const full = s.available <= 0;
            const disabled = s.isPast || (full && !mine);
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">
                    {timeOf(s.startAt)} – {timeOf(s.endAt)}
                    {s.label ? <span className="ml-2 text-xs text-slate-400">{s.label}</span> : null}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {s.isPast
                      ? "Passed"
                      : s.capacity === 1
                      ? full && !mine
                        ? "Booked"
                        : "Available"
                      : `${s.available} of ${s.capacity} free`}
                  </p>
                </div>
                {mine ? (
                  <button
                    onClick={() => navigate(`/amenities/booking/${s.myBookingId}`)}
                    className="flex items-center gap-1 rounded-xl bg-emerald-600/20 px-3 py-2 text-xs font-semibold text-emerald-300 active:bg-emerald-600/30"
                  >
                    <Check size={14} /> {s.myStatus === "PENDING" ? "Requested" : "Booked"}
                  </button>
                ) : (
                  <button
                    onClick={() => void book(s)}
                    disabled={disabled || bookingId === s.id}
                    className="flex min-w-[72px] items-center justify-center rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white active:bg-indigo-700 disabled:bg-slate-700 disabled:text-slate-500"
                  >
                    {bookingId === s.id ? <Loader2 size={14} className="animate-spin" /> : disabled ? "—" : "Book"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
