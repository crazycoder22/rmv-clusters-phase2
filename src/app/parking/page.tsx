"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Car, Plus, MapPin, Clock, CheckCircle2, IndianRupee } from "lucide-react";

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
  slotLocation: string | null;
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

type Tab = "find" | "slots" | "bookings";

export default function ParkingPage() {
  const { status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("find");

  const [browse, setBrowse] = useState<SlotCard[]>([]);
  const [mine, setMine] = useState<SlotCard[]>([]);
  const [asBooker, setAsBooker] = useState<BookerBooking[]>([]);
  const [asOwner, setAsOwner] = useState<OwnerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [b, m, bk] = await Promise.all([
        fetch("/api/parking/slots"),
        fetch("/api/parking/slots?mine=owner"),
        fetch("/api/parking/bookings"),
      ]);
      if (b.ok) setBrowse((await b.json()).slots ?? []);
      if (m.ok) setMine((await m.json()).slots ?? []);
      if (bk.ok) {
        const d = await bk.json();
        setAsBooker(d.asBooker ?? []);
        setAsOwner(d.asOwner ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function patchBooking(bookingId: string, action: string) {
    setBusyId(bookingId);
    try {
      const res = await fetch(`/api/parking/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) await refresh();
      else alert((await res.json().catch(() => null))?.error ?? "Could not update");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Car className="text-blue-600" /> Parking
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Book a neighbour&apos;s slot by the hour</p>
          </div>
          {tab === "slots" && (
            <Link
              href="/parking/slots/new"
              className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} /> List a slot
            </Link>
          )}
        </div>

        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          <TabBtn active={tab === "find"} onClick={() => setTab("find")} icon={Car}>Find parking</TabBtn>
          <TabBtn active={tab === "slots"} onClick={() => setTab("slots")} icon={MapPin}>My slots</TabBtn>
          <TabBtn active={tab === "bookings"} onClick={() => setTab("bookings")} icon={Clock}>My bookings</TabBtn>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            {tab === "find" &&
              (browse.length === 0 ? (
                <Empty icon={Car} text="No slots listed right now. Check back later." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {browse.map((s) => <SlotCardView key={s.id} slot={s} />)}
                </div>
              ))}

            {tab === "slots" &&
              (mine.length === 0 ? (
                <Empty icon={MapPin} text="You haven't listed a slot yet. Tap “List a slot” to share yours." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {mine.map((s) => <SlotCardView key={s.id} slot={s} ownerView />)}
                </div>
              ))}

            {tab === "bookings" && (
              <div className="space-y-8">
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Slots I booked</h2>
                  {asBooker.length === 0 ? (
                    <Empty icon={Clock} text="No bookings yet. Find a slot to get started." />
                  ) : (
                    <div className="space-y-3">
                      {asBooker.map((b) => (
                        <BookerCard key={b.id} b={b} busy={busyId === b.id}
                          onPay={() => patchBooking(b.id, "claim_paid")}
                          onCancel={() => patchBooking(b.id, "cancel")} />
                      ))}
                    </div>
                  )}
                </section>

                {asOwner.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Bookings on my slots</h2>
                    <div className="space-y-3">
                      {asOwner.map((b) => (
                        <OwnerCard key={b.id} b={b} busy={busyId === b.id}
                          onConfirm={() => patchBooking(b.id, "confirm_paid")}
                          onCancel={() => patchBooking(b.id, "cancel")} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof Car; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition ${active ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
      <Icon size={15} />{children}
    </button>
  );
}

function SlotCardView({ slot, ownerView }: { slot: SlotCard; ownerView?: boolean }) {
  return (
    <Link href={`/parking/${slot.id}`} className="block bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{slot.label}</h3>
        {ownerView ? (
          <span className={`shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 ${slot.active ? "text-green-700 bg-green-100" : "text-gray-600 bg-gray-100"}`}>
            {slot.active ? "Listed" : "Paused"}
          </span>
        ) : slot.busyNow ? (
          <span className="shrink-0 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">Busy now</span>
        ) : (
          <span className="shrink-0 text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5">Free</span>
        )}
      </div>
      {slot.location && <p className="text-sm text-gray-500 mt-1 inline-flex items-center gap-1"><MapPin size={12} /> {slot.location}</p>}
      <div className="flex items-center gap-3 mt-2 text-sm">
        <span className="inline-flex items-center font-semibold text-gray-900"><IndianRupee size={13} />{slot.hourlyRate}/hr</span>
        {!ownerView && <span className="text-xs text-gray-400">by {slot.owner.name} · Block {slot.owner.block ?? "—"}</span>}
        {ownerView && slot.upcomingCount > 0 && <span className="text-xs text-blue-600 font-medium">{slot.upcomingCount} upcoming</span>}
      </div>
    </Link>
  );
}

function BookerCard({ b, busy, onPay, onCancel }: { b: BookerBooking; busy: boolean; onPay: () => void; onCancel: () => void }) {
  const upcoming = new Date(b.startAt).getTime() > Date.now();
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${b.status === "CANCELLED" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/parking/${b.slotId}`} className="font-semibold text-gray-900 hover:underline">{b.slotLabel}</Link>
        <span className="font-bold text-gray-900">₹{b.totalAmount}</span>
      </div>
      <p className="text-sm text-gray-500 mt-0.5">{fmtRange(b.startAt, b.endAt)}</p>
      {b.vehicleNumber && <p className="text-xs text-gray-400 mt-0.5">Vehicle {b.vehicleNumber}</p>}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <StatusPill status={b.status} />
        {b.status === "BOOKED" && (
          b.ownerConfirmedPaid ? <span className="text-xs font-semibold text-green-600">Paid ✓ confirmed</span>
          : b.bookerPaid ? <span className="text-xs font-semibold text-amber-600">Paid — awaiting confirm</span>
          : <button type="button" onClick={onPay} disabled={busy} className="text-xs font-semibold bg-blue-600 text-white rounded-md px-3 py-1 hover:bg-blue-700 disabled:opacity-50">I&apos;ve paid</button>
        )}
        {b.status === "BOOKED" && upcoming && (
          <button type="button" onClick={onCancel} disabled={busy} className="text-xs font-semibold text-red-600 hover:underline ml-auto">Cancel</button>
        )}
      </div>
    </div>
  );
}

function OwnerCard({ b, busy, onConfirm, onCancel }: { b: OwnerBooking; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${b.status === "CANCELLED" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/parking/${b.slotId}`} className="font-semibold text-gray-900 hover:underline">{b.slotLabel}</Link>
        <span className="font-bold text-gray-900">₹{b.totalAmount}</span>
      </div>
      <p className="text-sm text-gray-500 mt-0.5">{fmtRange(b.startAt, b.endAt)}</p>
      <p className="text-xs text-gray-400 mt-0.5">{b.booker.name} · Block {b.booker.block ?? "—"}, {b.booker.flatNumber}{b.vehicleNumber ? ` · ${b.vehicleNumber}` : ""}</p>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <StatusPill status={b.status} />
        {b.status === "BOOKED" && (
          b.ownerConfirmedPaid ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600"><CheckCircle2 size={13} /> Payment confirmed</span>
          : <button type="button" onClick={onConfirm} disabled={busy} className="text-xs font-semibold bg-green-600 text-white rounded-md px-3 py-1 hover:bg-green-700 disabled:opacity-50">{b.bookerPaid ? "Confirm payment" : "Mark received"}</button>
        )}
        {b.status === "BOOKED" && (
          <button type="button" onClick={onCancel} disabled={busy} className="text-xs font-semibold text-red-600 hover:underline ml-auto">Cancel</button>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = status === "CANCELLED" ? "text-red-700 bg-red-100" : status === "COMPLETED" ? "text-gray-600 bg-gray-100" : "text-green-700 bg-green-100";
  return <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${cls}`}>{status === "BOOKED" ? "Booked" : status === "CANCELLED" ? "Cancelled" : "Done"}</span>;
}

function Empty({ icon: Icon, text }: { icon: typeof Car; text: string }) {
  return (
    <div className="bg-white rounded-lg border border-dashed border-gray-300 py-16 text-center text-gray-500">
      <Icon size={32} className="mx-auto mb-2 text-gray-300" />
      <p className="text-sm">{text}</p>
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
