import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Car, Plus, MapPin, Clock, IndianRupee } from "lucide-react";

type Tab = "find" | "slots" | "bookings";

interface SlotCard {
  id: string;
  label: string;
  location: string | null;
  description: string | null;
  hourlyRate: number;
  active: boolean;
  hasPayInfo: boolean;
  owner: { id: string; name: string; block: number | null; flatNumber: string; isMe: boolean };
  busyNow: boolean;
  busyUntil: string | null;
  upcomingCount: number;
}
interface BookerBooking {
  id: string;
  slotId: string;
  slotLabel: string;
  startAt: string;
  endAt: string;
  status: "BOOKED" | "CANCELLED" | "COMPLETED";
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
  vehicleNumber: string | null;
  totalAmount: number;
  bookerPaid: boolean;
  ownerConfirmedPaid: boolean;
  booker: { name: string; block: number | null; flatNumber: string };
}

export default function Parking() {
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
        api<{ slots: SlotCard[] }>("/api/parking/slots"),
        api<{ slots: SlotCard[] }>("/api/parking/slots?mine=owner"),
        api<{ asBooker: BookerBooking[]; asOwner: OwnerBooking[] }>("/api/parking/bookings"),
      ]);
      setBrowse(b.slots || []);
      setMine(m.slots || []);
      setAsBooker(bk.asBooker || []);
      setAsOwner(bk.asOwner || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function patchBooking(id: string, action: string) {
    setBusyId(id);
    try {
      await api(`/api/parking/bookings/${id}`, { method: "PATCH", body: { action } });
      await refresh();
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <div className="px-4 padding-safe-top">
        <div className="flex items-center justify-between pt-4 pb-4">
          <div className="flex items-center gap-2">
            <Car className="text-blue-400" size={24} />
            <h1 className="text-xl font-bold">Parking</h1>
          </div>
          {tab === "slots" && (
            <button
              onClick={() => navigate("/parking/slots/new")}
              className="flex items-center gap-1 bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm font-medium"
            >
              <Plus size={15} /> List
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 mb-4">
          <TabBtn active={tab === "find"} onClick={() => setTab("find")}>Find</TabBtn>
          <TabBtn active={tab === "slots"} onClick={() => setTab("slots")}>My slots</TabBtn>
          <TabBtn active={tab === "bookings"} onClick={() => setTab("bookings")}>My bookings</TabBtn>
        </div>
      </div>

      <div className="px-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-400" />
          </div>
        ) : (
          <>
            {tab === "find" &&
              (browse.length === 0 ? (
                <Empty text="No slots listed right now. Check back later." />
              ) : (
                <div className="space-y-3">
                  {browse.map((s) => <SlotRow key={s.id} slot={s} onClick={() => navigate(`/parking/${s.id}`)} />)}
                </div>
              ))}

            {tab === "slots" &&
              (mine.length === 0 ? (
                <Empty text="You haven't listed a slot yet. Tap “List” to share yours." />
              ) : (
                <div className="space-y-3">
                  {mine.map((s) => <SlotRow key={s.id} slot={s} ownerView onClick={() => navigate(`/parking/${s.id}`)} />)}
                </div>
              ))}

            {tab === "bookings" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Slots I booked</h2>
                  {asBooker.length === 0 ? (
                    <Empty text="No bookings yet." />
                  ) : (
                    <div className="space-y-3">
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
                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Bookings on my slots</h2>
                    <div className="space-y-3">
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
          </>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex-1 rounded-md py-2 text-sm font-medium ${active ? "bg-blue-600 text-white" : "text-slate-400"}`}>
      {children}
    </button>
  );
}

function SlotRow({ slot, ownerView, onClick }: { slot: SlotCard; ownerView?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{slot.label}</h3>
        {ownerView ? (
          <Badge color={slot.active ? "green" : "slate"}>{slot.active ? "Listed" : "Paused"}</Badge>
        ) : slot.busyNow ? (
          <Badge color="amber">Busy now</Badge>
        ) : (
          <Badge color="green">Free</Badge>
        )}
      </div>
      {slot.location && <p className="text-sm text-slate-400 mt-1 flex items-center gap-1"><MapPin size={12} /> {slot.location}</p>}
      <div className="flex items-center gap-3 mt-2 text-sm">
        <span className="flex items-center font-semibold"><IndianRupee size={13} />{slot.hourlyRate}/hr</span>
        {!ownerView && <span className="text-xs text-slate-500">{slot.owner.name} · Block {slot.owner.block ?? "—"}</span>}
        {ownerView && slot.upcomingCount > 0 && <span className="text-xs text-blue-400">{slot.upcomingCount} upcoming</span>}
      </div>
    </button>
  );
}

function BookerRow({ b, busy, onOpen, onPay, onCancel }: { b: BookerBooking; busy: boolean; onOpen: () => void; onPay: () => void; onCancel: () => void }) {
  const upcoming = new Date(b.startAt).getTime() > Date.now();
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-4 ${b.status === "CANCELLED" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="font-semibold text-left">{b.slotLabel}</button>
        <span className="font-bold">₹{b.totalAmount}</span>
      </div>
      <p className="text-sm text-slate-400 mt-0.5">{fmtRange(b.startAt, b.endAt)}</p>
      {b.vehicleNumber && <p className="text-xs text-slate-500 mt-0.5">{b.vehicleNumber}</p>}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <StatusPill status={b.status} />
        {b.status === "BOOKED" && (
          b.ownerConfirmedPaid ? <span className="text-xs font-semibold text-green-400">Paid ✓ confirmed</span>
          : b.bookerPaid ? <span className="text-xs font-semibold text-amber-400">Paid — awaiting confirm</span>
          : <button onClick={onPay} disabled={busy} className="text-xs font-semibold bg-blue-600 text-white rounded-md px-3 py-1">I&apos;ve paid</button>
        )}
        {b.status === "BOOKED" && upcoming && (
          <button onClick={onCancel} disabled={busy} className="text-xs font-semibold text-red-400 ml-auto">Cancel</button>
        )}
      </div>
    </div>
  );
}

function OwnerRow({ b, busy, onOpen, onConfirm, onCancel }: { b: OwnerBooking; busy: boolean; onOpen: () => void; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-4 ${b.status === "CANCELLED" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="font-semibold text-left">{b.slotLabel}</button>
        <span className="font-bold">₹{b.totalAmount}</span>
      </div>
      <p className="text-sm text-slate-400 mt-0.5">{fmtRange(b.startAt, b.endAt)}</p>
      <p className="text-xs text-slate-500 mt-0.5">{b.booker.name} · Block {b.booker.block ?? "—"}, {b.booker.flatNumber}{b.vehicleNumber ? ` · ${b.vehicleNumber}` : ""}</p>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <StatusPill status={b.status} />
        {b.status === "BOOKED" && (
          b.ownerConfirmedPaid ? <span className="text-xs font-semibold text-green-400">Payment confirmed</span>
          : <button onClick={onConfirm} disabled={busy} className="text-xs font-semibold bg-green-600 text-white rounded-md px-3 py-1">{b.bookerPaid ? "Confirm payment" : "Mark received"}</button>
        )}
        {b.status === "BOOKED" && <button onClick={onCancel} disabled={busy} className="text-xs font-semibold text-red-400 ml-auto">Cancel</button>}
      </div>
    </div>
  );
}

function Badge({ color, children }: { color: "green" | "amber" | "slate"; children: React.ReactNode }) {
  const cls = color === "green" ? "text-green-300 bg-green-500/15" : color === "amber" ? "text-amber-300 bg-amber-500/15" : "text-slate-300 bg-slate-700/40";
  return <span className={`shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 ${cls}`}>{children}</span>;
}
function StatusPill({ status }: { status: string }) {
  const cls = status === "CANCELLED" ? "text-red-300 bg-red-500/15" : status === "COMPLETED" ? "text-slate-300 bg-slate-700/40" : "text-green-300 bg-green-500/15";
  return <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${cls}`}>{status === "BOOKED" ? "Booked" : status === "CANCELLED" ? "Cancelled" : "Done"}</span>;
}
function Empty({ text }: { text: string }) {
  return (
    <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl py-12 text-center text-slate-500">
      <Clock size={28} className="mx-auto mb-2 text-slate-700" />
      <p className="text-sm px-6">{text}</p>
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
