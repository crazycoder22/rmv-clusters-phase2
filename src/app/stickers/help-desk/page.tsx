"use client";

// Printable help-desk SOP — one A4 page, designed for volunteers to tape
// to the table at the help desk. Click "Print" in browser → File → Print.
// Built as a regular page (not PDF) so it's easy to tweak without rebuild.

import Link from "next/link";
import {
  Printer,
  ArrowLeft,
  CheckSquare,
  AlertTriangle,
  Phone,
} from "lucide-react";

export default function HelpDeskSopPage() {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen py-6 print:bg-white print:py-0">
      {/* Screen-only toolbar */}
      <div className="max-w-3xl mx-auto px-4 mb-4 flex items-center justify-between print:hidden">
        <Link
          href="/stickers"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400"
        >
          <ArrowLeft size={14} /> Back to /stickers
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
        >
          <Printer size={14} />
          Print this sheet
        </button>
      </div>

      {/* The sheet itself */}
      <article className="max-w-3xl mx-auto bg-white dark:bg-gray-800 print:bg-white border border-gray-200 dark:border-gray-700 print:border-0 rounded-xl print:rounded-none shadow-sm print:shadow-none px-6 py-6 sm:px-8 sm:py-8 print:px-0 print:py-0 text-gray-800 print:text-black">
        {/* Header */}
        <header className="border-b-2 border-gray-300 pb-3 mb-4">
          <h1 className="text-2xl font-bold">
            🚗 Vehicle Sticker Help Desk — Volunteer Cheat Sheet
          </h1>
          <p className="mt-1 text-sm text-gray-600 print:text-gray-700">
            New security agency goes live <strong>25 May 2026</strong>.
            Vehicles without stickers from 26 May = visitor entry.
          </p>
        </header>

        {/* Setup checklist */}
        <section className="mb-5">
          <h2 className="text-base font-bold uppercase tracking-wider text-gray-700 print:text-black mb-2 flex items-center gap-2">
            <CheckSquare size={16} /> Before residents arrive
          </h2>
          <ul className="text-sm space-y-1 pl-1">
            <li>☐ Open <strong>rmvclustersphase2.in/admin/stickers</strong> on laptop / tablet (sign in as admin)</li>
            <li>☐ Mobile hotspot ready (in case WiFi drops)</li>
            <li>☐ Stickers sorted into two trays: <strong>4-wheeler</strong> + <strong>2-wheeler</strong></li>
            <li>☐ Keep <strong>5–10 spare</strong> stickers for damaged ones during application</li>
            <li>☐ Pen, marker, scissors</li>
            <li>☐ Tape this sheet on the table for quick reference</li>
            <li>☐ QR code printout pointing to <strong>rmvclustersphase2.in/stickers</strong> (for residents who haven&apos;t filled the form)</li>
          </ul>
        </section>

        {/* Per-resident flow */}
        <section className="mb-5">
          <h2 className="text-base font-bold uppercase tracking-wider text-gray-700 print:text-black mb-2">
            👉 For each resident
          </h2>
          <ol className="text-sm space-y-2 list-decimal pl-5">
            <li>
              <strong>Ask:</strong> Block? Flat?
            </li>
            <li>
              <strong>Search</strong> in the admin dashboard (search box) →
              find the row.
            </li>
            <li>
              <strong>Glance at the chips under the name:</strong>
              <ul className="mt-1 list-disc pl-5 text-xs">
                <li>
                  Green <strong>MyGate ✓</strong> chip → skip step 5 (no
                  need to ask them to show MyGate)
                </li>
                <li>
                  Amber <strong>Self-collected</strong> chip → they already
                  have stickers, just confirm the count and wave them off
                </li>
              </ul>
            </li>
            <li>
              <strong>Confirm verbally:</strong> &ldquo;You need{" "}
              <em>X cars</em> and <em>Y bikes</em>, right?&rdquo;
            </li>
            <li>
              <strong>Show me MyGate</strong> (only if the chip isn&apos;t
              green): ask the resident to open MyGate → Vehicles. Even one
              vehicle registered there is enough proof.
            </li>
            <li>
              <strong>Hand over the stickers.</strong>
            </li>
            <li>
              <strong>Click &ldquo;Pending → Issued&rdquo;</strong> on the
              dashboard. (Records your name + timestamp automatically.)
            </li>
          </ol>
          <p className="mt-2 text-xs italic text-gray-600 print:text-gray-700">
            No photo ID required. Knowing the flat + having MyGate set up is
            enough verification.
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
                situation="Resident hasn't filled the form"
                action="Hand them the QR / a phone → fill /stickers there. Then continue normal flow."
              />
              <Row
                situation="MyGate not set up yet"
                action="Pull up the tutorial video, walk them through adding one vehicle. Then issue."
              />
              <Row
                situation="Wants more than they submitted"
                action="Admin's discretion — issue if reasonable. Add a note in the 'Admin Note' field."
              />
              <Row
                situation="Tenant collecting (not owner)"
                action="Self-serve — issue normally. Tenant just needs to know the flat + have MyGate."
              />
              <Row
                situation="Damaged sticker during peel/apply"
                action="Replace from spare pile. Mention in admin note."
              />
              <Row
                situation="Resident out of town"
                action="Mark in admin note 'will collect later'. Direct them to 25 May gate pickup or Block 2 office."
              />
              <Row
                situation="Wants more stickers (extra vehicle bought)"
                action="Take their request. Stickers can be issued later from Block 2 office."
              />
            </tbody>
          </table>
        </section>

        {/* Alternative pickup */}
        <section className="mb-5">
          <h2 className="text-base font-bold uppercase tracking-wider text-gray-700 print:text-black mb-2 flex items-center gap-2">
            <Phone size={16} /> If they can&apos;t come tomorrow
          </h2>
          <ul className="text-sm space-y-1 pl-1">
            <li>
              <strong>25 May (Mon) morning</strong> — near the main gate.
            </li>
            <li>
              <strong>Block 2 office</strong> — manager has spare stickers any
              working day.
            </li>
            <li>
              <strong>Out of station &gt; 25 May</strong> — admin note
              &ldquo;collect on return&rdquo;.
            </li>
          </ul>
        </section>

        {/* Where to stick — important: tell each resident this before they leave */}
        <section className="mb-3">
          <h2 className="text-base font-bold uppercase tracking-wider text-gray-700 print:text-black mb-2">
            Tell every resident before they leave
          </h2>
          <div className="rounded-md border-2 border-black p-3 bg-yellow-50 print:bg-yellow-50 text-sm">
            <p className="font-bold text-base mb-2">
              🚨 Sticker visible from outside → security waves you through.
              No sticker → guard stops and checks every entry.
            </p>
            <p className="font-semibold mt-3 mb-1">Where to stick:</p>
            <ul className="space-y-1 pl-1">
              <li>
                🚗 <strong>Car:</strong> top corner of windshield, on the side
                closest to the guard cabin. Clean the glass first so it
                sticks properly.
              </li>
              <li>
                🛵 <strong>Bike / scooter:</strong> front fairing or just
                below the headlight — visible to the guard as the bike rolls
                in.
              </li>
              <li>
                Remind them to <strong>peel off old stickers</strong> from
                the previous agency.
              </li>
            </ul>
          </div>
        </section>

        <footer className="mt-4 pt-3 border-t border-gray-200 text-xs text-gray-500 print:text-gray-600 flex flex-col sm:flex-row sm:justify-between gap-1">
          <span>
            Admin dashboard:{" "}
            <strong>rmvclustersphase2.in/admin/stickers</strong>
          </span>
          <span>
            Public form: <strong>rmvclustersphase2.in/stickers</strong>
          </span>
        </footer>
      </article>

      {/* Print-only sizing: try to keep it to a single A4 sheet */}
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
