"use client";

import { useState, useEffect, useCallback } from "react";
import { useRole } from "@/hooks/useRole";
import clsx from "clsx";

interface ResidentWithRole {
  id: string;
  email: string;
  name: string;
  phone: string;
  block: number;
  flatNumber: string;
  residentType: string;
  role: { name: string };
}

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  block: "",
  flatNumber: "",
  residentType: "",
  roleName: "RESIDENT",
};

export default function AdminPage() {
  const { isSuperAdmin, isLoading } = useRole();
  const [activeTab, setActiveTab] = useState<"add" | "manage">("add");
  const [residents, setResidents] = useState<ResidentWithRole[]>([]);
  const [loadingResidents, setLoadingResidents] = useState(false);

  // Add resident form state
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Role update state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchResidents = useCallback(async () => {
    setLoadingResidents(true);
    try {
      const res = await fetch("/api/admin/residents");
      if (res.ok) {
        const data = await res.json();
        setResidents(data.residents);
      }
    } catch {
      // silently fail, user can retry
    } finally {
      setLoadingResidents(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin()) {
      fetchResidents();
    }
  }, [isSuperAdmin, fetchResidents]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isSuperAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-500">
            You do not have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/residents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      setResidents((prev) => [...prev, data.resident]);
      setForm(emptyForm);
      setSuccess("Resident added successfully!");
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (residentId: string, newRoleName: string) => {
    setUpdatingId(residentId);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ residentId, newRoleName }),
      });

      if (res.ok) {
        const data = await res.json();
        setResidents((prev) =>
          prev.map((r) =>
            r.id === residentId ? { ...r, role: data.resident.role } : r
          )
        );
      }
    } catch {
      // silently fail
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-primary-800 mb-1">
        Admin Dashboard
      </h1>
      <p className="text-gray-500 mb-8">
        Manage residents and roles for RMV Clusters Phase II.
      </p>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("add")}
            className={clsx(
              "pb-3 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === "add"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            Add Resident
          </button>
          <button
            onClick={() => setActiveTab("manage")}
            className={clsx(
              "pb-3 px-1 border-b-2 font-medium text-sm transition-colors",
              activeTab === "manage"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            Manage Roles ({residents.length})
          </button>
        </nav>
      </div>

      {/* Tab: Add Resident */}
      {activeTab === "add" && (
        <div className="max-w-lg">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Add Resident on Behalf
          </h2>

          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 p-3 mb-4">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <form onSubmit={handleAddResident} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                name="name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="Full name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="email@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                required
                value={form.phone}
                onChange={handleChange}
                placeholder="e.g., 9876543210"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Block
                </label>
                <select
                  name="block"
                  required
                  value={form.block}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select</option>
                  <option value="1">Block 1</option>
                  <option value="2">Block 2</option>
                  <option value="3">Block 3</option>
                  <option value="4">Block 4</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flat / Door No.
                </label>
                <input
                  type="text"
                  name="flatNumber"
                  required
                  value={form.flatNumber}
                  onChange={handleChange}
                  placeholder="e.g., 101"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resident Type
                </label>
                <select
                  name="residentType"
                  required
                  value={form.residentType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select</option>
                  <option value="OWNER">Owner</option>
                  <option value="TENANT">Tenant</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  name="roleName"
                  value={form.roleName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="RESIDENT">Resident</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Adding..." : "Add Resident"}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Manage Roles */}
      {activeTab === "manage" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              All Residents
            </h2>
            <button
              onClick={fetchResidents}
              disabled={loadingResidents}
              className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
            >
              {loadingResidents ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loadingResidents && residents.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Loading residents...
            </p>
          ) : residents.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No residents found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Block / Flat</th>
                    <th className="pb-3 pr-4 font-medium">Phone</th>
                    <th className="pb-3 pr-4 font-medium">Type</th>
                    <th className="pb-3 pr-4 font-medium">Role</th>
                    <th className="pb-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {residents.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 pr-4 font-medium text-gray-900">
                        {r.name}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{r.email}</td>
                      <td className="py-3 pr-4 text-gray-600">
                        B{r.block} - {r.flatNumber}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{r.phone}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={clsx(
                            "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                            r.residentType === "OWNER"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                          )}
                        >
                          {r.residentType}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={clsx(
                            "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                            r.role.name === "SUPERADMIN" &&
                              "bg-purple-100 text-purple-700",
                            r.role.name === "ADMIN" &&
                              "bg-green-100 text-green-700",
                            r.role.name === "RESIDENT" &&
                              "bg-gray-100 text-gray-700"
                          )}
                        >
                          {r.role.name}
                        </span>
                      </td>
                      <td className="py-3">
                        {r.role.name === "SUPERADMIN" ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <select
                            value={r.role.name}
                            disabled={updatingId === r.id}
                            onChange={(e) =>
                              handleRoleChange(r.id, e.target.value)
                            }
                            className="text-sm border border-gray-300 rounded px-2 py-1 disabled:opacity-50"
                          >
                            <option value="RESIDENT">Resident</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
