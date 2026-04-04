"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer } from "lucide-react";

const BLOCKS = [1, 2, 3, 4];

function QRCard({ block, baseUrl }: { block: number; baseUrl: string }) {
  const url = `${baseUrl}/housekeeping/feedback?block=${block}`;
  return (
    <div
      className="qr-card bg-white border-2 border-gray-200 rounded-2xl p-6 flex flex-col items-center gap-4 print:break-inside-avoid print:border-gray-300"
    >
      {/* Header */}
      <div className="text-center">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">RMV Clusters</p>
        <h2 className="text-2xl font-bold text-gray-800">Block {block}</h2>
        <p className="text-sm text-gray-500 mt-0.5">Housekeeping Feedback</p>
      </div>

      {/* QR */}
      <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
        <QRCodeSVG
          value={url}
          size={180}
          bgColor="#ffffff"
          fgColor="#111827"
          level="M"
          includeMargin={false}
        />
      </div>

      {/* Instructions */}
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-gray-700">Scan to rate our cleaning service</p>
        <p className="text-xs text-gray-400 break-all">{url}</p>
      </div>

      {/* Stars decoration */}
      <div className="flex gap-0.5 text-yellow-400 text-lg">
        {[1,2,3,4,5].map(s => <span key={s}>★</span>)}
      </div>
    </div>
  );
}

export default function HousekeepingQRPage() {
  const [baseUrl, setBaseUrl] = useState(
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const [selected, setSelected] = useState<number[]>([1, 2, 3, 4]);

  function toggleBlock(b: number) {
    setSelected(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .qr-grid { grid-template-columns: repeat(2, 1fr); gap: 1.5rem; padding: 1rem; }
          .qr-card { box-shadow: none; page-break-inside: avoid; }
        }
      `}</style>

      {/* Controls — hidden on print */}
      <div className="no-print max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">QR Codes — Housekeeping</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Print and stick on each block notice board</p>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-blue-600 dark:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            <Printer size={16} />
            Print QR Codes
          </button>
        </div>

        {/* Base URL override (for custom domains) */}
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400 shrink-0">Site URL:</label>
          <input
            value={baseUrl}
            onChange={e => setBaseUrl(e.target.value)}
            className="flex-1 text-sm bg-transparent text-gray-800 dark:text-gray-200 border-none outline-none"
            placeholder="https://yoursite.com"
          />
        </div>

        {/* Block selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600 dark:text-gray-400">Show blocks:</span>
          {BLOCKS.map(b => (
            <button
              key={b}
              onClick={() => toggleBlock(b)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                selected.includes(b)
                  ? "bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600"
              }`}
            >
              Block {b}
            </button>
          ))}
        </div>
      </div>

      {/* QR grid — visible both on screen and print */}
      <div className={`qr-grid max-w-4xl mx-auto px-4 pb-12 grid grid-cols-1 sm:grid-cols-2 gap-6 no-print`}>
        {selected.sort((a, b) => a - b).map(b => (
          <QRCard key={b} block={b} baseUrl={baseUrl} />
        ))}
      </div>

      {/* Print-only: full-page grid without controls */}
      <div className="hidden print:block qr-grid">
        {selected.sort((a, b) => a - b).map(b => (
          <QRCard key={b} block={b} baseUrl={baseUrl} />
        ))}
      </div>
    </>
  );
}
