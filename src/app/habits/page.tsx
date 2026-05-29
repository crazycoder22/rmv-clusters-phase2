"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Target,
  Flame,
  Bell,
  Plus,
  Check,
  X,
  Search,
  ChevronRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface OwnedHabit {
  id: string;
  title: string;
  emoji: string | null;
  startDate: string;
  endDate: string;
  active: boolean;
  todayDone: boolean;
  currentStreak: number;
  completionPct: number;
  partner: { id: string; name: string; status: string } | null;
}
interface PartnerHabit {
  id: string;
  title: string;
  emoji: string | null;
  todayDone: boolean;
  currentStreak: number;
  owner: { name: string; block: number; flatNumber: string };
  canNudge: boolean;
}
interface Invite {
  id: string;
  title: string;
  emoji: string | null;
  ownerName: string;
  ownerBlock: number;
  ownerFlat: string;
}
interface ResidentHit {
  id: string;
  name: string;
  block: number | null;
  flatNumber: string;
}

export default function HabitsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [owned, setOwned] = useState<OwnedHabit[]>([]);
  const [partnering, setPartnering] = useState<PartnerHabit[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/habits");
      if (res.ok) {
        const d = await res.json();
        setOwned(d.owned ?? []);
        setPartnering(d.partnering ?? []);
        setInvites(d.invites ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function api(path: string, method: string, body?: unknown) {
    return fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async function toggleToday(h: OwnedHabit) {
    setBusyId(h.id);
    try {
      const res = h.todayDone
        ? await api(`/api/habits/${h.id}/checkin`, "DELETE")
        : await api(`/api/habits/${h.id}/checkin`, "POST", {});
      if (res.ok) await refresh();
    } finally {
      setBusyId(null);
    }
  }
  async function respondInvite(id: string, action: "accept" | "decline") {
    setBusyId(id);
    try {
      const res = await api(`/api/habits/${id}/partner-response`, "POST", { action });
      if (res.ok) await refresh();
    } finally {
      setBusyId(null);
    }
  }
  async function nudge(id: string) {
    setBusyId(id);
    try {
      const res = await api(`/api/habits/${id}/nudge`, "POST");
      if (res.ok || res.status === 429)
        setPartnering((p) => p.map((x) => (x.id === id ? { ...x, canNudge: false } : x)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Target className="text-blue-600" /> Habits
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Build routines, stay accountable</p>
          </div>
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium ${
              showNew ? "bg-gray-100 text-gray-700" : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {showNew ? <X size={16} /> : <Plus size={16} />}
            {showNew ? "Close" : "New habit"}
          </button>
        </div>

        {showNew && <NewHabitForm onCreated={async () => { setShowNew(false); await refresh(); }} />}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Invites */}
            {invites.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Bell size={13} /> Partner invites
                </h2>
                <div className="space-y-2">
                  {invites.map((inv) => (
                    <div key={inv.id} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm text-gray-800">
                        <strong>{inv.ownerName}</strong> (Block {inv.ownerBlock}, {inv.ownerFlat}) wants you as their accountability partner for{" "}
                        <strong>{inv.emoji ? `${inv.emoji} ` : ""}{inv.title}</strong>
                      </p>
                      <div className="flex gap-2 mt-3">
                        <button type="button" onClick={() => respondInvite(inv.id, "accept")} disabled={busyId === inv.id} className="flex-1 inline-flex items-center justify-center gap-1 bg-green-600 text-white rounded-md py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"><Check size={14} /> Accept</button>
                        <button type="button" onClick={() => respondInvite(inv.id, "decline")} disabled={busyId === inv.id} className="flex-1 inline-flex items-center justify-center gap-1 border border-gray-300 text-gray-700 rounded-md py-2 text-sm font-medium hover:bg-gray-50"><X size={14} /> Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* My habits */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">My habits</h2>
              {owned.length === 0 ? (
                <div className="bg-white border border-dashed border-gray-300 rounded-lg py-12 text-center text-gray-500">
                  <Target size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No habits yet. Click “New habit” to start one.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {owned.map((h) => (
                    <div key={h.id} className={`flex items-center gap-3 bg-white border rounded-lg p-4 ${h.todayDone ? "border-green-300" : "border-gray-200"}`}>
                      <button
                        type="button"
                        onClick={() => toggleToday(h)}
                        disabled={busyId === h.id}
                        className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center ${h.todayDone ? "bg-green-600 text-white hover:bg-green-700" : "border-2 border-gray-300 text-gray-400 hover:bg-gray-50"}`}
                        title={h.todayDone ? "Mark not done" : "Mark done today"}
                      >
                        {h.todayDone ? <Check size={20} /> : <span className="block h-4 w-4 rounded-full" />}
                      </button>
                      <Link href={`/habits/${h.id}`} className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{h.emoji ? `${h.emoji} ` : ""}{h.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-orange-600"><Flame size={12} /> {h.currentStreak}d streak</span>
                          <span>·</span><span>{h.completionPct}%</span>
                          {h.partner && (<><span>·</span><span>{h.partner.status === "accepted" ? h.partner.name : h.partner.status === "pending" ? "invite sent" : ""}</span></>)}
                        </p>
                      </Link>
                      <Link href={`/habits/${h.id}`}><ChevronRight size={18} className="text-gray-400" /></Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Partnering */}
            {partnering.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Keeping accountable</h2>
                <div className="space-y-2">
                  {partnering.map((h) => (
                    <div key={h.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-4">
                      <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-lg">{h.emoji ?? "🎯"}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{h.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{h.owner.name} · <span className="text-orange-600">{h.currentStreak}d</span> · <span className={h.todayDone ? "text-green-600" : "text-gray-400"}>{h.todayDone ? "done today" : "not yet today"}</span></p>
                      </div>
                      <button type="button" onClick={() => nudge(h.id)} disabled={busyId === h.id || !h.canNudge} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${h.canNudge ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-400"}`}><Bell size={12} /> {h.canNudge ? "Nudge" : "Sent"}</button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── New habit form ──────────────────────────────────────────────────────────

function NewHabitForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("");
  const [targetMinutes, setTargetMinutes] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(addDays(todayIso(), 30));
  const [partner, setPartner] = useState<ResidentHit | null>(null);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<ResidentHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (partner) { setHits([]); return; }
    if (debounce.current) clearTimeout(debounce.current);
    const q = search.trim();
    if (q.length < 2) { setHits([]); return; }
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/residents/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setHits(((await res.json()).residents ?? []).slice(0, 10));
    }, 250);
  }, [search, partner]);

  async function submit() {
    setErr(null);
    if (!title.trim()) { setErr("Give your habit a name"); return; }
    if (endDate < startDate) { setErr("End date must be after start date"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          emoji: emoji.trim() || null,
          targetMinutes: targetMinutes ? parseInt(targetMinutes, 10) : null,
          startDate, endDate,
          partnerResidentId: partner?.id ?? null,
        }),
      });
      if (!res.ok) { setErr((await res.json().catch(() => null))?.error ?? "Could not create"); return; }
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-blue-200 rounded-lg p-5 mb-6 space-y-4">
      <div className="grid grid-cols-[80px,1fr] gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
          <input value={emoji} onChange={(e) => setEmoji(Array.from(e.target.value).slice(0, 2).join(""))} placeholder="🧘" className={`${inputCls} text-center text-lg`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Habit</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Yoga every morning" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Start</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">End</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} /></div>
        <div><label className="block text-sm font-medium text-gray-700 mb-1">Mins/day</label><input type="number" value={targetMinutes} onChange={(e) => setTargetMinutes(e.target.value)} placeholder="10" className={inputCls} /></div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Accountability partner (optional)</label>
        {partner ? (
          <div className="flex items-center justify-between border border-green-200 bg-green-50 rounded-lg px-3 py-2">
            <span className="text-sm text-gray-800">{partner.name} <span className="text-xs text-gray-500">Block {partner.block ?? "—"}, {partner.flatNumber}</span></span>
            <button type="button" onClick={() => { setPartner(null); setSearch(""); }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3">
              <Search size={15} className="text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a resident to invite…" className="flex-1 py-2 text-sm focus:outline-none" />
            </div>
            {hits.length > 0 && (
              <div className="mt-1.5 border border-gray-200 rounded-lg divide-y max-h-48 overflow-y-auto">
                {hits.map((hit) => (
                  <button key={hit.id} type="button" onClick={() => setPartner(hit)} className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50">
                    <span>{hit.name}</span><span className="text-xs text-gray-400">Block {hit.block ?? "—"}, {hit.flatNumber}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <p className="text-xs text-gray-400 mt-1">They get a request and can see your progress once they accept.</p>
      </div>
      {err && <p className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{err}</p>}
      <button type="button" onClick={submit} disabled={busy} className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50">{busy ? "Creating…" : "Create habit"}</button>
    </div>
  );
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
function todayIso(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function addDays(iso: string, n: number): string { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
