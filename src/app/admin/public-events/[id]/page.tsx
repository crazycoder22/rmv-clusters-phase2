"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import {
  ArrowLeft,
  Check,
  Download,
  IndianRupee,
  Loader2,
  Phone,
  Save,
  Upload,
  Users,
} from "lucide-react";
import clsx from "clsx";

interface Registration {
  position: number;
  id: string;
  name: string;
  phone: string;
  block: number | null;
  flatNumber: string | null;
  contributionAmount: number | null;
  paid: boolean;
  paidAt: string | null;
  adminNote: string | null;
  createdAt: string;
}

interface EventFull {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  organizer: string | null;
  venue: string | null;
  startAt: string;
  endAt: string | null;
  registrationClosesAt: string | null;
  active: boolean;
  contributionEnabled: boolean;
  maxContribution: number | null;
  targetAmount: number | null;
  paymentInstructions: string | null;
  paymentQrImageUrl: string | null;
  upiId: string | null;
}

const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

const fmtMoney = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function AdminEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { canManageAnnouncements, isLoading: roleLoading } = useRole();
  const router = useRouter();

  const [event, setEvent] = useState<EventFull | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && !canManageAnnouncements()) router.replace("/");
  }, [roleLoading, canManageAnnouncements, router]);

  const refresh = useCallback(async () => {
    const regsRes = await fetch(
      `/api/admin/public-events/${id}/registrations`
    );
    const regsData = await regsRes.json();
    if (regsData.event?.slug) {
      const evRes = await fetch(
        `/api/public-events/${regsData.event.slug}`
      );
      if (evRes.ok) {
        const evData = await evRes.json();
        setEvent(evData.event);
      }
    }
    setRegistrations(regsData.registrations ?? []);
  }, [id]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  if (roleLoading || loading) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">
        Loading...
      </div>
    );
  }
  if (!event) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">
        Event not found.
      </div>
    );
  }

  const csvUrl = `/api/admin/public-events/${id}/registrations?format=csv`;

  const totalPledged = registrations.reduce(
    (sum, r) => sum + (r.contributionAmount ?? 0),
    0
  );
  const totalPaid = registrations.reduce(
    (sum, r) => sum + (r.paid ? r.contributionAmount ?? 0 : 0),
    0
  );

  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <Link
          href="/admin/public-events"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-primary-400 mb-5"
        >
          <ArrowLeft size={14} /> All events
        </Link>

        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {event.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Slug:{" "}
              <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                {event.slug}
              </code>
              {" · "}
              <a
                href={`/events/${event.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                Public page ↗
              </a>
            </p>
          </div>
          <a
            href={csvUrl}
            download
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-primary-400 dark:hover:border-primary-500 shrink-0"
          >
            <Download size={14} />
            CSV
          </a>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 mb-6">
          <SummaryCard
            icon={<Users size={18} />}
            label="registered"
            value={registrations.length.toString()}
          />
          {event.contributionEnabled && (
            <>
              <SummaryCard
                icon={<IndianRupee size={18} />}
                label={`pledged${
                  event.targetAmount ? ` of ₹${event.targetAmount}` : ""
                }`}
                value={fmtMoney(totalPledged)}
                tint="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
              />
              <SummaryCard
                icon={<Check size={18} />}
                label="received"
                value={fmtMoney(totalPaid)}
                tint="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              />
            </>
          )}
        </div>

        <ContributionSettingsCard
          event={event}
          onSaved={(updated) => setEvent(updated)}
        />

        {registrations.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center text-sm text-gray-400 dark:text-gray-500">
            No registrations yet. Share the event URL:
            <div className="mt-2 font-mono text-xs text-gray-500 dark:text-gray-400">
              /events/{event.slug}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {registrations.map((r) => (
                <RegistrationRow
                  key={r.id}
                  eventId={id}
                  reg={r}
                  showAmount={event.contributionEnabled}
                  onUpdate={(updated) =>
                    setRegistrations((prev) =>
                      prev.map((x) =>
                        x.id === updated.id ? { ...x, ...updated } : x
                      )
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex items-center gap-3">
      <div
        className={clsx(
          "w-10 h-10 rounded-full flex items-center justify-center",
          tint ??
            "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-none">
          {value}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
      </div>
    </div>
  );
}

function ContributionSettingsCard({
  event,
  onSaved,
}: {
  event: EventFull;
  onSaved: (e: EventFull) => void;
}) {
  const [contributionEnabled, setContributionEnabled] = useState(
    event.contributionEnabled
  );
  const [maxContribution, setMaxContribution] = useState(
    event.maxContribution?.toString() ?? ""
  );
  const [targetAmount, setTargetAmount] = useState(
    event.targetAmount?.toString() ?? ""
  );
  const [upiId, setUpiId] = useState(event.upiId ?? "");
  const [paymentInstructions, setPaymentInstructions] = useState(
    event.paymentInstructions ?? ""
  );
  const [qrUrl, setQrUrl] = useState(event.paymentQrImageUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Upload failed");
        return;
      }
      setQrUrl(data.url);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/public-events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contributionEnabled,
          maxContribution:
            maxContribution === "" ? null : Number(maxContribution),
          targetAmount: targetAmount === "" ? null : Number(targetAmount),
          upiId: upiId || null,
          paymentInstructions: paymentInstructions || null,
          paymentQrImageUrl: qrUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Save failed");
        return;
      }
      setMsg("Saved!");
      onSaved({
        ...event,
        contributionEnabled,
        maxContribution:
          maxContribution === "" ? null : Number(maxContribution),
        targetAmount: targetAmount === "" ? null : Number(targetAmount),
        upiId: upiId || null,
        paymentInstructions: paymentInstructions || null,
        paymentQrImageUrl: qrUrl || null,
      });
      setTimeout(() => setMsg(null), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Contribution settings
        </h2>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={contributionEnabled}
            onChange={(e) => setContributionEnabled(e.target.checked)}
          />
          Enable
        </label>
      </div>

      {contributionEnabled && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Max per person (₹)"
              value={maxContribution}
              onChange={setMaxContribution}
              type="number"
              placeholder="e.g. 800"
            />
            <Field
              label="Target (₹)"
              value={targetAmount}
              onChange={setTargetAmount}
              type="number"
              placeholder="e.g. 14000"
            />
          </div>
          <Field
            label="UPI ID"
            value={upiId}
            onChange={setUpiId}
            placeholder="e.g. yourname@okaxis"
          />
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Payment instructions (optional)
            </label>
            <textarea
              value={paymentInstructions}
              onChange={(e) => setPaymentInstructions(e.target.value)}
              rows={2}
              placeholder="e.g. Please add 'Juice' in the UPI note."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Payment QR image
            </label>
            <div className="flex items-start gap-3">
              {qrUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrUrl}
                  alt="QR"
                  className="w-24 h-24 rounded-lg border border-gray-200 dark:border-gray-600 object-contain bg-white"
                />
              ) : (
                <div className="w-24 h-24 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-[11px] text-gray-400">
                  No QR
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="inline-flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100">
                  <Upload size={12} />
                  {uploading ? "Uploading…" : "Upload QR"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                  />
                </label>
                {qrUrl && (
                  <button
                    type="button"
                    onClick={() => setQrUrl("")}
                    className="text-[11px] text-red-500 hover:underline text-left"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-3">
        {err && <p className="text-xs text-red-500 flex-1">{err}</p>}
        {msg && <p className="text-xs text-green-600 flex-1">{msg}</p>}
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save settings
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        {label}
      </label>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
      />
    </div>
  );
}

function RegistrationRow({
  eventId,
  reg,
  showAmount,
  onUpdate,
}: {
  eventId: string;
  reg: Registration;
  showAmount: boolean;
  onUpdate: (updated: Partial<Registration> & { id: string }) => void;
}) {
  const [busy, setBusy] = useState(false);

  const togglePaid = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/public-events/${eventId}/registrations`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationId: reg.id,
            paid: !reg.paid,
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        onUpdate({
          id: reg.id,
          paid: data.registration.paid,
          paidAt: data.registration.paidAt,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-50 dark:bg-primary-900/40 text-[11px] font-bold text-primary-700 dark:text-primary-300 shrink-0">
        {reg.position}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {reg.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {reg.block ? `Block ${reg.block}` : "—"}
          {reg.flatNumber ? ` · ${reg.flatNumber}` : ""}
          {" · "}
          <a
            href={`tel:${reg.phone}`}
            className="font-mono text-primary-600 dark:text-primary-400 hover:underline"
          >
            <Phone size={10} className="inline opacity-60" /> {reg.phone}
          </a>
          {" · "}
          <span className="text-gray-400">{fmtWhen(reg.createdAt)}</span>
        </p>
      </div>
      {showAmount && reg.contributionAmount != null && (
        <>
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums shrink-0">
            {fmtMoney(reg.contributionAmount)}
          </span>
          <button
            onClick={togglePaid}
            disabled={busy}
            className={clsx(
              "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0",
              reg.paid
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-red-50 text-red-600 hover:bg-red-100"
            )}
          >
            {reg.paid ? <Check size={12} /> : <IndianRupee size={12} />}
            {reg.paid ? "Paid" : "Unpaid"}
          </button>
        </>
      )}
    </div>
  );
}
