import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Vote, Plus, Clock, Lock, CheckCircle2, Users, ArrowLeft } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageAnnouncements } from "../lib/roles";

interface ReferendumCard {
  id: string;
  title: string;
  eligibility: "OWNERS_ONLY" | "ALL_RESIDENTS";
  status: "OPEN" | "CLOSED";
  closesAt: string;
  isOpen: boolean;
  iAmEligible: boolean;
  myFlatVoted: boolean;
  turnout: number;
  eligibleFlats: number;
  author: { name: string; block: number | null; flatNumber: string };
}

export default function Referendums() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ReferendumCard[]>([]);
  const [loading, setLoading] = useState(true);
  const canCreate = canManageAnnouncements(user?.roles);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/referendums", { token });
      if (res.ok) setItems((await res.json()).referendums ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link to="/more" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 active:bg-slate-800">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white">Referendums</h1>
          <p className="truncate text-[11px] text-slate-500">Vote on community decisions — one flat, one vote</p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => navigate("/referendums/new")}
            className="flex h-9 items-center gap-1 rounded-full bg-indigo-500 px-3 text-sm font-medium text-white active:bg-indigo-600"
          >
            <Plus size={14} /> New
          </button>
        )}
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-blue-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-12 text-center text-sm text-slate-500">
          <Vote size={28} className="mx-auto mb-2 text-slate-600" />
          No referendums yet.
        </div>
      ) : (
        <div className="space-y-2 pb-4">
          {items.map((r) => (
            <Link key={r.id} to={`/referendums/${r.id}`} className="block rounded-2xl border border-slate-700 bg-slate-800/60 p-3 active:bg-slate-800">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{r.title}</h3>
                {r.isOpen ? (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    <Clock size={10} /> {closesLabel(r.closesAt)}
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                    <Lock size={10} /> Closed
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                by {r.author.name} · {r.eligibility === "OWNERS_ONLY" ? "Owners only" : "All residents"}
              </p>
              <div className="mt-1 flex items-center gap-3 text-[10px]">
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <Users size={10} /> {r.turnout}/{r.eligibleFlats} flats
                </span>
                {r.isOpen && r.myFlatVoted && (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-300"><CheckCircle2 size={10} /> Voted</span>
                )}
                {r.isOpen && !r.myFlatVoted && r.iAmEligible && <span className="font-bold text-blue-400">Vote now</span>}
                {r.isOpen && !r.myFlatVoted && !r.iAmEligible && <span className="text-slate-500">Not eligible</span>}
                {!r.isOpen && <span className="font-bold text-blue-400">View result</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function closesLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Closing";
  const h = ms / 3_600_000;
  if (h < 24) return `${Math.max(1, Math.round(h))}h left`;
  return `${Math.round(h / 24)}d left`;
}
