"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function RegisterPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({
    phone: "",
    block: "",
    flatNumber: "",
    residentType: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Redirect if not signed in
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Redirect if already registered
  useEffect(() => {
    if (session?.user?.isRegistered) {
      router.push("/");
    }
  }, [session, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/residents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }

      // Trigger session update so isRegistered becomes true
      await update();

      router.push("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold text-primary-800 mb-2">
        Complete Your Registration
      </h1>
      <p className="text-gray-600 mb-8">
        Please provide your details to join the RMV Clusters community.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pre-filled fields (read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            type="text"
            value={session.user?.name ?? ""}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={session.user?.email ?? ""}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
          />
        </div>

        {/* Editable fields */}
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
            <option value="">Select Block</option>
            <option value="1">Block 1</option>
            <option value="2">Block 2</option>
            <option value="3">Block 3</option>
            <option value="4">Block 4</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Flat / Door Number
          </label>
          <input
            type="text"
            name="flatNumber"
            required
            value={form.flatNumber}
            onChange={handleChange}
            placeholder="e.g., 101, G2"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

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
            <option value="">Select Type</option>
            <option value="OWNER">Owner</option>
            <option value="TENANT">Tenant</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 px-4 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Registering..." : "Register"}
        </button>
      </form>
    </div>
  );
}
