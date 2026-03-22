"use client";

import { useState, useEffect } from "react";
import {
  Ambulance,
  Flame,
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Heart,
  Siren,
  BadgeCheck,
  MessageCircleWarning,
  Info,
  IndianRupee,
} from "lucide-react";
import clsx from "clsx";
import sosData from "@/data/sos-guidelines.json";
import { formatDate } from "@/lib/utils";

const STORAGE_KEY = "rmv-sos-accepted";

export default function SOSGuidelinesContent() {
  const [accepted, setAccepted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setAccepted(true);
      setChecked(true);
    }
    setHydrated(true);
  }, []);

  function handleAccept() {
    localStorage.setItem(STORAGE_KEY, "true");
    setAccepted(true);
  }

  return (
    <div className="py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <Siren size={32} className="text-red-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            RMV SOS Group
          </h1>
          <p className="mt-2 text-gray-600">
            Emergency Response WhatsApp Group for RMV Clusters
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Version {sosData.version} &middot; Last updated:{" "}
            {formatDate(sosData.lastUpdated)}
          </p>
          <div className="mt-4 h-1 w-16 bg-red-500 rounded mx-auto" />
        </div>

        {/* Intro banner */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-10">
          <p className="text-red-800 font-medium text-center">
            This group is strictly for{" "}
            <span className="font-bold">life-threatening emergencies only</span>
            . Read the guidelines below carefully before joining.
          </p>
        </div>

        {/* Scope */}
        <section className="mb-10">
          <SectionTitle icon={Shield} title="Scope (Version 1)" color="red" />
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            {sosData.scope.map((s) => {
              const Icon = s.icon === "ambulance" ? Ambulance : Flame;
              const color = s.icon === "ambulance" ? "blue" : "orange";
              return (
                <div
                  key={s.id}
                  className="bg-white rounded-lg p-5 shadow-sm border border-gray-100"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={clsx(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        color === "blue"
                          ? "bg-blue-100"
                          : "bg-orange-100"
                      )}
                    >
                      <Icon
                        size={20}
                        className={
                          color === "blue"
                            ? "text-blue-600"
                            : "text-orange-600"
                        }
                      />
                    </div>
                    <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {s.items.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-gray-600"
                      >
                        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-10">
          <SectionTitle icon={Info} title="How It Works" color="primary" />
          <div className="mt-4 bg-white rounded-lg p-5 shadow-sm border border-gray-100 space-y-3">
            {sosData.howItWorks.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Important Note */}
        <section className="mb-10">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
            <IndianRupee
              size={20}
              className="text-amber-600 shrink-0 mt-0.5"
            />
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">
                Important Note
              </h3>
              <p className="text-sm text-amber-800">
                All expenses (hospital, transport, etc.) must be borne by the
                individual/family. The RMV SOS group and warriors provide{" "}
                <span className="font-medium">
                  support and coordination only
                </span>
                , not financial assistance.
              </p>
            </div>
          </div>
        </section>

        {/* Discipline & Rules */}
        <section className="mb-10">
          <SectionTitle
            icon={MessageCircleWarning}
            title="Discipline & Usage Rules"
            color="red"
          />
          <div className="mt-4 space-y-4">
            <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
              <p className="text-sm font-semibold text-red-700 mb-3">
                This group is ONLY for real emergencies
              </p>
              <div className="space-y-2">
                {sosData.rules[0].items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                    <XCircle size={16} className="text-red-500 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Strict Action Policy
              </p>
              <div className="space-y-2">
                {sosData.rules[1].items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm text-gray-700"
                  >
                    <AlertTriangle
                      size={16}
                      className="text-amber-500 shrink-0"
                    />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-sm text-gray-500 italic">
              The intent is to keep the group signal strong and noise-free
              during critical moments.
            </p>
          </div>
        </section>

        {/* Examples: Emergency vs Non-Emergency */}
        <section className="mb-10">
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Allowed */}
            <div>
              <SectionTitle
                icon={CheckCircle}
                title="Emergencies (Allowed)"
                color="green"
              />
              <div className="mt-4 bg-white rounded-lg p-5 shadow-sm border border-green-100 space-y-2">
                {sosData.emergencyExamples.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <CheckCircle
                      size={16}
                      className="text-green-500 shrink-0 mt-0.5"
                    />
                    {item}
                  </div>
                ))}
              </div>
            </div>
            {/* Not Allowed */}
            <div>
              <SectionTitle
                icon={XCircle}
                title="Non-Emergencies (Not Allowed)"
                color="red"
              />
              <div className="mt-4 bg-white rounded-lg p-5 shadow-sm border border-red-100 space-y-2">
                {sosData.nonEmergencyExamples.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <XCircle
                      size={16}
                      className="text-red-500 shrink-0 mt-0.5"
                    />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Simple Rule */}
        <section className="mb-10">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center space-y-2">
            <p className="text-gray-800 font-medium">
              If it can wait, it&apos;s <span className="font-bold text-red-600">NOT</span> for SOS
            </p>
            <p className="text-gray-800 font-medium">
              If delay can risk life or serious damage,{" "}
              <span className="font-bold text-green-600">use SOS</span>
            </p>
          </div>
        </section>

        {/* Acceptance Section */}
        <section className="mt-12">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            {accepted ? (
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100">
                  <BadgeCheck size={28} className="text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  You have accepted the guidelines
                </h3>
                <p className="text-sm text-gray-600">
                  Please contact the RMV SOS admin to be added to the WhatsApp
                  group.
                </p>
                <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-5 py-3">
                  <Heart size={18} className="text-green-600" />
                  <span className="text-green-800 font-medium text-sm">
                    Welcome to the RMV SOS community
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Accept Guidelines to Join
                </h3>
                <p className="text-sm text-gray-600">
                  Please read all the guidelines above carefully. By checking
                  the box below and clicking &quot;Accept&quot;, you agree to
                  follow all rules and understand the consequences of
                  violations.
                </p>
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-700">
                    I have read and understood the RMV SOS Group guidelines. I
                    agree to use this group strictly for life-threatening
                    emergencies and accept the disciplinary actions for any
                    violations.
                  </span>
                </label>
                <button
                  onClick={handleAccept}
                  disabled={!checked || !hydrated}
                  className={clsx(
                    "w-full py-3 px-6 rounded-lg font-medium text-white transition-colors",
                    checked && hydrated
                      ? "bg-red-600 hover:bg-red-700 cursor-pointer"
                      : "bg-gray-300 cursor-not-allowed"
                  )}
                >
                  I Accept the Guidelines
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---- Helper component ---- */

function SectionTitle({
  icon: Icon,
  title,
  color,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  color: "red" | "primary" | "green" | "amber";
}) {
  const colorMap = {
    red: { bg: "bg-red-100", text: "text-red-600" },
    primary: { bg: "bg-primary-100", text: "text-primary-600" },
    green: { bg: "bg-green-100", text: "text-green-600" },
    amber: { bg: "bg-amber-100", text: "text-amber-600" },
  };
  const c = colorMap[color];
  return (
    <div className="flex items-center gap-3">
      <div
        className={clsx(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          c.bg
        )}
      >
        <Icon size={20} className={c.text} />
      </div>
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    </div>
  );
}
