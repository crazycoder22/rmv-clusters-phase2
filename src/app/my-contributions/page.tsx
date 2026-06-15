"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { HandCoins, CheckCircle2, Clock, IndianRupee } from "lucide-react";

type Contribution = {
  id: string;
  eventTitle: string;
  eventSlug: string;
  date: string | null;
  registeredAt: string;
  amount: number;
  paid: boolean;
  paidAt: string | null;
  eventRaised: number;
  eventContributors: number;
  eventTarget: number | null;
};

type Response = {
  contributions: Contribution[];
  totalPaid: number;
  totalPledged: number;
  count: number;
};

export default function MyContributionsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const load = useCallback(async () => {
    const r = await fetch("/api/contributions/my");
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  const contributions = data?.contributions ?? [];
  const total = data?.totalPledged ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        My contributions
      </h1>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        What you&apos;ve given to community drives
      </p>

      {/* Total */}
      <section className="mt-5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gradient-to-br from-amber-50 to-emerald-50 dark:from-amber-900/20 dark:to-emerald-900/20 p-5">
        <p className="text-[11px] uppercase tracking-wider text-gray-500">
          Total contributed
        </p>
        <p className="mt-0.5 flex items-center text-4xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
          <IndianRupee size={28} className="mt-1" />
          {total.toLocaleString("en-IN")}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          <HandCoins size={12} className="-mt-0.5 mr-0.5 inline" />
          across {contributions.length}{" "}
          {contributions.length === 1 ? "drive" : "drives"}
        </p>
      </section>

      {/* List */}
      {contributions.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
          <HandCoins size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No contributions yet.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            When you contribute to a community drive, it&apos;ll show up here.
          </p>
        </div>
      ) : (
        <section className="mt-5 space-y-2">
          {contributions.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {c.eventTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {c.date ? fmtDate(c.date) : fmtDate(c.registeredAt)}
                  </p>
                </div>
                {c.paid ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 size={12} /> Received
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    <Clock size={12} /> Pending
                  </span>
                )}
                <span className="w-20 flex-shrink-0 text-right font-mono text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  ₹{c.amount.toLocaleString("en-IN")}
                </span>
              </div>
              {/* RMV community total for this initiative */}
              <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2 text-[11px] text-gray-500 dark:text-gray-400">
                RMV raised{" "}
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  ₹{c.eventRaised.toLocaleString("en-IN")}
                </span>
                {c.eventTarget ? (
                  <> of ₹{c.eventTarget.toLocaleString("en-IN")} goal</>
                ) : null}{" "}
                · {c.eventContributors}{" "}
                {c.eventContributors === 1 ? "contributor" : "contributors"}
              </div>
            </div>
          ))}
        </section>
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
