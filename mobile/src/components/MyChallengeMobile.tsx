import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Footprints, Loader2, UserPlus, X } from "lucide-react";
import { apiFetch } from "../lib/api";

type Partner = { id: string; name: string; block: number | null; flatNumber: string; status?: string };
type ChallengeData = {
  registered: boolean;
  goal: {
    run5kGoal: number; run10kGoal: number; run20kGoal: number;
    run5kDone: number; run10kDone: number; run20kDone: number;
    partner: Partner | null;
  } | null;
  incomingInvite: { goalId: string; from: { id: string; name: string; block: number | null; flatNumber: string } } | null;
};

const DISTANCES = [
  { key: "5k", label: "5K", goal: "run5kGoal", done: "run5kDone" },
  { key: "10k", label: "10K", goal: "run10kGoal", done: "run10kDone" },
  { key: "20k", label: "20K", goal: "run20kGoal", done: "run20kDone" },
] as const;

export default function MyChallengeMobile({ eventId, token }: { eventId: string; token: string | null }) {
  const [data, setData] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runs, setRuns] = useState<Record<string, number>>({});
  const [partner, setPartner] = useState<Partner | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Partner[]>([]);
  const [picking, setPicking] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await apiFetch(`/api/events/${eventId}/challenge`, { token });
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
  }, [eventId, token]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!picking || !token) return;
    if (debounce.current) clearTimeout(debounce.current);
    if (search.trim().length < 1) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      const r = await apiFetch(`/api/residents/search?q=${encodeURIComponent(search.trim())}`, { token });
      if (r.ok) setResults((await r.json()).residents ?? []);
    }, 250);
  }, [search, picking, token]);

  const setRun = (k: string, v: string) =>
    setRuns((p) => ({ ...p, [k]: Math.max(0, Math.min(999, parseInt(v, 10) || 0)) }));

  async function save() {
    setSaving(true);
    try {
      const r = await apiFetch(`/api/events/${eventId}/challenge`, {
        method: "PUT", token,
        body: JSON.stringify({ ...runs, partnerResidentId: partner?.id ?? null }),
      });
      if (r.ok) await load();
    } finally { setSaving(false); }
  }

  async function respond(action: "accept" | "decline") {
    await apiFetch(`/api/events/${eventId}/challenge/partner-response`, {
      method: "POST", token, body: JSON.stringify({ action }),
    });
    await load();
  }

  if (loading) return null;
  // Render even when not registered, so a chosen partner who hasn't joined the
  // challenge yet still sees the invite and can accept/decline it.
  if (!data || (!data.registered && !data.incomingInvite)) return null;

  return (
    <section className="mb-3 space-y-2">
      {data.incomingInvite && (
        <div className="rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-3">
          <p className="text-sm text-slate-100"><span className="font-semibold">{data.incomingInvite.from.name}</span> asked you to be their partner.</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => void respond("accept")} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"><Check size={13} /> Accept</button>
            <button onClick={() => void respond("decline")} className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300"><X size={13} /> Decline</button>
          </div>
        </div>
      )}

      {data.registered && (<>
      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white"><Footprints size={15} className="text-emerald-400" /> Running goals <span className="text-[11px] font-normal text-slate-500">optional</span></h3>
        <div className="mt-2 space-y-2">
          {DISTANCES.map((d) => (
            <div key={d.key} className="flex items-center gap-2">
              <span className="w-12 text-sm text-slate-200">{d.label}</span>
              <NumBox value={runs[d.done] ?? 0} onChange={(v) => setRun(d.done, v)} label="done" />
              <span className="text-slate-500">/</span>
              <NumBox value={runs[d.goal] ?? 0} onChange={(v) => setRun(d.goal, v)} label="goal" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white"><UserPlus size={15} className="text-indigo-400" /> Accountability partner <span className="text-[11px] font-normal text-slate-500">optional</span></h3>
        {partner ? (
          <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2">
            <span className="text-sm text-slate-100">{partner.name} <span className="text-[11px] text-slate-500">B{partner.block ?? "—"}-{partner.flatNumber}</span>
              {partner.status && partner.status !== "none" && <span className="ml-2 rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px]">{partner.status}</span>}
            </span>
            <button onClick={() => { setPartner(null); setPicking(false); }} className="text-slate-400"><X size={16} /></button>
          </div>
        ) : picking ? (
          <div className="mt-2">
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / flat…" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" />
            <div className="mt-1 max-h-44 overflow-y-auto">
              {results.map((rsd) => (
                <button key={rsd.id} onClick={() => { setPartner({ ...rsd, status: "pending" }); setPicking(false); setSearch(""); setResults([]); }} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm active:bg-slate-700">
                  <span className="text-slate-100">{rsd.name}</span><span className="text-[11px] text-slate-500">B{rsd.block ?? "—"}-{rsd.flatNumber}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button onClick={() => setPicking(true)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300"><UserPlus size={13} /> Choose a partner</button>
        )}
      </div>

      <button onClick={() => void save()} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {saving && <Loader2 size={15} className="animate-spin" />} Save my goals
      </button>
      </>)}
    </section>
  );
}

function NumBox({ value, onChange, label }: { value: number; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} className="w-14 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-center text-sm text-white" />
      <span className="text-[9px] uppercase tracking-wider text-slate-500">{label}</span>
    </div>
  );
}
