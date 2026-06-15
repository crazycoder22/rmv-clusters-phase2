import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Icon from "../components/Icon";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthProvider";

// Resident-facing view of their own community contributions. Contributions are
// stored on PublicEventRegistration.contributionAmount and matched to the
// caller by phone server-side (/api/contributions/my).

type Contribution = {
  id: string;
  eventTitle: string;
  eventSlug: string;
  date: string | null;
  registeredAt: string;
  amount: number;
  paid: boolean;
  paidAt: string | null;
};

type Response = {
  contributions: Contribution[];
  totalPaid: number;
  totalPledged: number;
  count: number;
};

export default function MyContributions() {
  const { token } = useAuth();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await apiFetch("/api/contributions/my", { token });
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const contributions = data?.contributions ?? [];
  const total = data?.totalPledged ?? 0;

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-start gap-3.5 py-3">
        <Link to="/community" className="mt-0.5 flex active:opacity-70" aria-label="Back">
          <Icon name="arrow_back" size={23} style={{ color: "var(--text-2)" }} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-extrabold leading-tight tracking-tight" style={{ color: "var(--text)" }}>
            My contributions
          </h1>
          <p className="mt-0.5 truncate text-[13px]" style={{ color: "var(--text-3)" }}>
            What you&apos;ve given to community drives
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--text-3)" }} />
        </div>
      ) : (
        <>
          {/* Total */}
          <div
            className="relative overflow-hidden rounded-[20px] p-[18px]"
            style={{ background: "linear-gradient(150deg, #3a2c10 0%, #2a2410 48%, #0f2e2a 100%)", border: "1px solid var(--border-strong)" }}
          >
            <span className="one-mono text-[11px] font-semibold" style={{ color: "#d9c79f", letterSpacing: "0.14em" }}>
              TOTAL CONTRIBUTED
            </span>
            <div className="mt-2 text-[44px] font-extrabold leading-[1.04] tracking-tight text-white">
              ₹{total.toLocaleString("en-IN")}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <Icon name="volunteer_activism" size={18} style={{ color: "#d9c79f" }} />
              <span className="text-[15px]" style={{ color: "#e2d4b6" }}>
                across {contributions.length} {contributions.length === 1 ? "drive" : "drives"}
              </span>
            </div>
          </div>

          {/* List */}
          {contributions.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-2 rounded-[16px] py-10 text-center" style={{ border: "1px dashed var(--border-strong)" }}>
              <Icon name="volunteer_activism" size={34} style={{ color: "var(--text-3)" }} />
              <p className="text-[14px]" style={{ color: "var(--text-2)" }}>No contributions yet.</p>
              <p className="px-8 text-[12px]" style={{ color: "var(--text-3)" }}>
                When you contribute to a community drive, it&apos;ll show up here.
              </p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2.5">
              {contributions.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-[16px] p-3.5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold" style={{ color: "var(--text)" }}>
                      {c.eventTitle}
                    </p>
                    <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-3)" }}>
                      {fmtDate(c.date ?? c.registeredAt)}
                    </p>
                  </div>
                  {c.paid ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                      <Icon name="check_circle" size={13} fill /> Received
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
                      <Icon name="schedule" size={13} /> Pending
                    </span>
                  )}
                  <span className="one-mono w-[64px] flex-shrink-0 text-right text-[15px] font-bold" style={{ color: "var(--text)" }}>
                    ₹{c.amount.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="pt-4 text-center text-[11px]" style={{ color: "var(--text-3)" }}>
            Contributions are matched to your registered phone number.
          </p>
        </>
      )}
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
