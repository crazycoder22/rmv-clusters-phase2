import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Megaphone, Plus, MessageSquare, Clock, Lock, ArrowLeft } from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { canManageAnnouncements } from "../lib/roles";

interface InitiativeCard {
  id: string;
  title: string;
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  commentsCloseAt: string;
  isOpen: boolean;
  commentCount: number;
  author: { name: string; block: number | null; flatNumber: string };
}

export default function Initiatives() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<InitiativeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const canCreate = canManageAnnouncements(user?.roles);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/initiatives", { token });
      if (res.ok) setItems((await res.json()).initiatives ?? []);
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
          <h1 className="text-lg font-semibold text-white">Initiatives</h1>
          <p className="truncate text-[11px] text-slate-500">Share feedback on community initiatives</p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => navigate("/initiatives/new")}
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
          <Megaphone size={28} className="mx-auto mb-2 text-slate-600" />
          No initiatives yet.
        </div>
      ) : (
        <div className="space-y-2 pb-4">
          {items.map((i) => (
            <Link key={i.id} to={`/initiatives/${i.id}`} className="block rounded-2xl border border-slate-700 bg-slate-800/60 p-3 active:bg-slate-800">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{i.title}</h3>
                {i.isOpen ? (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    <Clock size={10} /> {closesLabel(i.commentsCloseAt)}
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                    <Lock size={10} /> {i.status === "ARCHIVED" ? "Archived" : "Closed"}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">by {i.author.name} · B{i.author.block ?? "—"}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500">
                <MessageSquare size={10} /> {i.commentCount} {i.commentCount === 1 ? "comment" : "comments"}
              </p>
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
