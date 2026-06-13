import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

type Issue = {
  id: string;
  title: string;
  description: string;
  category: "ELECTRICAL" | "PLUMBING" | "OTHER";
  status: "OPEN" | "CLOSED";
  closureComment: string | null;
  closedAt: string | null;
  createdAt: string;
  resident: { name: string; block: number; flatNumber: string };
  closedByResident: { name: string } | null;
};

type Filter = "OPEN" | "CLOSED" | "ALL";

// OneRMV category tones — electrical=gold, plumbing=info, other=neutral.
export const CAT_TONE: Record<Issue["category"], { label: string; ms: string; ring: string; color: string }> = {
  ELECTRICAL: { label: "Electrical", ms: "bolt", ring: "var(--gold-soft)", color: "var(--gold)" },
  PLUMBING: { label: "Plumbing", ms: "plumbing", ring: "var(--info-soft)", color: "var(--info)" },
  OTHER: { label: "Other", ms: "adjust", ring: "color-mix(in srgb, var(--text-2) 18%, transparent)", color: "var(--text-2)" },
};

export function CategoryRing({ category, size = 44 }: { category: Issue["category"]; size?: number }) {
  const c = CAT_TONE[category];
  return (
    <span className="flex flex-shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: c.ring }}>
      <Icon name={c.ms} size={Math.round(size * 0.5)} style={{ color: c.color }} />
    </span>
  );
}

export function StatusBadge({ status }: { status: Issue["status"] }) {
  const closed = status === "CLOSED";
  return (
    <span
      className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold"
      style={closed ? { background: "var(--success-soft)", color: "var(--success)" } : { background: "var(--warning-soft)", color: "var(--warning)" }}
    >
      {closed && <Icon name="check_circle" size={13} fill style={{ color: "var(--success)" }} />}
      {closed ? "Closed" : "Open"}
    </span>
  );
}

export default function IssuesPage() {
  const { token } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isManager, setIsManager] = useState(false);
  const [canRaise, setCanRaise] = useState(true);
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    apiFetch("/api/issues", { token })
      .then((r) => (r.ok ? r.json() : { issues: [], isManager: false, canRaise: true }))
      .then((data) => {
        if (cancelled) return;
        setIssues(data.issues ?? []);
        setIsManager(!!data.isManager);
        setCanRaise(data.canRaise !== false);
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
    if (filter === "ALL") return issues;
    return issues.filter((i) => i.status === filter);
  }, [issues, filter]);

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-center gap-3 py-3">
        <Link to="/community" className="flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={24} style={{ color: "var(--text-2)" }} />
        </Link>
        <h1 className="min-w-0 flex-1 text-[24px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Issues</h1>
        {canRaise && (
          <Link to="/issues/new" className="flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-bold text-white active:opacity-90" style={{ background: "var(--accent-strong)", boxShadow: "0 6px 16px var(--accent-soft)" }}>
            <Icon name="add" size={18} style={{ color: "#fff" }} /> Raise
          </Link>
        )}
      </header>

      {isManager && (
        <p className="pb-2.5 text-center text-[13px] font-semibold" style={{ color: "var(--warning)" }}>
          Manager view: showing all residents' issues.
        </p>
      )}

      {/* Filter segmented control */}
      <div className="mb-3 flex justify-center">
        <div className="flex gap-1 rounded-[11px] p-[3px]" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          {(["OPEN", "CLOSED", "ALL"] as Filter[]).map((f) => {
            const on = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="rounded-[9px] px-5 py-2 text-[13.5px] font-bold"
                style={on ? { background: "var(--surface)", color: "var(--text)", boxShadow: "0 1px 3px rgba(0,0,0,0.18)" } : { background: "transparent", color: "var(--text-2)" }}
              >
                {f === "OPEN" ? "Open" : f === "CLOSED" ? "Closed" : "All"}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" size={22} style={{ color: "var(--text-3)" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Icon name="task_alt" size={32} style={{ color: "var(--text-3)" }} />
          <p className="mt-2 text-[14px]" style={{ color: "var(--text-3)" }}>
            {filter === "OPEN" ? "No open issues." : filter === "CLOSED" ? "No closed issues yet." : "No issues yet."}
          </p>
          {canRaise && filter === "OPEN" && (
            <Link to="/issues/new" className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold" style={{ color: "var(--accent)" }}>
              <Icon name="add" size={14} style={{ color: "var(--accent)" }} /> Raise an issue
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {filtered.map((issue) => (
            <Link
              key={issue.id}
              to={`/issues/${issue.id}`}
              className="flex items-center gap-3.5 rounded-[18px] p-[15px_14px] active:opacity-90"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <CategoryRing category={issue.category} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[16px] font-bold tracking-tight" style={{ color: "var(--text)" }}>{issue.title}</p>
                  <StatusBadge status={issue.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug" style={{ color: "var(--text-2)" }}>{issue.description}</p>
                <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-3)" }}>
                  {isManager ? `${issue.resident.name} · Block ${issue.resident.block}, ${issue.resident.flatNumber} · ` : ""}
                  {formatDate(issue.createdAt)}
                </p>
              </div>
              <Icon name="chevron_right" size={22} style={{ color: "var(--text-3)" }} className="flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
