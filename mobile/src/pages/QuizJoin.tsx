import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";

type SessionSummary = {
  id: string;
  code: string;
  quizTitle: string;
  status: "WAITING" | "ACTIVE" | "SHOWING_RESULTS" | "COMPLETED";
  playerCount: number;
  createdAt: string;
};

export default function QuizJoin() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      apiFetch("/api/quiz/sessions")
        .then((r) => (r.ok ? r.json() : { sessions: [] }))
        .then((data) => {
          if (cancelled) return;
          setSessions(data.sessions ?? []);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const handleJoinCode = () => {
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      setError("Enter a valid code");
      return;
    }
    navigate(`/quiz/${trimmed}`);
  };

  const joinable = sessions.filter(
    (s) => s.status === "WAITING" || s.status === "ACTIVE"
  );

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center justify-between py-4">
        <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-full" style={{ color: "var(--text-2)" }}>
          <Icon name="arrow_back" size={22} />
        </Link>
        <h1 className="text-[18px] font-bold" style={{ color: "var(--text)" }}>Quiz Night</h1>
        <div className="h-9 w-9" />
      </header>

      {/* Have a code? */}
      <div className="rounded-[18px] p-[18px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <h2 className="text-[20px] font-extrabold tracking-tight" style={{ color: "var(--text)" }}>Have a code?</h2>
        <p className="mt-1.5 text-[13.5px] leading-snug" style={{ color: "var(--text-3)" }}>
          Enter the 6-character code from the host screen.
        </p>
        <div className="relative mt-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") handleJoinCode(); }}
            placeholder="ABC123"
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect="off"
            className="one-mono w-full rounded-[13px] py-[18px] pl-4 pr-[56px] text-center text-[22px] font-semibold tracking-[0.32em] outline-none"
            style={{ border: "1.5px solid var(--border-strong)", color: "var(--text)", background: "transparent" }}
          />
          <button
            onClick={handleJoinCode}
            aria-label="Join"
            className="absolute right-2 top-1/2 flex h-[42px] w-[42px] -translate-y-1/2 items-center justify-center rounded-[11px] active:opacity-80"
            style={{ background: "var(--accent-strong)" }}
          >
            <Icon name="arrow_forward" size={22} style={{ color: "#fff" }} />
          </button>
        </div>
        {error && <p className="mt-2 text-[12px]" style={{ color: "var(--danger)" }}>{error}</p>}
      </div>

      {/* Live sessions */}
      <h2 className="mb-3 mt-[22px] px-1 text-[18px] font-bold tracking-tight" style={{ color: "var(--text)" }}>Live sessions</h2>
      {loading ? (
        <p className="py-6 text-center text-[14px]" style={{ color: "var(--text-3)" }}>Loading…</p>
      ) : joinable.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[16px] py-10 text-center" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
          <Icon name="stadia_controller" size={32} style={{ color: "var(--text-3)" }} />
          <p className="text-[14px]" style={{ color: "var(--text-2)" }}>No live quizzes right now.</p>
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Wait for an admin to start one.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {joinable.map((s) => {
            const live = s.status === "ACTIVE";
            return (
              <button
                key={s.id}
                onClick={() => navigate(`/quiz/${s.code}`)}
                className="flex w-full items-center gap-3 rounded-[16px] p-3.5 text-left active:opacity-80"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div
                  className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[14px]"
                  style={{ background: live ? "rgba(33,178,87,0.16)" : "var(--warning-soft)" }}
                >
                  <Icon name="stadia_controller" size={27} style={{ color: live ? "#21b257" : "var(--warning)" }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15.5px] font-bold leading-tight tracking-tight" style={{ color: "var(--text)" }}>{s.quizTitle}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-3)" }}>
                    <span className="one-mono">{s.code}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Icon name="group" size={14} /> {s.playerCount}</span>
                    <span>·</span>
                    <span className="font-bold" style={{ color: live ? "#21b257" : "var(--warning)" }}>{live ? "Live" : "Waiting"}</span>
                  </div>
                </div>
                <Icon name="chevron_right" size={22} style={{ color: "var(--text-3)" }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
