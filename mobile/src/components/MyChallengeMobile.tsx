import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import Icon from "./Icon";
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
  if (!data || (!data.registered && !data.incomingInvite)) return null;

  return (
    <div className="mt-3.5 flex flex-col gap-3.5">
      {data.incomingInvite && (
        <div className="rounded-[18px] p-4" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent)" }}>
          <p className="text-[14px]" style={{ color: "var(--text)" }}>
            <span className="font-bold">{data.incomingInvite.from.name}</span> asked you to be their partner.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => void respond("accept")} className="inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-bold text-white" style={{ background: "var(--accent-strong)" }}>
              <Icon name="check" size={14} /> Accept
            </button>
            <button onClick={() => void respond("decline")} className="inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold" style={{ border: "1px solid var(--border-strong)", color: "var(--text-2)" }}>
              <Icon name="close" size={14} /> Decline
            </button>
          </div>
        </div>
      )}

      {data.registered && (<>
        {/* Running goals */}
        <div className="rounded-[18px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <Icon name="directions_walk" size={21} style={{ color: "var(--success)" }} />
            <span className="text-[18px] font-bold" style={{ color: "var(--text)" }}>Running goals</span>
            <span className="text-[13px]" style={{ color: "var(--text-3)" }}>optional</span>
          </div>
          <div className="mt-4 flex flex-col gap-3.5">
            {DISTANCES.map((d) => (
              <div key={d.key} className="flex items-center gap-3">
                <span className="w-[34px] flex-shrink-0 text-[16px] font-bold" style={{ color: "var(--text)" }}>{d.label}</span>
                <NumBox value={runs[d.done] ?? 0} onChange={(v) => setRun(d.done, v)} label="DONE" />
                <span className="text-[18px] font-medium" style={{ color: "var(--text-3)" }}>/</span>
                <NumBox value={runs[d.goal] ?? 0} onChange={(v) => setRun(d.goal, v)} label="GOAL" />
              </div>
            ))}
          </div>
        </div>

        {/* Accountability partner */}
        <div className="rounded-[18px] p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5">
            <Icon name="person_add" size={21} style={{ color: "var(--accent)" }} />
            <span className="text-[18px] font-bold" style={{ color: "var(--text)" }}>Accountability partner</span>
            <span className="text-[13px]" style={{ color: "var(--text-3)" }}>optional</span>
          </div>
          {partner ? (
            <div className="mt-3.5 flex items-center justify-between rounded-[12px] px-3.5 py-2.5" style={{ background: "var(--surface-2)" }}>
              <span className="text-[14px]" style={{ color: "var(--text)" }}>
                {partner.name} <span className="text-[12px]" style={{ color: "var(--text-3)" }}>B{partner.block ?? "—"}-{partner.flatNumber}</span>
                {partner.status && partner.status !== "none" && (
                  <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>{partner.status}</span>
                )}
              </span>
              <button onClick={() => { setPartner(null); setPicking(false); }} style={{ color: "var(--text-3)" }}>
                <Icon name="close" size={18} />
              </button>
            </div>
          ) : picking ? (
            <div className="mt-3.5">
              <input
                autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / flat…"
                className="w-full rounded-[11px] px-3.5 py-2.5 text-[14px] outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", color: "var(--text)" }}
              />
              <div className="mt-1.5 max-h-44 overflow-y-auto">
                {results.map((rsd) => (
                  <button
                    key={rsd.id}
                    onClick={() => { setPartner({ ...rsd, status: "pending" }); setPicking(false); setSearch(""); setResults([]); }}
                    className="flex w-full items-center justify-between rounded-[8px] px-2.5 py-2 text-left text-[14px] active:opacity-70"
                  >
                    <span style={{ color: "var(--text)" }}>{rsd.name}</span>
                    <span className="text-[12px]" style={{ color: "var(--text-3)" }}>B{rsd.block ?? "—"}-{rsd.flatNumber}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button onClick={() => setPicking(true)} className="mt-3.5 inline-flex items-center gap-2 rounded-[11px] px-4 py-2.5 text-[14px] font-semibold" style={{ border: "1px solid var(--border-strong)", color: "var(--text)" }}>
              <Icon name="person_add" size={19} /> Choose a partner
            </button>
          )}
        </div>

        <button
          onClick={() => void save()} disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-[14px] py-4 text-[17px] font-bold text-white disabled:opacity-60"
          style={{ background: "var(--accent-strong)", boxShadow: "0 8px 20px var(--accent-soft)" }}
        >
          {saving && <Loader2 size={17} className="animate-spin" />} Save my goals
        </button>
      </>)}
    </div>
  );
}

function NumBox({ value, onChange, label }: { value: number; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <input
        inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="w-full rounded-[10px] py-2.5 text-center text-[17px] font-bold outline-none"
        style={{ background: "transparent", border: "1px solid var(--border-strong)", color: "var(--text)" }}
      />
      <span className="one-mono text-[9.5px] font-semibold" style={{ color: "var(--text-3)", letterSpacing: "0.1em" }}>{label}</span>
    </div>
  );
}
