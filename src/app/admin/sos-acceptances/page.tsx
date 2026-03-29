"use client";

import { useState, useEffect } from "react";
import { useRole } from "@/hooks/useRole";
import {
  Loader2,
  Shield,
  Search,
  Download,
  User,
  Phone,
  Home,
  Calendar,
} from "lucide-react";

interface Acceptance {
  id: string;
  name: string;
  email: string;
  phone: string;
  block: number;
  flatNumber: string;
  createdAt: string;
  resident: { id: string; name: string } | null;
}

export default function SosAcceptancesPage() {
  const { canManageAnnouncements, loading: roleLoading } = useRole();
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [blockFilter, setBlockFilter] = useState("");

  useEffect(() => {
    if (roleLoading || !canManageAnnouncements) return;
    fetch("/api/admin/sos-acceptances")
      .then((r) => r.json())
      .then((data) => setAcceptances(data.acceptances || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [roleLoading, canManageAnnouncements]);

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-600" />
      </div>
    );
  }

  if (!canManageAnnouncements) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">Access denied.</p>
      </div>
    );
  }

  const filtered = acceptances.filter((a) => {
    const matchesSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      a.phone.includes(search) ||
      a.flatNumber.includes(search);
    const matchesBlock = !blockFilter || a.block === parseInt(blockFilter);
    return matchesSearch && matchesBlock;
  });

  const blockCounts = [1, 2, 3, 4].map(
    (b) => acceptances.filter((a) => a.block === b).length
  );

  function exportCsv() {
    const header = "Name,Email,Phone,Block,Flat,Linked Resident,Accepted On";
    const rows = filtered.map(
      (a) =>
        `"${a.name}","${a.email}","${a.phone}",${a.block},"${a.flatNumber}","${a.resident?.name || ""}","${new Date(a.createdAt).toLocaleDateString("en-IN")}"`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sos-acceptances.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <Shield size={20} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              SOS Guidelines Acceptances
            </h1>
            <p className="text-sm text-gray-500">
              {acceptances.length} resident{acceptances.length !== 1 ? "s" : ""}{" "}
              accepted
            </p>
          </div>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Block summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((b) => (
          <button
            key={b}
            onClick={() =>
              setBlockFilter(blockFilter === String(b) ? "" : String(b))
            }
            className={`rounded-lg border p-3 text-center transition-colors ${
              blockFilter === String(b)
                ? "border-red-300 bg-red-50"
                : "border-gray-200 bg-white hover:bg-gray-50"
            }`}
          >
            <p className="text-2xl font-bold text-gray-900">
              {blockCounts[b - 1]}
            </p>
            <p className="text-xs text-gray-500">Block {b}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Search by name, email, phone, or flat..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  #
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Contact
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Block / Flat
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Linked
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Accepted On
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No acceptances found.
                  </td>
                </tr>
              ) : (
                filtered.map((a, i) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">
                          {a.name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{a.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-gray-700">
                        <Phone size={13} className="text-gray-400" />
                        {a.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-gray-700">
                        <Home size={13} className="text-gray-400" />
                        B{a.block} - {a.flatNumber}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {a.resident ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Resident
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Guest
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Calendar size={13} className="text-gray-400" />
                        {new Date(a.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
