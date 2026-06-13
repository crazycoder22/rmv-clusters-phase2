"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import {
  ArrowLeft,
  Bell,
  Send,
  Smartphone,
  Users,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import clsx from "clsx";

interface Counts {
  iosTokens: number;
  androidTokens: number;
  totalTokens: number;
  approvedResidents: number;
}

interface SendResult {
  ok: true;
  sent: number;
  failed: number;
  pruned: number;
}

// Defaults are the "update available" nudge — admin can edit before sending.
const DEFAULT_TITLE = "📲 OneRMV update available";
const DEFAULT_BODY =
  "A new version of OneRMV is ready with a fresh look + new features. Tap Play Store / App Store to update.";

export default function PushNudgePage() {
  const { canManageAnnouncements, isLoading: roleLoading } = useRole();
  const router = useRouter();

  const [counts, setCounts] = useState<Counts | null>(null);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [sending, setSending] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!roleLoading && !canManageAnnouncements()) router.replace("/");
  }, [roleLoading, canManageAnnouncements, router]);

  useEffect(() => {
    fetch("/api/admin/push/broadcast")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setCounts(d);
      });
  }, []);

  async function send() {
    setSending(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/push/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Server returned ${res.status}`);
        return;
      }
      setResult(data as SendResult);
      setConfirmStep(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSending(false);
    }
  }

  if (roleLoading) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="py-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 mb-5"
        >
          <ArrowLeft size={14} /> Back home
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Bell size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Push Broadcast
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Send a one-shot push to every signed-in mobile device.
            </p>
          </div>
        </div>

        {/* Target counts */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Kpi
            icon={<Smartphone size={16} />}
            label="iOS devices"
            value={counts?.iosTokens ?? "—"}
          />
          <Kpi
            icon={<Smartphone size={16} />}
            label="Android devices"
            value={counts?.androidTokens ?? "—"}
          />
          <Kpi
            icon={<Users size={16} />}
            label="Approved residents"
            value={counts?.approvedResidents ?? "—"}
          />
        </div>

        {/* Message editor */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Body
            </label>
            <textarea
              rows={4}
              maxLength={500}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 text-right">
              {body.length} / 500
            </p>
          </div>

          {/* Preview */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Preview
            </p>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 text-sm">
              <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                {title || <span className="text-gray-400">Title…</span>}
              </div>
              <div className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {body || <span className="text-gray-400">Body…</span>}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Push sent.</p>
              <p className="text-xs mt-0.5">
                {result.sent} delivered · {result.failed} failed ·{" "}
                {result.pruned} dead tokens pruned
              </p>
            </div>
          </div>
        )}

        {/* Send button — two-step confirm */}
        {!confirmStep ? (
          <button
            onClick={() => setConfirmStep(true)}
            disabled={!title.trim() || !body.trim()}
            className={clsx(
              "w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-white text-base",
              !title.trim() || !body.trim()
                ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                : "bg-amber-600 hover:bg-amber-700"
            )}
          >
            <Send size={18} />
            Review & send
          </button>
        ) : (
          <div className="rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle
                size={18}
                className="shrink-0 mt-0.5 text-amber-700 dark:text-amber-400"
              />
              <div className="text-sm text-amber-900 dark:text-amber-200">
                <p className="font-semibold">Confirm broadcast</p>
                <p className="mt-1">
                  This sends the above push to{" "}
                  <strong>{counts?.totalTokens ?? "all"}</strong> signed-in
                  device(s). Cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmStep(false)}
                disabled={sending}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending}
                className={clsx(
                  "flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-white text-sm",
                  sending
                    ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                    : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                {sending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send size={16} /> Send now
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <div className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 mb-1.5">
        {icon}
      </div>
      <div className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
        {value}
      </div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400">
        {label}
      </div>
    </div>
  );
}
