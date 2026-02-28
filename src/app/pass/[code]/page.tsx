"use client";

import { useState, useEffect, useRef, use } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
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
  notes: string | null;
  createdAt: string;
}

export default function PassPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [pass, setPass] = useState<PassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const passUrl = typeof window !== "undefined"
    ? `${window.location.origin}/pass/${code}`
    : `/pass/${code}`;

  useEffect(() => {
    async function fetchPass() {
      try {
        const res = await fetch(`/api/pass/${code}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Pass not found");
          return;
        }
        const data = await res.json();
        setPass(data);
      } catch {
        setError("Failed to load pass");
      } finally {
        setLoading(false);
      }
    }
    fetchPass();
  }, [code]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `event-pass-${code}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to generate image. Please try taking a screenshot instead.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading pass...</p>
      </div>
    );
  }

  if (error || !pass) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Pass Not Found</h1>
          <p className="text-gray-500">{error || "This pass does not exist."}</p>
        </div>
      </div>
    );
  }

  const totalAmount = pass.items.reduce(
    (sum, item) => sum + item.plates * item.pricePerPlate,
    0
  );
  const totalPlates = pass.items.reduce((sum, item) => sum + item.plates, 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Pass Card */}
        <div
          ref={cardRef}
          className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200"
        >
          {/* Header */}
          <div className="bg-primary-700 px-6 py-4 text-white">
            <p className="text-xs font-medium tracking-widest uppercase opacity-80">
              RMV Clusters Phase II
            </p>
            <h1 className="text-xl font-bold mt-1">Event Pass</h1>
          </div>

          {/* Event Info */}
          <div className="px-6 pt-5 pb-4 border-b border-dashed border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">{pass.eventTitle}</h2>
            <p className="text-sm text-gray-500 mt-1">{formatDate(pass.eventDate)}</p>
          </div>

          {/* Person Info */}
          <div className="px-6 py-4 border-b border-dashed border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Name</p>
                <p className="text-base font-semibold text-gray-900">{pass.name}</p>
              </div>
              <span
                className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                  pass.type === "guest"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {pass.type === "guest" ? "Guest" : "Resident"}
              </span>
            </div>
            <div className="mt-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Location</p>
              <p className="text-sm font-medium text-gray-800">
                Block {pass.block} &mdash; Flat {pass.flatNumber}
              </p>
            </div>
          </div>

          {/* QR Code */}
          <div className="px-6 py-5 flex justify-center">
            <div className="p-3 bg-white border-2 border-gray-100 rounded-xl">
              <QRCodeSVG
                value={passUrl}
                size={200}
                level="M"
                includeMargin={false}
              />
            </div>
          </div>

          {/* Items (food events only) */}
          {pass.hasFood && pass.items.length > 0 && (
            <div className="px-6 pb-4 border-t border-dashed border-gray-200 pt-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                Items Ordered
              </p>
              <div className="space-y-1">
                {pass.items.map((item) => (
                  <div key={item.name} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.name} &times; {item.plates}
                    </span>
                    <span className="text-gray-500">
                      {"\u20B9"}{(item.plates * item.pricePerPlate).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t border-gray-100">
                <span className="text-gray-800">
                  Total ({totalPlates} plate{totalPlates !== 1 ? "s" : ""})
                </span>
                <span className="text-gray-900">{"\u20B9"}{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Payment Status (food events only) */}
          {pass.hasFood && (
            <div className="px-6 pb-5">
              <div
                className={`rounded-lg p-2.5 text-center text-sm font-medium ${
                  pass.paid
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {pass.paid ? "Payment Received" : "Payment Pending"}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-3 text-center">
            <p className="text-[10px] text-gray-400">
              Show this pass at the event entrance for verification
            </p>
          </div>
        </div>

        {/* Download Button (outside the card for html2canvas) */}
        <div className="mt-6 text-center">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {downloading ? "Generating..." : "Download as Image"}
          </button>
        </div>
      </div>
    </div>
  );
}
