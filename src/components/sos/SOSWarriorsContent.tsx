"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Shield, Phone, MapPin, ArrowLeft } from "lucide-react";

interface Warrior {
  id: string;
  name: string;
  phone: string;
  block: number;
  flatNumber: string;
}

export default function SOSWarriorsContent() {
  const [warriors, setWarriors] = useState<Warrior[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sos-warriors")
      .then((res) => (res.ok ? res.json() : { warriors: [] }))
      .then((data) => setWarriors(data.warriors || []))
      .catch(() => setWarriors([]))
      .finally(() => setLoading(false));
  }, []);

  // Group warriors by block
  const grouped = warriors.reduce<Record<number, Warrior[]>>((acc, w) => {
    (acc[w.block] ||= []).push(w);
    return acc;
  }, {});

  return (
    <div className="py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/sos-guidelines"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8"
        >
          <ArrowLeft size={16} />
          Back to SOS Guidelines
        </Link>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <Shield size={32} className="text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">RMV SOS Warriors</h1>
          <p className="mt-2 text-gray-600">
            Trained volunteers ready to help during emergencies
          </p>
          <div className="mt-4 h-1 w-16 bg-red-500 rounded mx-auto" />
        </div>

        {/* Senior citizen note */}
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Phone size={20} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">For senior citizens:</span> If you find it
            difficult to navigate apps or send messages, a printed copy of this warrior
            contact list is available at the security desk. In an emergency, simply call
            any warrior directly from the list.
          </p>
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-12">Loading warriors...</p>
        ) : warriors.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No SOS warriors listed yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Warriors will be added by the admin soon.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {[1, 2, 3, 4].map((block) => {
              const blockWarriors = grouped[block];
              if (!blockWarriors || blockWarriors.length === 0) return null;
              return (
                <div key={block}>
                  <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <MapPin size={18} className="text-red-500" />
                    Block {block}
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {blockWarriors.map((w) => (
                      <div
                        key={w.id}
                        className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center gap-4"
                      >
                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                          <Shield size={18} className="text-red-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 truncate">
                            {w.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            Flat {w.flatNumber}
                          </p>
                        </div>
                        <a
                          href={`tel:${w.phone}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors shrink-0"
                        >
                          <Phone size={14} />
                          Call
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
