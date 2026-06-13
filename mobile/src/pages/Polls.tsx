import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type PollSummary = {
  id: string;
  title: string;
  description: string | null;
  type: "SINGLE" | "MULTIPLE";
  isAnonymous: boolean;
  deadline: string;
  status: "ACTIVE" | "CLOSED";
  createdBy: { name: string; block: number; flatNumber: string };
  options: { id: string; text: string }[];
  _count: { votes: number };
  createdAt: string;
};

type Filter = "ACTIVE" | "CLOSED" | "ALL";

export default function PollsPage() {
  const { token } = useAuth();
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    apiFetch("/api/polls", { token })
      .then((r) => (r.ok ? r.json() : { polls: [] }))
      .then((data) => {
        if (!cancelled) setPolls(data.polls ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return polls.filter((p) => {
      const expired = p.status === "CLOSED" || new Date(p.deadline).getTime() < now;
      if (filter === "ACTIVE") return !expired;
      if (filter === "CLOSED") return expired;
      return true;
    });
  }, [polls, filter]);

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center gap-3 py-2.5">
        <Link to="/community" className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={24} style={{ color: "var(--text-2)" }} />
        </Link>
        <h1 className="text-[24px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Polls</h1>
      </header>

      {/* Segmented filter */}
      <div className="mb-3.5 flex justify-center">
        <div className="flex rounded-[13px] p-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          {(["ACTIVE", "CLOSED", "ALL"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-[9px] px-5 py-2 text-[14px] font-bold transition-colors"
              style={
                filter === f
                  ? { background: "var(--accent-strong)", color: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.25)" }
                  : { background: "transparent", color: "var(--text-3)" }
              }
            >
              {f === "ACTIVE" ? "Active" : f === "CLOSED" ? "Closed" : "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[18px] px-6 py-10 text-center" style={{ border: "1.5px dashed var(--border-strong)" }}>
            <Icon name="ballot" size={40} style={{ color: "var(--text-3)" }} />
            <p className="text-[14px]" style={{ color: "var(--text-3)" }}>No polls here right now.</p>
          </div>
        ) : (
          filtered.map((p) => {
            const expired = p.status === "CLOSED" || new Date(p.deadline).getTime() < Date.now();
            return (
              <Link
                key={p.id}
                to={`/polls/${p.id}`}
                className="flex items-center gap-3 rounded-[18px] p-[15px] active:opacity-90"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: expired ? "var(--surface-3)" : "var(--accent-soft)" }}
                >
                  <Icon name={expired ? "lock" : "bar_chart"} size={22} style={{ color: expired ? "var(--text-3)" : "var(--accent)" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[16px] font-bold tracking-tight" style={{ color: "var(--text)" }}>{p.title}</span>
                    {expired ? (
                      <Pill text="Closed" bg="var(--surface-3)" fg="var(--text-3)" />
                    ) : (
                      <>
                        {p.type === "MULTIPLE" && <Pill text="Multi" bg="var(--accent-soft)" fg="var(--accent)" />}
                        {p.isAnonymous && <Pill text="Anon" bg="var(--surface-3)" fg="var(--text-3)" />}
                      </>
                    )}
                  </div>
                  {p.description && (
                    <p className="mt-1 truncate text-[13px]" style={{ color: "var(--text-2)" }}>{p.description}</p>
                  )}
                  <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--text-3)" }}>
                    {p._count.votes} vote{p._count.votes === 1 ? "" : "s"} · {expired ? "Ended" : "Ends"} {formatDate(p.deadline)}
                  </p>
                </div>
                <Icon name="chevron_right" size={20} className="flex-shrink-0" style={{ color: "var(--text-3)" }} />
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function Pill({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span className="flex-shrink-0 rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: bg, color: fg }}>
      {text}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
