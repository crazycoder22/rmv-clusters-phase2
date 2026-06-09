"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Footprints, Loader2, UserPlus, X } from "lucide-react";

type Partner = { id: string; name: string; block: number | null; flatNumber: string; status?: string };
type ChallengeData = {
  registered: boolean;
  goal: {
    run5kGoal: number;
    run10kGoal: number;
    run20kGoal: number;
    run5kDone: number;
    run10kDone: number;
    run20kDone: number;
    partner: Partner | null;
  } | null;
  incomingInvite: { goalId: string; from: { id: string; name: string; block: number | null; flatNumber: string } } | null;
};

const DISTANCES = [
  { key: "5k", label: "5K runs", goal: "run5kGoal", done: "run5kDone" },
  { key: "10k", label: "10K runs", goal: "run10kGoal", done: "run10kDone" },
  { key: "20k", label: "20K runs", goal: "run20kGoal", done: "run20kDone" },
] as const;

type Runs = Record<string, number>;

export default function MyChallenge({ eventId }: { eventId: string }) {
  const [data, setData] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runs, setRuns] = useState<Runs>({});
  const [partner, setPartner] = useState<Partner | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Partner[]>([]);
  const [picking, setPicking] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/events/${eventId}/challenge`);
    if (r.ok) {
      const d: ChallengeData = await r.json();
      setData(d);
      if (d.goal) {
        setRuns({
          run5kGoal: d.goal.run5kGoal, run5kDone: d.goal.run5kDone,
          run10kGoal: d.goal.run10kGoal, run10kDone: d.goal.run10kDone,
          run20kGoal: d.goal.run20kGoal, run20kDone: d.goal.run20kDone,
        });
        setPartner(d.goal.partner ?? null);
      }
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  // Partner search (debounced)
  useEffect(() => {
    if (!picking) return;
    if (debounce.current) clearTimeout(debounce.current);
    if (search.trim().length < 1) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      const r = await fetch(`/api/residents/search?q=${encodeURIComponent(search.trim())}`);
      if (r.ok) setResults((await r.json()).residents ?? []);
    }, 250);
  }, [search, picking]);

  const setRun = (k: string, v: string) =>
    setRuns((p) => ({ ...p, [k]: Math.max(0, Math.min(999, parseInt(v, 10) || 0)) }));

  async function save() {
    setSaving(true);
    try {
      const r = await fetch(`/api/events/${eventId}/challenge`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...runs, partnerResidentId: partner?.id ?? null }),
      });
      if (r.ok) await load();
    } finally {
      setSaving(false);
    }
  }

  async function respondInvite(action: "accept" | "decline") {
    await fetch(`/api/events/${eventId}/challenge/partner-response`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await load();
  }

  if (loading) return null;
  if (!data?.registered) return null;

  const cardCls = "rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4";

  return (
    <div className="space-y-3 mt-5">
      {/* Incoming partner invite */}
      {data.incomingInvite && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4">
          <p className="text-sm text-gray-800 dark:text-gray-100">
            <span className="font-semibold">{data.incomingInvite.from.name}</span> asked you to be their accountability partner.
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => void respondInvite("accept")} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"><Check size={13} /> Accept</button>
            <button onClick={() => void respondInvite("decline")} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300"><X size={13} /> Decline</button>
          </div>
        </div>
      )}

      {/* Run goals */}
      <div className={cardCls}>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100"><Footprints size={15} className="text-emerald-500" /> Running goals <span className="text-xs font-normal text-gray-400">(optional)</span></h3>
        <p className="mt-0.5 text-[11px] text-gray-500">Set a target and self-declare completed runs on trust.</p>
        <div className="mt-3 space-y-2">
          {DISTANCES.map((d) => (
            <div key={d.key} className="flex items-center gap-2">
              <span className="w-20 text-sm text-gray-700 dark:text-gray-200">{d.label}</span>
              <NumBox label="done" value={runs[d.done] ?? 0} onChange={(v) => setRun(d.done, v)} />
              <span className="text-gray-400">/</span>
              <NumBox label="goal" value={runs[d.goal] ?? 0} onChange={(v) => setRun(d.goal, v)} />
            </div>
          ))}
        </div>
      </div>

      {/* Accountability partner */}
      <div className={cardCls}>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100"><UserPlus size={15} className="text-indigo-500" /> Accountability partner <span className="text-xs font-normal text-gray-400">(optional)</span></h3>
        {partner ? (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2">
            <span className="text-sm text-gray-800 dark:text-gray-100">
              {partner.name} <span className="text-xs text-gray-400">B{partner.block ?? "—"}-{partner.flatNumber}</span>
              {partner.status && partner.status !== "none" && (
                <span className={"ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium " + (partner.status === "accepted" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : partner.status === "declined" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300")}>{partner.status}</span>
              )}
            </span>
            <button onClick={() => { setPartner(null); setPicking(false); }} className="text-gray-400 hover:text-red-500"><X size={16} /></button>
          </div>
        ) : picking ? (
          <div className="mt-2">
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / flat…" className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
            <div className="mt-1 max-h-44 overflow-y-auto">
              {results.map((rsd) => (
                <button key={rsd.id} onClick={() => { setPartner({ ...rsd, status: "pending" }); setPicking(false); setSearch(""); setResults([]); }} className="flex w-full items-center justify-between px-2 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                  <span className="text-gray-800 dark:text-gray-100">{rsd.name}</span>
                  <span className="text-xs text-gray-400">B{rsd.block ?? "—"}-{rsd.flatNumber}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button onClick={() => setPicking(true)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300"><UserPlus size={13} /> Choose a partner</button>
        )}
        <p className="mt-2 text-[11px] text-gray-400">Your partner gets a request to confirm. They&apos;ll see your progress so you can keep each other on track.</p>
      </div>

      <button onClick={() => void save()} disabled={saving} className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60 inline-flex items-center justify-center gap-2">
        {saving && <Loader2 size={15} className="animate-spin" />} Save my goals
      </button>
    </div>
  );
}

function NumBox({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col items-center">
      <input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} className="w-14 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-center text-sm text-gray-900 dark:text-gray-100" />
      <span className="text-[9px] uppercase tracking-wider text-gray-400">{label}</span>
    </div>
  );
}
