import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How RMV Clusters Phase 2 handles your data on our website and mobile app.",
};

const LAST_UPDATED = "28 April 2026";

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Privacy Policy
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
        Last updated: {LAST_UPDATED}
      </p>

      <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none space-y-6">
        <section>
          <p>
            This policy explains how the <strong>RMV Clusters Phase 2</strong>{" "}
            community website (rmvclustersphase2.in) and mobile app handle the
            information you share with us. The site and the iOS/Android apps
            are run by community volunteers for residents — there is no
            commercial entity behind them and no advertising network.
          </p>
        </section>

        <section>
          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>From Google Sign-In:</strong> name, email address, and
              profile photo. Used only to identify you as a resident.
            </li>
            <li>
              <strong>From your resident profile:</strong> phone number, block,
              flat number, role (resident / admin / facility manager / SOS
              warrior). Provided by you during registration or imported from
              MyGate where you've already shared it.
            </li>
            <li>
              <strong>Activity you create:</strong> game scores, RSVPs to
              events, posts on the community feed, comments, poll votes,
              maintenance issues you raise. Linked to your resident profile
              unless explicitly anonymous (e.g. anonymous polls).
            </li>
            <li>
              <strong>Visitor logs:</strong> imported from MyGate by community
              admins to help you see who visited your flat. Not collected by
              us directly.
            </li>
            <li>
              <strong>Technical:</strong> standard server logs (IP address,
              browser/app version, request timestamps). Used for debugging and
              kept for at most 30 days.
            </li>
          </ul>
        </section>

        <section>
          <h2>What we don't collect</h2>
          <ul>
            <li>
              No analytics or tracking SDKs (no Google Analytics, no Facebook
              Pixel, no Mixpanel, no Sentry, etc.).
            </li>
            <li>No location data.</li>
            <li>No camera, microphone, or contacts access.</li>
            <li>
              No advertising identifiers. We do not sell, rent, or share your
              data with anyone for advertising or any other commercial purpose.
            </li>
          </ul>
        </section>

        <section>
          <h2>Where your data lives</h2>
          <p>
            Data is stored in a managed PostgreSQL database (Neon, hosted in
            Singapore) and uploaded images/files in Vercel Blob (also in
            Singapore). The site runs on Vercel. None of this data leaves
            those providers.
          </p>
        </section>

        <section>
          <h2>Who can see what</h2>
          <ul>
            <li>
              <strong>Public pages</strong> (event registrations from outside
              residents, e.g. a hearing camp): the registration form is
              public, but registrant lists are visible to admins only.
            </li>
            <li>
              <strong>Community feed posts &amp; comments</strong> are visible
              to all logged-in residents.
            </li>
            <li>
              <strong>Polls:</strong> votes are public unless the poll is
              marked anonymous, in which case only the aggregate count is
              shown.
            </li>
            <li>
              <strong>Visitor log:</strong> each resident sees only their own
              flat's visitor history. Admins can see society-wide stats.
            </li>
            <li>
              <strong>SOS Warrior phone numbers</strong> are visible to all
              logged-in residents (they opt in to be listed).
            </li>
          </ul>
        </section>

        <section>
          <h2>Mobile app specifics</h2>
          <p>The iOS and Android apps:</p>
          <ul>
            <li>
              Sign you in via native Google Sign-In. Your Apple ID, iCloud,
              and other Google accounts are not accessed.
            </li>
            <li>
              Store a session token (JWT) in the device's secure preferences
              storage so you stay signed in. Tap "Sign out" to clear it.
            </li>
            <li>
              Use the same{" "}
              <Link
                href="https://www.rmvclustersphase2.in"
                className="text-primary-600 hover:underline"
              >
                rmvclustersphase2.in
              </Link>{" "}
              backend as the website. No separate data store.
            </li>
            <li>
              Open external links (e.g. payment QR / YouTube how-to) in
              Apple's in-app Safari view. We do not see what you do there.
            </li>
          </ul>
        </section>

        <section>
          <h2>Children</h2>
          <p>
            The community is family-oriented and children under 13 may use
            the games. They cannot sign in independently — Google Sign-In
            requires an adult Google account. Any use by a child should be
            supervised by a parent.
          </p>
        </section>

        <section>
          <h2>Your rights</h2>
          <ul>
            <li>
              <strong>Access:</strong> you can see all your own data through
              your resident profile and the various activity pages.
            </li>
            <li>
              <strong>Correction:</strong> name / phone / flat updates are
              handled by community admins — write to us at{" "}
              <a
                href="mailto:rmvclustersphase2@gmail.com"
                className="text-primary-600 hover:underline"
              >
                rmvclustersphase2@gmail.com
              </a>
              .
            </li>
            <li>
              <strong>Deletion:</strong> request and we'll remove your
              resident record and associated activity. Mention the same email
              you signed in with.
            </li>
          </ul>
        </section>

        <section>
          <h2>Changes</h2>
          <p>
            If we change this policy materially, we'll post an announcement
            in the News feed. The "Last updated" date at the top will always
            reflect the most recent change.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Questions about this policy or your data:{" "}
            <a
              href="mailto:rmvclustersphase2@gmail.com"
              className="text-primary-600 hover:underline"
            >
              rmvclustersphase2@gmail.com
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Link
          href="/"
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          ← Back to RMV Clusters
        </Link>
      </div>
    </main>
  );
}
