import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { Car, Plus, MapPin, Clock, IndianRupee } from "lucide-react";

type Tab = "find" | "slots" | "bookings";

interface SlotCard {
  id: string;
  label: string;
  location: string | null;
  description: string | null;
  hourlyRate: number;
  monthlyRate: number | null;
  active: boolean;
  photoUrl: string | null;
  hasPayInfo: boolean;
  owner: { id: string; name: string; block: number | null; flatNumber: string; isMe: boolean };
  busyNow: boolean;
  busyUntil: string | null;
  busyOngoing?: boolean;
  upcomingCount: number;
}
interface BookerBooking {
  id: string;
  slotId: string;
  slotLabel: string;
  startAt: string;
  endAt: string;
  status: "BOOKED" | "CANCELLED" | "COMPLETED";
  mode?: string;
  openEnded?: boolean;
  monthlyRate?: number | null;
  vehicleNumber: string | null;
  totalAmount: number;
  bookerPaid: boolean;
  ownerConfirmedPaid: boolean;
}
interface OwnerBooking {
  id: string;
  slotId: string;
  slotLabel: string;
  startAt: string;
  endAt: string;
  status: "BOOKED" | "CANCELLED" | "COMPLETED";
  mode?: string;
  openEnded?: boolean;
  monthlyRate?: number | null;
  vehicleNumber: string | null;
  totalAmount: number;
  bookerPaid: boolean;
  ownerConfirmedPaid: boolean;
  booker: { name: string; block: number | null; flatNumber: string };
}

