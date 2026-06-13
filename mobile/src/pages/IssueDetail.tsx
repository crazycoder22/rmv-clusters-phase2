import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";
import { CAT_TONE, CategoryRing, StatusBadge } from "./Issues";

type Category = "ELECTRICAL" | "PLUMBING" | "OTHER";

type Issue = {
  id: string;
  title: string;
  description: string;
  category: Category;
  status: "OPEN" | "CLOSED";
  closureComment: string | null;
  closedAt: string | null;
  createdAt: string;
  resident: { name: string; block: number; flatNumber: string };
  closedByResident: { name: string } | null;
};

export default function IssueDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [closureComment, setClosureComment] = useState("");
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/issues/${id}`, { token });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to load");
        return;
      }
      const data = await res.json();
      setIssue(data.issue);
      setIsManager(!!data.isManager);
      setError(null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const close = async () => {
    if (!closureComment.trim()) {
      setError("Please add a closure comment.");
      return;
    }
    setClosing(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/issues/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ closureComment: closureComment.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to close");
        return;
      }
      setClosureComment("");
      refresh();
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <header className="flex items-center py-3">
        <button onClick={() => navigate("/issues")} className="flex items-center gap-2 text-[15px] font-semibold active:opacity-70" style={{ color: "var(--text-2)" }}>
          <Icon name="arrow_back" size={22} style={{ color: "var(--text-2)" }} /> All issues
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin" size={22} style={{ color: "var(--text-3)" }} /></div>
      ) : !issue ? (
        <p className="py-12 text-center text-[14px]" style={{ color: "var(--danger)" }}>{error ?? "Not found"}</p>
      ) : (
        <>
          {/* Title row */}
          <div className="flex items-center gap-3">
            <CategoryRing category={issue.category} size={46} />
            <div className="min-w-0 flex-1">
              <h1 className="text-[21px] font-extrabold leading-tight tracking-tight" style={{ color: "var(--text)" }}>{issue.title}</h1>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-3)" }}>{CAT_TONE[issue.category].label}</p>
            </div>
            <StatusBadge status={issue.status} />
          </div>

          {/* Raised by */}
          <p className="mt-3.5 text-[13px]" style={{ color: "var(--text-3)" }}>
            Raised by <span className="font-semibold" style={{ color: "var(--text-2)" }}>{issue.resident.name}</span> · Block {issue.resident.block}, {issue.resident.flatNumber} · {formatDate(issue.createdAt)}
          </p>

          {/* Description */}
          <p className="mt-3.5 whitespace-pre-wrap text-[14.5px] leading-relaxed" style={{ color: "var(--text)" }}>{issue.description}</p>

          {/* Closed banner */}
          {issue.status === "CLOSED" && (
            <div className="mt-[18px] rounded-[14px] p-4" style={{ background: "var(--success-soft)", border: "1px solid color-mix(in srgb, var(--success) 35%, transparent)" }}>
              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[14px] font-bold" style={{ color: "var(--success)" }}>
                <Icon name="check_circle" size={15} fill style={{ color: "var(--success)" }} /> Closed
                {issue.closedByResident && <span className="text-[12px] font-normal" style={{ color: "var(--success)", opacity: 0.8 }}>by {issue.closedByResident.name}</span>}
                {issue.closedAt && <span className="text-[12px] font-normal" style={{ color: "var(--success)", opacity: 0.8 }}>· {formatDate(issue.closedAt)}</span>}
              </div>
              {issue.closureComment && <p className="text-[14px] leading-relaxed" style={{ color: "var(--text)" }}>{issue.closureComment}</p>}
            </div>
          )}

          {/* Manager close control */}
          {issue.status === "OPEN" && isManager && (
            <>
              <p className="one-mono mt-5 mb-2.5 text-[11px]" style={{ color: "var(--text-3)", letterSpacing: "0.1em" }}>CLOSE THIS ISSUE</p>
              <div className="rounded-[16px] p-3.5" style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)" }}>
                <textarea
                  value={closureComment}
                  onChange={(e) => setClosureComment(e.target.value)}
                  placeholder="Add a closure note (e.g. 'Replaced fuse, working again')"
                  rows={3}
                  className="w-full resize-none bg-transparent text-[14px] leading-relaxed outline-none"
                  style={{ color: "var(--text)" }}
                />
                {error && <p className="mt-1.5 text-[12px]" style={{ color: "var(--danger)" }}>{error}</p>}
                <button
                  onClick={close}
                  disabled={closing || !closureComment.trim()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-[12px] py-3.5 text-[15px] font-bold text-white active:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--success)" }}
                >
                  {closing ? <Loader2 size={15} className="animate-spin" /> : <Icon name="check_circle" size={18} fill style={{ color: "#fff" }} />}
                  {closing ? "Closing…" : "Mark as closed"}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
