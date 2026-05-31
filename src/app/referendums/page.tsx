"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Vote, Plus, Clock, Lock, CheckCircle2, Users } from "lucide-react";

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

export default function ReferendumsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<ReferendumCard[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/referendums");
      if (res.ok) {
        const d = await res.json();
        setItems(d.referendums ?? []);
        setCanCreate(!!d.canCreate);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Vote className="text-blue-600" /> Referendums
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Vote on community decisions — one flat, one vote</p>
          </div>
          {canCreate && (
            <Link
              href="/referendums/new"
              className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} /> New referendum
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-16 text-center text-gray-500 dark:text-gray-400">
            <Vote size={32} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">No referendums yet.{canCreate ? " Click “New referendum” to create one." : ""}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((r) => (
              <Link
                key={r.id}
                href={`/referendums/${r.id}`}
                className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{r.title}</h3>
                  {r.isOpen ? (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                      <Clock size={11} /> {closesLabel(r.closesAt)}
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
                      <Lock size={11} /> Closed
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  by {r.author.name} · {r.eligibility === "OWNERS_ONLY" ? "Owners only" : "All residents"}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500">
                    <Users size={12} /> {r.turnout}/{r.eligibleFlats} flats voted
                  </span>
                  {r.isOpen && r.myFlatVoted && (
                    <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                      <CheckCircle2 size={12} /> Your flat voted
                    </span>
                  )}
                  {r.isOpen && !r.myFlatVoted && !r.iAmEligible && (
                    <span className="text-gray-400 dark:text-gray-500">Not eligible</span>
                  )}
                  {r.isOpen && !r.myFlatVoted && r.iAmEligible && (
                    <span className="text-blue-600 font-semibold">Vote now</span>
                  )}
                  {!r.isOpen && <span className="text-blue-600 font-semibold">View result</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function closesLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Closing";
  const hours = ms / 3_600_000;
  if (hours < 24) return `Closes in ${Math.max(1, Math.round(hours))}h`;
  return `Closes in ${Math.round(hours / 24)}d`;
}