export default function Parking() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("find");
  const [browse, setBrowse] = useState<SlotCard[]>([]);
  const [mine, setMine] = useState<SlotCard[]>([]);
  const [asBooker, setAsBooker] = useState<BookerBooking[]>([]);
  const [asOwner, setAsOwner] = useState<OwnerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [b, m, bk] = await Promise.all([
        apiFetch("/api/parking/slots", { token }),
        apiFetch("/api/parking/slots?mine=owner", { token }),
        apiFetch("/api/parking/bookings", { token }),
      ]);
      if (b.ok) setBrowse((await b.json()).slots ?? []);
      if (m.ok) setMine((await m.json()).slots ?? []);
      if (bk.ok) {
        const d = await bk.json();
        setAsBooker(d.asBooker ?? []);
        setAsOwner(d.asOwner ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function patchBooking(id: string, action: string) {
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/parking/bookings/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ action }),
      });
      if (res.ok) await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <Car className="text-blue-400" size={22} />
          <h1 className="text-lg font-semibold text-white">Parking</h1>
        </div>
        {tab === "slots" && (
          <button
            type="button"
            onClick={() => navigate("/parking/slots/new")}
            className="flex h-9 items-center gap-1 rounded-full bg-indigo-500 px-3 text-sm font-medium text-white active:bg-indigo-600"
          >
            <Plus size={14} /> List
          </button>
        )}
      </header>

      <div className="mb-4 flex rounded-xl bg-slate-800 p-0.5">
        <TabBtn active={tab === "find"} onClick={() => setTab("find")}>Find</TabBtn>
        <TabBtn active={tab === "slots"} onClick={() => setTab("slots")}>My slots</TabBtn>
        <TabBtn active={tab === "bookings"} onClick={() => setTab("bookings")}>My bookings</TabBtn>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-blue-400" />
        </div>
      ) : (
        <div className="flex-1 pb-4">
          {tab === "find" &&
            (browse.length === 0 ? (
              <Empty text="No slots listed right now. Check back later." />
            ) : (
              <div className="space-y-2">
                {browse.map((s) => <SlotRow key={s.id} slot={s} onClick={() => navigate(`/parking/${s.id}`)} />)}
              </div>
            ))}

          {tab === "slots" &&
            (mine.length === 0 ? (
              <Empty text="You haven't listed a slot yet. Tap “List” to share yours." />
            ) : (
              <div className="space-y-2">
                {mine.map((s) => <SlotRow key={s.id} slot={s} ownerView onClick={() => navigate(`/parking/${s.id}`)} />)}
              </div>
            ))}

          {tab === "bookings" && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Slots I booked</h2>
                {asBooker.length === 0 ? (
                  <Empty text="No bookings yet." />
                ) : (
                  <div className="space-y-2">
                    {asBooker.map((b) => (
                      <BookerRow key={b.id} b={b} busy={busyId === b.id}
                        onOpen={() => navigate(`/parking/${b.slotId}`)}
                        onPay={() => patchBooking(b.id, "claim_paid")}
                        onCancel={() => patchBooking(b.id, "cancel")} />
                    ))}
                  </div>
                )}
              </div>

              {asOwner.length > 0 && (
                <div>
                  <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bookings on my slots</h2>
                  <div className="space-y-2">
                    {asOwner.map((b) => (
                      <OwnerRow key={b.id} b={b} busy={busyId === b.id}
                        onOpen={() => navigate(`/parking/${b.slotId}`)}
                        onConfirm={() => patchBooking(b.id, "confirm_paid")}
                        onCancel={() => patchBooking(b.id, "cancel")} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex-1 rounded-lg py-2 text-[12px] font-medium ${active ? "bg-slate-700 text-white" : "text-slate-400"}`}>
      {children}
    </button>
  );
}

function SlotRow({ slot, ownerView, onClick }: { slot: SlotCard; ownerView?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60 text-left active:bg-slate-800">
      {slot.photoUrl && <img src={slot.photoUrl} alt="" className="h-28 w-full object-cover" />}
      <div className="p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{slot.label}</h3>
        {ownerView ? (
          <Badge color={slot.active ? "green" : "slate"}>{slot.active ? "Listed" : "Paused"}</Badge>
        ) : slot.busyOngoing ? (
          <Badge color="purple">Rented monthly</Badge>
        ) : slot.busyNow ? (
          <Badge color="amber">Busy now</Badge>
        ) : (
          <Badge color="green">Free</Badge>
        )}
      </div>
      {slot.location && <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><MapPin size={11} /> {slot.location}</p>}
      <div className="mt-1.5 flex items-center gap-3 text-[12px]">
        <span className="flex items-center font-semibold text-white"><IndianRupee size={12} />{slot.hourlyRate}/hr</span>
        {slot.monthlyRate != null && <span className="flex items-center text-[11px] font-medium text-purple-300"><IndianRupee size={10} />{slot.monthlyRate}/mo</span>}
        {!ownerView && <span className="text-[11px] text-slate-500">{slot.owner.name} · B{slot.owner.block ?? "—"}</span>}
        {ownerView && slot.upcomingCount > 0 && <span className="text-[11px] text-blue-400">{slot.upcomingCount} upcoming</span>}
      </div>
      </div>
    </button>
  );
}

function BookerRow({ b, busy, onOpen, onPay, onCancel }: { b: BookerBooking; busy: boolean; onOpen: () => void; onPay: () => void; onCancel: () => void }) {
  const upcoming = new Date(b.startAt).getTime() > Date.now();
  return (
    <div className={`rounded-2xl border border-slate-700 bg-slate-800/60 p-3 ${b.status === "CANCELLED" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="text-left text-sm font-semibold text-white active:underline">{b.slotLabel}</button>
        <span className="text-sm font-bold tabular-nums text-white">{b.mode === "MONTHLY" ? `₹${b.monthlyRate}/mo` : `₹${b.totalAmount}`}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">{bookingDates(b)}</p>
      {b.vehicleNumber && <p className="mt-0.5 text-[10px] text-slate-500">{b.vehicleNumber}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusPill status={b.status} />
        {b.status === "BOOKED" && (
          b.ownerConfirmedPaid ? <span className="text-[10px] font-bold text-emerald-300">PAID ✓ confirmed</span>
          : b.bookerPaid ? <span className="text-[10px] font-bold text-amber-200">PAID — awaiting confirm</span>
          : <button onClick={onPay} disabled={busy} className="rounded-full bg-indigo-500 px-2.5 py-0.5 text-[10px] font-bold text-white active:bg-indigo-600 disabled:opacity-50">I&apos;ve paid</button>
        )}
        {b.status === "BOOKED" && upcoming && <button onClick={onCancel} disabled={busy} className="ml-auto text-[10px] font-bold text-red-300">Cancel</button>}
      </div>
    </div>
  );
}

function OwnerRow({ b, busy, onOpen, onConfirm, onCancel }: { b: OwnerBooking; busy: boolean; onOpen: () => void; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className={`rounded-2xl border border-slate-700 bg-slate-800/60 p-3 ${b.status === "CANCELLED" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="text-left text-sm font-semibold text-white active:underline">{b.slotLabel}</button>
        <span className="text-sm font-bold tabular-nums text-white">{b.mode === "MONTHLY" ? `₹${b.monthlyRate}/mo` : `₹${b.totalAmount}`}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">{bookingDates(b)}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">{b.booker.name} · B{b.booker.block ?? "—"}, {b.booker.flatNumber}{b.vehicleNumber ? ` · ${b.vehicleNumber}` : ""}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusPill status={b.status} />
        {b.status === "BOOKED" && (
          b.ownerConfirmedPaid ? <span className="text-[10px] font-bold text-emerald-300">Payment confirmed</span>
          : <button onClick={onConfirm} disabled={busy} className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white active:bg-emerald-600 disabled:opacity-50">{b.bookerPaid ? "Confirm payment" : "Mark received"}</button>
        )}
        {b.status === "BOOKED" && <button onClick={onCancel} disabled={busy} className="ml-auto text-[10px] font-bold text-red-300">Cancel</button>}
      </div>
    </div>
  );
}

function Badge({ color, children }: { color: "green" | "amber" | "slate" | "purple"; children: React.ReactNode }) {
  const cls =
    color === "green" ? "text-emerald-300 bg-emerald-500/20"
    : color === "amber" ? "text-amber-200 bg-amber-500/20"
    : color === "purple" ? "text-purple-200 bg-purple-500/20"
    : "text-slate-300 bg-slate-700";
  return <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${cls}`}>{children}</span>;
}
function StatusPill({ status }: { status: string }) {
  const cls = status === "CANCELLED" ? "bg-red-500/20 text-red-300" : status === "COMPLETED" ? "bg-slate-700 text-slate-300" : "bg-emerald-500/20 text-emerald-300";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{status === "BOOKED" ? "BOOKED" : status}</span>;
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
      <Clock size={26} className="mx-auto mb-2 text-slate-600" />
      {text}
    </div>
  );
}
function fmtRange(startIso: string, endIso: string): string {
  const s = new Date(startIso), e = new Date(endIso);
  const sameDay = s.toDateString() === e.toDateString();
  const d = s.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const st = s.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const et = e.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return sameDay ? `${d}, ${st} – ${et}` : `${d} ${st} → ${e.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${et}`;
}
// Date label for a booking row — hourly shows the time range, monthly the dates.
function bookingDates(b: { mode?: string; openEnded?: boolean; startAt: string; endAt: string }): string {
  if (b.mode === "MONTHLY") {
    const from = new Date(b.startAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    if (b.openEnded) return `Monthly · from ${from} · ongoing`;
    const to = new Date(new Date(b.endAt).getTime() - 86_400_000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return `Monthly · ${from} → ${to}`;
  }
  return fmtRange(b.startAt, b.endAt);
}
