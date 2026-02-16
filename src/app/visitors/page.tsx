"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, Clock } from "lucide-react";
import type { VisitorRecord } from "@/types";

export default function VisitorsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VisitorRecord[]>([]);
  const [searching, setSearching] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [visitingBlock, setVisitingBlock] = useState("");
  const [visitingFlat, setVisitingFlat] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [recentVisitors, setRecentVisitors] = useState<VisitorRecord[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const role = session?.user?.role;
  const hasAccess =
    role === "ADMIN" || role === "SUPERADMIN" || role === "SECURITY";

  // Fetch recent visitors
  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/visitors");
      if (res.ok) {
        const data = await res.json();
        setRecentVisitors(data.visitors);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess) fetchRecent();
  }, [hasAccess, fetchRecent]);

  // Poll for status updates every 30s
  useEffect(() => {
    if (!hasAccess) return;
    const interval = setInterval(fetchRecent, 30000);
    return () => clearInterval(interval);
  }, [hasAccess, fetchRecent]);

  // Debounced search for returning visitors
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/visitors/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.visitors);
        }
      } catch {
        // silently fail
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-fill form from search result
  function fillFromVisitor(visitor: VisitorRecord) {
    setName(visitor.name);
    setPhone(visitor.phone || "");
    setEmail(visitor.email || "");
    setVehicleNumber(visitor.vehicleNumber || "");
    setVisitingBlock(String(visitor.visitingBlock));
    setVisitingFlat(visitor.visitingFlat);
    setSearchQuery("");
    setSearchResults([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) {
      setError("Visitor name is required");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError("Phone number or email is required");
      return;
    }
    if (!visitingBlock) {
      setError("Block number is required");
      return;
    }
    if (!visitingFlat.trim()) {
      setError("Flat number is required");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          vehicleNumber: vehicleNumber.trim() || null,
          visitingBlock: parseInt(visitingBlock),
          visitingFlat: visitingFlat.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.visitor.status === "APPROVED") {
          setSuccess(
            "Visitor auto-approved (no resident registered for this flat)."
          );
        } else {
          setSuccess("Visitor registered. Awaiting resident approval.");
        }
        setName("");
        setPhone("");
        setEmail("");
        setVehicleNumber("");
        setVisitingBlock("");
        setVisitingFlat("");
        fetchRecent();
        setTimeout(() => setSuccess(""), 5000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to register visitor");
      }
    } catch {
      setError("Failed to register visitor");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <p className="text-center text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600">
          You do not have permission to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Visitor Management
      </h1>

      {/* Search returning visitor */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Search size={16} />
          Look up Returning Visitor
        </h2>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by phone number or email..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {searching && (
            <span className="absolute right-3 top-2.5 text-xs text-gray-400">
              Searching...
            </span>
          )}
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100">
            {searchResults.map((v) => (
              <button
                key={v.id}
                onClick={() => fillFromVisitor(v)}
                className="w-full text-left px-4 py-3 hover:bg-primary-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{v.name}</p>
                <p className="text-xs text-gray-500">
                  {v.phone && `Phone: ${v.phone}`}
                  {v.phone && v.email && " · "}
                  {v.email && `Email: ${v.email}`}
                  {" · "}
                  Block {v.visitingBlock}, Flat {v.visitingFlat}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Registration form */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <UserPlus size={16} />
          Register Visitor
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Visitor Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Full name"
            />
          </div>

          {/* Phone & Email row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g. 9876543210"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="visitor@example.com"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 -mt-2">
            At least one of phone or email is required
          </p>

          {/* Vehicle number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Number
            </label>
            <input
              type="text"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="e.g. KA01AB1234"
            />
          </div>

          {/* Visiting Block & Flat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Visiting Block <span className="text-red-500">*</span>
              </label>
              <select
                value={visitingBlock}
                onChange={(e) => setVisitingBlock(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select Block</option>
                <option value="1">Block 1</option>
                <option value="2">Block 2</option>
                <option value="3">Block 3</option>
                <option value="4">Block 4</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Flat Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={visitingFlat}
                onChange={(e) => setVisitingFlat(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="e.g. 101, G2"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {submitting ? "Registering..." : "Register Visitor"}
          </button>
        </form>
      </div>

      {/* Recent visitors */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Clock size={16} />
          Recent Visitors
        </h2>

        {loadingRecent ? (
          <p className="text-sm text-gray-400 text-center py-4">Loading...</p>
        ) : recentVisitors.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No visitors registered yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 font-medium text-gray-600">
                    Name
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">
                    Phone
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">
                    Vehicle
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">
                    Visiting
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-left py-2 px-2 font-medium text-gray-600">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentVisitors.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => router.push(`/visitors/${v.id}`)}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="py-2 px-2 text-gray-900">{v.name}</td>
                    <td className="py-2 px-2 text-gray-600">
                      {v.phone || v.email || "—"}
                    </td>
                    <td className="py-2 px-2 text-gray-600">
                      {v.vehicleNumber || "—"}
                    </td>
                    <td className="py-2 px-2 text-gray-600">
                      B{v.visitingBlock}-{v.visitingFlat}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          v.status === "APPROVED"
                            ? "bg-green-100 text-green-700"
                            : v.status === "REJECTED"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(v.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
