"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Shield,
  HeartPulse,
  Siren,
  Phone,
  BookOpen,
  Image,
  HelpCircle,
  Newspaper,
  ChevronRight,
  Wrench,
} from "lucide-react";
import siteData from "@/data/site.json";
import { formatDate } from "@/lib/utils";
import NewsFeed from "@/components/news/NewsFeed";

// Emergency contact icon mapping (same as contact page)
const emergencyIconMap: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  shield: Shield,
  "heart-pulse": HeartPulse,
  siren: Siren,
  phone: Phone,
};

interface SearchResult {
  name: string;
  block: number;
  flatNumber: string;
}

interface RsvpRegistration {
  id: string;
  announcementId: string;
  eventTitle: string;
  eventDate: string;
  mealType: string;
  totalPlates: number;
  paid: boolean;
}

interface SportsRegistration {
  id: string;
  announcementId: string;
  eventTitle: string;
  eventDate: string;
  participantCount: number;
  sports: string[];
}

const quickLinks = [
  { href: "/guidelines", label: "Guidelines", icon: BookOpen, color: "bg-blue-50 text-blue-600" },
  { href: "/gallery", label: "Gallery", icon: Image, color: "bg-green-50 text-green-600" },
  { href: "/faq", label: "FAQ", icon: HelpCircle, color: "bg-amber-50 text-amber-600" },
  { href: "/contact", label: "Contact", icon: Phone, color: "bg-purple-50 text-purple-600" },
  { href: "/news", label: "News", icon: Newspaper, color: "bg-red-50 text-red-600" },
  { href: "/issues", label: "Issues", icon: Wrench, color: "bg-orange-50 text-orange-600" },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Registration state
  const [rsvps, setRsvps] = useState<RsvpRegistration[]>([]);
  const [sportsRegs, setSportsRegs] = useState<SportsRegistration[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(true);

  // Auth guard
  useEffect(() => {
    if (status !== "loading" && (!session?.user || !session.user.isRegistered)) {
      router.replace("/");
    }
  }, [status, session, router]);

  // Fetch my registrations
  useEffect(() => {
    if (status === "authenticated" && session?.user?.isRegistered) {
      fetch("/api/residents/my-registrations")
        .then((res) => (res.ok ? res.json() : { rsvps: [], sportsRegistrations: [] }))
        .then((data) => {
          setRsvps(data.rsvps || []);
          setSportsRegs(data.sportsRegistrations || []);
        })
        .catch(() => {})
        .finally(() => setLoadingRegs(false));
    }
  }, [status, session]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/residents/search?q=${encodeURIComponent(searchQuery.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.residents);
        }
      } catch {
        // silently fail
      } finally {
        setSearching(false);
        setHasSearched(true);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Loading / redirect states
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!session?.user?.isRegistered) {
    return null; // will redirect
  }

  const firstName = session.user.name?.split(" ")[0] || "Resident";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primary-800">
          Welcome back, {firstName}!
        </h1>
        <p className="text-gray-500 mt-1">Your resident dashboard</p>
      </div>

      {/* Section 1: Resident Directory Search */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Search size={20} className="text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-800">
            Resident Directory
          </h2>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, block, or flat number..."
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
        />

        {searching && (
          <p className="text-sm text-gray-400 mt-3">Searching...</p>
        )}

        {!searching && hasSearched && searchResults.length === 0 && (
          <p className="text-sm text-gray-400 mt-3 italic">
            No residents found for &quot;{searchQuery}&quot;
          </p>
        )}

        {searchResults.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Block</th>
                  <th className="pb-2 font-medium">Flat</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((r, i) => (
                  <tr
                    key={`${r.block}-${r.flatNumber}-${i}`}
                    className="border-b border-gray-50"
                  >
                    <td className="py-2.5 pr-4 font-medium text-gray-900">
                      {r.name}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">
                      Block {r.block}
                    </td>
                    <td className="py-2.5 text-gray-600">{r.flatNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2 + 3: Emergency Contacts + Quick Links (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Emergency Contacts */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Emergency Contacts
          </h2>
          <div className="space-y-3">
            {siteData.emergencyContacts.map((contact) => {
              const IconComp = emergencyIconMap[contact.icon] || Phone;
              return (
                <a
                  key={contact.name}
                  href={`tel:${contact.phone.split(",")[0].trim()}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <IconComp size={18} className="text-red-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-primary-700">
                      {contact.name}
                    </p>
                    <p className="text-xs text-gray-400">{contact.phone}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Quick Links
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickLinks.map((link) => {
              const IconComp = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-100 hover:border-primary-200 hover:shadow-sm transition-all group"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${link.color}`}
                  >
                    <IconComp size={20} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 4: My Upcoming Registrations */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          My Upcoming Registrations
        </h2>

        {loadingRegs ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : rsvps.length === 0 && sportsRegs.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No upcoming registrations. Check the news feed for events!
          </p>
        ) : (
          <div className="space-y-3">
            {rsvps.map((r) => (
              <Link
                key={r.id}
                href={`/events/${r.announcementId}/rsvp`}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition-all group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 capitalize">
                      {r.mealType}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                        r.paid
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {r.paid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {r.eventTitle}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(r.eventDate)} &middot; {r.totalPlates} plate
                    {r.totalPlates !== 1 ? "s" : ""}
                  </p>
                </div>
                <ChevronRight
                  size={18}
                  className="text-gray-300 group-hover:text-primary-500 shrink-0"
                />
              </Link>
            ))}

            {sportsRegs.map((sr) => (
              <Link
                key={sr.id}
                href={`/events/${sr.announcementId}/sports`}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-orange-200 hover:bg-orange-50/30 transition-all group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                      Sports
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {sr.eventTitle}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(sr.eventDate)} &middot; {sr.participantCount}{" "}
                    participant{sr.participantCount !== 1 ? "s" : ""} &middot;{" "}
                    {sr.sports.join(", ")}
                  </p>
                </div>
                <ChevronRight
                  size={18}
                  className="text-gray-300 group-hover:text-orange-500 shrink-0"
                />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Section 5: News Feed */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Latest News
        </h2>
        <NewsFeed />
      </div>
    </div>
  );
}
