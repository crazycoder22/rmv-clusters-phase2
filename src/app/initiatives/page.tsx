"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Megaphone, Plus, MessageSquare, Clock, Lock } from "lucide-react";
import { track } from "@/lib/track-client";

interface InitiativeCard {
  id: string;
  title: string;
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  commentsCloseAt: string;
  isOpen: boolean;
  commentCount: number;
  imageUrl: string | null;
  author: { name: string; block: number | null; flatNumber: string };
  createdAt: string;
}

export default function InitiativesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<InitiativeCard[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/initiatives");
      if (res.ok) {
        const d = await res.json();
        setItems(d.initiatives ?? []);
        setCanCreate(!!d.canCreate);
        track("initiatives", "list");
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
              <Megaphone className="text-blue-600" /> Initiatives
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Share structured feedback on community initiatives</p>
          </div>
          {canCreate && (
            <Link
              href="/initiatives/new"
              className="inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              <Plus size={16} /> New initiative
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 py-16 text-center text-gray-500 dark:text-gray-400">
            <Megaphone size={32} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">No initiatives yet.{canCreate ? " Click “New initiative” to post one." : " Check back soon."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((i) => (
              <Link
                key={i.id}
                href={`/initiatives/${i.id}`}
                className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{i.title}</h3>
                  <StatusBadge isOpen={i.isOpen} status={i.status} commentsCloseAt={i.commentsCloseAt} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  by {i.author.name} · Block {i.author.block ?? "—"}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare size={12} /> {i.commentCount} {i.commentCount === 1 ? "comment" : "comments"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ isOpen, status, commentsCloseAt }: { isOpen: boolean; status: string; commentsCloseAt: string }) {
  if (isOpen) {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5">
        <Clock size={11} /> {closesLabel(commentsCloseAt)}
      </span>
    );
  }
  return (
    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
      <Lock size={11} /> {status === "ARCHIVED" ? "Archived" : "Closed"}
    </span>
  );
}

function closesLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Closing";
  const hours = ms / 3_600_000;
  if (hours < 24) return `Closes in ${Math.max(1, Math.round(hours))}h`;
  return `Closes in ${Math.round(hours / 24)}d`;
}
