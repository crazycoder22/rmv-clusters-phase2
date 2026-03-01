"use client";

import { useState, useEffect, useRef, useCallback, use } from "react";
import { useRole } from "@/hooks/useRole";
import Link from "next/link";
import clsx from "clsx";
import { formatDate } from "@/lib/utils";

interface PassData {
  type: "resident" | "guest";
  passCode: string;
  eventTitle: string;
  eventDate: string;
  announcementId: string;
  name: string;
  block: number;
  flatNumber: string;
  hasFood: boolean;
  items: { name: string; plates: number; pricePerPlate: number }[];
  paid: boolean;
  attended: boolean;
  attendedAt: string | null;
  notes: string | null;
  createdAt: string;
  fieldResponses?: { label: string; value: string }[];
}

interface AttendanceResult {
  alreadyAttended: boolean;
  attendedAt: string;
}

interface ScanHistoryEntry {
  passCode: string;
  name: string;
  type: "resident" | "guest";
  paid: boolean;
  attended: boolean;
  scannedAt: Date;
}

function extractPassCode(text: string): string | null {
  // Handle full URL: https://www.rmvclustersphase2.in/pass/r-abc123
  const urlMatch = text.match(/\/pass\/((?:r|g)-.+)$/);
  if (urlMatch) return urlMatch[1];

  // Handle raw code: r-abc123 or g-abc123
  const codeMatch = text.match(/^(r|g)-.+$/);
  if (codeMatch) return text;

  return null;
}

