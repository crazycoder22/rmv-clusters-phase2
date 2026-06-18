"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useRequireSignIn } from "@/hooks/useRequireSignIn";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Car, MapPin, IndianRupee } from "lucide-react";

interface SlotInfo {
  label: string;
  location: string | null;
  hourlyRate: number;
  owner: { isMe: boolean };
}

export default function ParkingQRPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [slot, setSlot] = useState<SlotInfo | null>(null);
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);

  useRequireSignIn(status);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/parking/slots/${id}`);
        if (res.ok) {
          const d = await res.json();
          // Only the owner should be able to print the poster
          if (!d.owner?.isMe) { router.push(`/parking/${id}`); return; }
          setSlot(d);
        } else {
          router.push("/parking");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const bookingUrl = origin ? `${origin}/parking/${id}` : "";

  if (loading || !slot) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; }
          .poster { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>

      {/* Controls — screen only */}
      <div className="no-print max-w-2xl mx-auto px-4 py-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Parking poster</h1>
          <p className="text-sm text-gray-500 mt-0.5">Print and stick near your parking slot</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Printer size={16} /> Print poster
        </button>
      </div>

      {/* Poster — shown on screen + printed */}
      <div className="max-w-sm mx-auto px-4 pb-12">
        <div className="poster bg-white rounded-2xl border-2 border-gray-200 shadow-lg p-8 flex flex-col items-center gap-5 text-center">

          {/* Header */}
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
            <Car size={24} className="text-white" />
          </div>

          <div>
            <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">
              Parking — available to book
            </p>
            <h2 className="text-2xl font-bold text-gray-900">{slot.label}</h2>
            {slot.location && (
              <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1">
                <MapPin size={13} /> {slot.location}
              </p>
            )}
          </div>

          {/* Rate */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-6 py-3">
            <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-0.5">Hourly rate</p>
            <p className="text-2xl font-bold text-blue-700 flex items-center justify-center">
              <IndianRupee size={20} />{slot.hourlyRate}
              <span className="text-base font-normal text-blue-500 ml-1">/hr</span>
            </p>
          </div>

          {/* QR code */}
          {bookingUrl && (
            <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
              <QRCodeSVG
                value={bookingUrl}
                size={200}
                bgColor="#ffffff"
                fgColor="#111827"
                level="M"
                includeMargin={false}
              />
            </div>
          )}

          {/* Instruction */}
          <div className="space-y-1">
            <p className="text-base font-semibold text-gray-800">
              Scan to book this slot
            </p>
            <p className="text-xs text-gray-400">
              Pick a time, pay offline, park hassle-free
            </p>
          </div>

          {/* URL (small, for reference) */}
          {bookingUrl && (
            <p className="text-[10px] text-gray-300 break-all">{bookingUrl}</p>
          )}

        </div>
      </div>
    </>
  );
}
