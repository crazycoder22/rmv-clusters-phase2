import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { track } from "../lib/track";
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
      if (res.ok) {
        setItems((await res.json()).initiatives ?? []);
        track(token, "initiatives", "list");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-start gap-3 py-3">
        <Link to="/community" className="mt-0.5 flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={24} style={{ color: "var(--text-2)" }} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[23px] font-extrabold leading-tight tracking-tight" style={{ color: "var(--text)" }}>Initiatives</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-3)" }}>Share feedback on community initiatives</p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => navigate("/initiatives/new")}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-bold text-white"
            style={{ background: "var(--accent-strong)", boxShadow: "0 6px 16px var(--accent-soft)" }}
          >
            <Icon name="add" size={18} style={{ color: "#fff" }} /> New
          </button>
        )}
      </header>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" size={24} style={{ color: "var(--text-3)" }} /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[18px] px-6 py-12 text-center" style={{ border: "1.5px dashed var(--border-strong)" }}>
          <Icon name="campaign" size={32} style={{ color: "var(--text-3)" }} />
          <p className="text-[14px]" style={{ color: "var(--text-3)" }}>No initiatives yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {items.map((i) => (
            <Link
              key={i.id}
              to={`/initiatives/${i.id}`}
              className="block rounded-[18px] p-4 active:opacity-90"
              style={{ background: "var(--surface)", border: `1px solid ${i.isOpen ? "var(--border-strong)" : "var(--border)"}`, boxShadow: "var(--shadow)" }}
            >
              <div className="flex items-start justify-between gap-2.5">
                <h3 className="flex-1 text-[17px] font-bold leading-snug tracking-tight" style={{ color: "var(--text)" }}>{i.title}</h3>
                {i.isOpen ? (
                  <span className="flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                    <Icon name="schedule" size={15} style={{ color: "var(--success)" }} /> {closesLabel(i.commentsCloseAt)}
                  </span>
                ) : (
                  <span className="flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: "var(--surface-3)", color: "var(--text-3)", border: "1px solid var(--border)" }}>
                    <Icon name="lock" size={15} style={{ color: "var(--text-3)" }} /> {i.status === "ARCHIVED" ? "Archived" : "Closed"}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-3)" }}>by {i.author.name} · B{i.author.block ?? "—"}</p>
              <div className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--text-2)" }}>
                <Icon name="mode_comment" size={17} style={{ color: "var(--text-2)" }} />
                {i.commentCount}
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