export default function AdminScannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role, isAdmin, isSuperAdmin, isLoading: roleLoading } = useRole();

  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [passData, setPassData] = useState<PassData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [togglingPaid, setTogglingPaid] = useState(false);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [attendanceResult, setAttendanceResult] = useState<AttendanceResult | null>(null);
  const [markingAttendance, setMarkingAttendance] = useState(false);

  const scannerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrCodeRef = useRef<any>(null);

  const markAttendance = useCallback(async (passCode: string) => {
    setMarkingAttendance(true);
    try {
      const res = await fetch(`/api/pass/${passCode}/attend`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setAttendanceResult({
          alreadyAttended: data.alreadyAttended,
          attendedAt: data.attendedAt,
        });
        // Update history
        setHistory((prev) =>
          prev.map((h) =>
            h.passCode === passCode ? { ...h, attended: true } : h
          )
        );
      }
    } catch {
      // silently fail — attendance marking is best-effort
    } finally {
      setMarkingAttendance(false);
    }
  }, []);

  const fetchPassDetails = useCallback(async (passCode: string) => {
    setLoading(true);
    setError("");
    setPassData(null);
    setAttendanceResult(null);

    try {
      const res = await fetch(`/api/pass/${passCode}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Pass not found");
        return;
      }
      const data: PassData = await res.json();
      setPassData(data);

      // Add to scan history
      setHistory((prev) => [
        {
          passCode: data.passCode,
          name: data.name,
          type: data.type,
          paid: data.paid,
          attended: true, // will be marked attended
          scannedAt: new Date(),
        },
        ...prev.filter((h) => h.passCode !== data.passCode),
      ]);

      // Auto-mark attendance
      markAttendance(passCode);
    } catch {
      setError("Failed to look up pass");
    } finally {
      setLoading(false);
    }
  }, [markAttendance]);

  const startScanner = useCallback(async () => {
    if (!scannerRef.current) return;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText: string) => {
          const code = extractPassCode(decodedText);
          if (code) {
            scanner.stop().catch(() => {});
            setScanning(false);
            fetchPassDetails(code);
          }
        },
        () => {} // Ignore scan failures
      );
      setScanning(true);
    } catch (err) {
      console.error("Scanner error:", err);
      setError("Failed to start camera. Please check permissions.");
    }
  }, [fetchPassDetails]);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch {
        // ignore
      }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleManualLookup = () => {
    const code = extractPassCode(manualCode.trim());
    if (!code) {
      setError("Invalid code format. Use r-{id} or g-{id} or paste the full pass URL.");
      return;
    }
    fetchPassDetails(code);
    setManualCode("");
  };

  const handleScanAnother = async () => {
    setPassData(null);
    setError("");
    setAttendanceResult(null);
    startScanner();
  };

  const togglePaid = async () => {
    if (!passData) return;
    setTogglingPaid(true);

    try {
      const rsvpId = passData.passCode.split("-").slice(1).join("-");
      const url = passData.type === "guest"
        ? `/api/admin/events/${passData.announcementId}/rsvps/guest/${rsvpId}`
        : `/api/admin/events/${passData.announcementId}/rsvps/${rsvpId}`;

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: !passData.paid }),
      });

      if (res.ok) {
        setPassData({ ...passData, paid: !passData.paid });
        // Update history too
        setHistory((prev) =>
          prev.map((h) =>
            h.passCode === passData.passCode ? { ...h, paid: !passData.paid } : h
          )
        );
      }
    } catch {
      // silently fail
    } finally {
      setTogglingPaid(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isAdmin() && !isSuperAdmin()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-500">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const totalAmount = passData
    ? passData.items.reduce((sum, item) => sum + item.plates * item.pricePerPlate, 0)
    : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link
        href={`/admin/events/${id}/rsvps`}
        className="text-sm text-primary-600 hover:text-primary-700 font-medium mb-6 inline-block"
      >
        &larr; Back to RSVP Tracking
      </Link>

      <h1 className="text-2xl font-bold text-primary-800 mb-1">QR Scanner</h1>
      <p className="text-gray-500 text-sm mb-6">
        Scan an event pass QR code or enter a code manually.
      </p>

      {/* Scanner Section */}
      {!passData && (
        <div className="mb-8">
          {/* Camera Scanner */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
            <div
              id="qr-reader"
              ref={scannerRef}
              className="w-full"
              style={{ minHeight: scanning ? 300 : 0 }}
            />
            {!scanning && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-50 flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9V6a3 3 0 013-3h3M15 3h3a3 3 0 013 3v3M21 15v3a3 3 0 01-3 3h-3M9 21H6a3 3 0 01-3-3v-3" />
                    <rect x="7" y="7" width="10" height="10" rx="1" strokeWidth={1.5} />
                  </svg>
                </div>
                <button
                  onClick={startScanner}
                  className="px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Start Camera
                </button>
              </div>
            )}
            {scanning && (
              <div className="p-3 text-center">
                <button
                  onClick={stopScanner}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Stop Camera
                </button>
              </div>
            )}
          </div>

          {/* Manual Entry */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">
              Or enter code manually
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
                placeholder="e.g., r-clxyz123... or paste URL"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <button
                onClick={handleManualLookup}
                disabled={!manualCode.trim() || loading}
                className="px-4 py-2 bg-gray-800 text-white font-medium rounded-md hover:bg-gray-900 disabled:opacity-50 text-sm transition-colors"
              >
                Look Up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8">
          <p className="text-gray-500">Looking up pass...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-6">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={() => setError("")}
            className="text-xs text-red-600 hover:text-red-700 font-medium mt-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Scan Result */}
      {passData && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          {/* Attendance Status Header */}
          {markingAttendance ? (
            <div className="bg-blue-50 border-b border-blue-200 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-blue-400 flex items-center justify-center animate-pulse">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-blue-800">Marking attendance...</span>
              </div>
            </div>
          ) : attendanceResult?.alreadyAttended ? (
            <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-medium text-amber-800">Already Checked In</span>
                  <p className="text-xs text-amber-600">
                    at{" "}
                    {new Date(attendanceResult.attendedAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <span
                className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                  passData.type === "guest"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {passData.type === "guest" ? "Guest" : "Resident"}
              </span>
            </div>
          ) : (
            <div className="bg-green-50 border-b border-green-200 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-green-800">
                  {attendanceResult ? "Checked In" : "Pass Verified"}
                </span>
              </div>
              <span
                className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                  passData.type === "guest"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {passData.type === "guest" ? "Guest" : "Resident"}
              </span>
            </div>
          )}

          {/* Details */}
          <div className="px-5 py-4 space-y-3">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Event</p>
              <p className="text-sm font-medium text-gray-900">{passData.eventTitle}</p>
              <p className="text-xs text-gray-500">{formatDate(passData.eventDate)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Name</p>
                <p className="text-sm font-semibold text-gray-900">{passData.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Location</p>
                <p className="text-sm font-medium text-gray-800">
                  B{passData.block} - {passData.flatNumber}
                </p>
              </div>
            </div>

            {/* Items */}
            {passData.hasFood && passData.items.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Items</p>
                {passData.items.map((item) => (
                  <div key={item.name} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.name} &times; {item.plates}
                    </span>
                    <span className="text-gray-500">
                      {"\u20B9"}{(item.plates * item.pricePerPlate).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-semibold mt-1 pt-1 border-t border-gray-100">
                  <span>Total</span>
                  <span>{"\u20B9"}{totalAmount.toFixed(2)}</span>
                </div>
              </div>
            )}

            {passData.notes && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Notes</p>
                <p className="text-sm text-gray-600">{passData.notes}</p>
              </div>
            )}

            {passData.fieldResponses && passData.fieldResponses.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Additional Info</p>
                {passData.fieldResponses.map((fr, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-500">{fr.label}</span>
                    <span className="text-gray-800 font-medium">{fr.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Toggle */}
          {passData.hasFood && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-600">Payment Status</span>
              <button
                onClick={togglePaid}
                disabled={togglingPaid}
                className={clsx(
                  "px-3 py-1 text-sm font-medium rounded-full transition-colors disabled:opacity-50",
                  passData.paid
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-red-100 text-red-600 hover:bg-red-200"
                )}
              >
                {togglingPaid ? "..." : passData.paid ? "Paid" : "Unpaid"}
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
            <button
              onClick={handleScanAnother}
              className="w-full py-2 px-4 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 transition-colors text-sm"
            >
              Scan Another Pass
            </button>
          </div>
        </div>
      )}

      {/* Scan History */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">
              Scan History ({history.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-50">
            {history.map((entry) => (
              <div
                key={entry.passCode}
                className="px-5 py-2.5 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800">{entry.name}</p>
                    {entry.type === "guest" && (
                      <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 text-purple-700">
                        Guest
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {entry.scannedAt.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {entry.attended && (
                    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                      Attended
                    </span>
                  )}
                  <span
                    className={clsx(
                      "inline-block px-2 py-0.5 text-xs font-medium rounded-full",
                      entry.paid
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    )}
                  >
                    {entry.paid ? "Paid" : "Unpaid"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
