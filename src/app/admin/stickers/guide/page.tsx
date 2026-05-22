"use client";

// Block 2 manager SOP for issuing vehicle stickers via the dashboard.
// Print-friendly; volunteers and facility managers can also use this as
// a quick reference card. Auth-gated to canIssueStickers (admins + FM).

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import {
  ArrowLeft,
  Printer,
  CheckSquare,
  AlertTriangle,
  Phone,
  Search,
} from "lucide-react";

export default function StickerManagerGuidePage() {
  const { canIssueStickers, isLoading: roleLoading } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (!roleLoading && !canIssueStickers()) router.replace("/");
  }, [roleLoading, canIssueStickers, router]);

  if (roleLoading) {
    return (
      <div className="py-12 text-center text-gray-400 dark:text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen py-6 print:bg-white print:py-0">
      {/* Screen-only toolbar */}
      <div className="max-w-3xl mx-auto px-4 mb-4 flex items-center justify-between print:hidden">
        <Link
          href="/admin/stickers"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
        >
          <Printer size={14} />
          Print
        </button>
      </div>

      <article className="max-w-3xl mx-auto bg-white dark:bg-gray-800 print:bg-white border border-gray-200 dark:border-gray-700 print:border-0 rounded-xl print:rounded-none shadow-sm print:shadow-none px-6 py-6 sm:px-8 sm:py-8 print:px-0 print:py-0 text-gray-800 print:text-black">
        {/* Header */}
        <header className="border-b-2 border-gray-300 pb-3 mb-4">
          <h1 className="text-2xl font-bold">
            🪪 Issuing Vehicle Stickers — Block 2 Office Guide
          </h1>
          <p className="mt-1 text-sm text-gray-600 print:text-gray-700">
            Quick-reference card for handing out vehicle stickers from the
            Block 2 office. Bookmark this page on your phone or print and
            keep on your desk.
          </p>
        </header>

        {/* Where to find the dashboard */}
        <section className="mb-5">
          <h2 className="text-base font-bold uppercase tracking-wider text-gray-700 print:text-black mb-2 flex items-center gap-2">
            <Search size={16} /> Where to find the dashboard
          </h2>
          <ol className="text-sm space-y-1 list-decimal pl-5">
            <li>
              Open <strong>rmvclustersphase2.in</strong> on any phone or
              laptop.
            </li>
            <li>
              Sign in with your Google account (the one tied to your
              Facility Manager role).
            </li>
            <li>
              Tap the menu → <strong>Residents &amp; Access → Vehicle
              Stickers</strong>. Or go directly to
              <strong> /admin/stickers</strong>.
            </li>
          </ol>
        </section>

        {/* Per-resident workflow */}
        <section className="mb-5">
          <h2 className="text-base font-bold uppercase tracking-wider text-gray-700 print:text-black mb-2">
            👉 When a resident walks in for stickers
          </h2>
          <ol className="text-sm space-y-2 list-decimal pl-5">
            <li>
              <strong>Ask:</strong> &ldquo;Which block and flat?&rdquo;
            </li>
            <li>
              In the dashboard&apos;s <strong>Search box</strong>, type the
              flat number (e.g., <em>205</em>) and pick a block filter if
              needed.
            </li>
            <li>
              <strong>Glance at the chips</strong> under the resident&apos;s
              name:
              <ul className="mt-1 list-disc pl-5 text-xs">
                <li>
                  Blue <strong>MyGate ✓</strong> chip → vehicle details
                  already added; skip the MyGate check.
                </li>
                <li>
                  Grey <strong>MyGate ?</strong> chip → ask them to open
                  MyGate → Vehicles. Don&apos;t issue until at least one
                  vehicle is registered there.
                </li>
                <li>
                  Amber <strong>Self-collected</strong> chip → they already
                  said they have stickers. Confirm verbally; don&apos;t
                  hand out more unless they explain.
                </li>
              </ul>
            </li>
            <li>
              <strong>Confirm count verbally:</strong> &ldquo;You need{" "}
              <em>X</em> cars and <em>Y</em> bikes, right?&rdquo;
            </li>
            <li>
              <strong>Hand over the stickers</strong> from the office tray.
            </li>
            <li>
              In the dashboard, click the <strong>Pending</strong> pill on
              their row → it turns green <strong>Issued</strong>. Your name
              and the timestamp are recorded automatically.
            </li>
          </ol>
          <p className="mt-2 text-xs italic text-gray-600 print:text-gray-700">
            No photo ID needed. Knowing the flat number + MyGate being set
            up is enough verification.
          </p>
        </section>

        {/* Edge cases */}
        <section className="mb-5">
          <h2 className="text-base font-bold uppercase tracking-wider text-gray-700 print:text-black mb-2 flex items-center gap-2">
            <AlertTriangle size={16} /> Edge cases
          </h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300 text-left">
                <th className="py-1.5 pr-3 font-semibold w-2/5">Situation</th>
                <th className="py-1.5 font-semibold">What you do</th>
              </tr>
            </thead>
            <tbody>
              <Row
                situation="Flat not in the dashboard"
                action="Hand them your phone (or tell them rmvclustersphase2.in/stickers) → ask them to fill the form. Then search again."
              />
              <Row
                situation="MyGate not set up"
                action="Show the 1-min tutorial: https://youtu.be/0xOrzlr7SOs. Walk them through adding one vehicle. Then issue."
              />
              <Row
                situation="Wants extra stickers (new car / bike)"
                action="Ask them to update the form first (so the count is right), then issue the new ones. Add a note in 'Admin Note' on their row."
              />
              <Row
                situation="Tenant collecting (not owner)"
                action="Self-serve — issue normally. No owner approval needed."
              />
              <Row
                situation="Damaged sticker"
                action="Replace from the spare pile. Add a note in 'Admin Note' so we can track wastage."
              />
              <Row
                situation="Someone collecting on behalf of a flat"
                action="Confirm they can name the flat owner. Issue the stickers; flag in 'Admin Note' if anything feels off."
              />
              <Row
                situation="Self-collected chip is amber but they're asking for stickers"
                action="They probably ticked the wrong box online. Ask them to confirm — if they really don't have stickers, click the amber pill to flip back to Pending, then hand over and click Issued."
              />
            </tbody>
          </table>
        </section>

        {/* Things you can't do */}
        <section className="mb-5">
          <h2 className="text-base font-bold uppercase tracking-wider text-gray-700 print:text-black mb-2 flex items-center gap-2">
            <CheckSquare size={16} /> What&apos;s locked
          </h2>
          <p className="text-sm">
            Facility Manager access lets you <strong>view</strong> the
            dashboard, <strong>search</strong>, mark rows{" "}
            <strong>Issued / Pending</strong>, and{" "}
            <strong>export the CSV</strong>. You cannot{" "}
            <strong>delete</strong> a resident&apos;s submission. If you
            spot a clearly fake row, message an admin instead — they&apos;ll
            handle removal.
          </p>
        </section>

        {/* Where to stick (so the manager can remind residents) */}
        <section className="mb-5">
          <h2 className="text-base font-bold uppercase tracking-wider text-gray-700 print:text-black mb-2">
            Remind residents before they leave
          </h2>
          <div className="rounded-md border-2 border-black p-3 bg-yellow-50 print:bg-yellow-50 text-sm">
            <p className="font-bold mb-1">
              🚨 Sticker visible → guard waves you through. No sticker →
              guard stops every entry.
            </p>
            <ul className="space-y-1 pl-1 mt-2 text-xs">
              <li>
                🚗 <strong>Car:</strong> top corner of windshield, on the
                side closest to the guard cabin. Clean the glass first.
              </li>
              <li>
                🛵 <strong>Bike / scooter:</strong> front fairing or below
                the headlight.
              </li>
              <li>
                🚫 Peel off old security agency stickers.
              </li>
            </ul>
          </div>
        </section>

        {/* Footer / contacts */}
        <section className="border-t border-gray-200 pt-3">
          <h2 className="text-base font-bold uppercase tracking-wider text-gray-700 print:text-black mb-2 flex items-center gap-2">
            <Phone size={16} /> If something&apos;s broken
          </h2>
          <ul className="text-sm space-y-1 pl-1">
            <li>
              Dashboard not loading or counts look wrong →{" "}
              <strong>message an admin</strong>.
            </li>
            <li>
              Resident insists they registered but you don&apos;t see them →
              ask them to refresh and resubmit at{" "}
              <strong>/stickers</strong>.
            </li>
            <li>
              Out-of-stock on a sticker type → flag to admin same day so we
              can print more.
            </li>
          </ul>
        </section>

        <footer className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500 print:text-gray-600 flex flex-col sm:flex-row sm:justify-between gap-1">
          <span>
            Dashboard:{" "}
            <strong>rmvclustersphase2.in/admin/stickers</strong>
          </span>
          <span>
            Public form: <strong>rmvclustersphase2.in/stickers</strong>
          </span>
        </footer>
      </article>

      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}

function Row({ situation, action }: { situation: string; action: string }) {
  return (
    <tr className="border-b border-gray-200 align-top">
      <td className="py-1.5 pr-3 font-medium">{situation}</td>
      <td className="py-1.5">{action}</td>
    </tr>
  );
}
