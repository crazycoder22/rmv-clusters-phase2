"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRequireSignIn } from "@/hooks/useRequireSignIn";
import { Scale, CheckCircle2, Clock, MinusCircle, IndianRupee } from "lucide-react";

type DebtStatus = "OWED" | "PAID" | "WAIVED";

type Debt = {
  id: string;
  amount: number;
  reason: string;
  status: DebtStatus;
  createdAt: string;
  paidAt: string | null;
};

type Response = {
  debts: Debt[];
  totalOwed: number;
  totalPaid: number;
  totalWaived: number;
  count: number;
};

export default function MyAccountabilityDebtsPage() {
  const { status } = useSession();
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useRequireSignIn(status);

  const load = useCallback(async () => {
    const r = await fetch("/api/accountability-debts/my");
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

  const debts = data?.debts ?? [];
  const totalOwed = data?.totalOwed ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        My accountability debts
      </h1>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
        Pledges you owe from community initiatives
      </p>

      {/* Total outstanding */}
      <section className="mt-5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-900/20 dark:to-amber-900/20 p-5">
        <p className="text-[11px] uppercase tracking-wider text-gray-500">
          Outstanding
        </p>
        <p className="mt-0.5 flex items-center text-4xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
          <IndianRupee size={28} className="mt-1" />
          {totalOwed.toLocaleString("en-IN")}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          <Scale size={12} className="-mt-0.5 mr-0.5 inline" />
          across {debts.filter((d) => d.status === "OWED").length}{" "}
          {debts.filter((d) => d.status === "OWED").length === 1 ? "item" : "items"}
        </p>
      </section>

      {/* List */}
      {debts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-300" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Nothing owed. Nice!
          </p>
          <p className="mt-1 text-xs text-gray-400">
            If you pledge on a challenge and miss your goal, it&apos;ll show up here.
          </p>
        </div>
      ) : (
        <section className="mt-5 space-y-2">
          {debts.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {d.reason}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {fmtDate(d.createdAt)}
                  </p>
                </div>
                <StatusBadge status={d.status} />
                <span className="w-20 flex-shrink-0 text-right font-mono text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  ₹{d.amount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: DebtStatus }) {
  if (status === "PAID") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 size={12} /> Paid
      </span>
    );
  }
  if (status === "WAIVED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
        <MinusCircle size={12} /> Waived
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
      <Clock size={12} /> Owed
    </span>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
