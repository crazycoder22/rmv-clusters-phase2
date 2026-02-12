import type { Metadata } from "next";
import {
  Car,
  Wrench,
  Users,
  Building,
  Trash2,
} from "lucide-react";
import guidelinesData from "@/data/guidelines.json";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description:
    "Rules and guidelines for residents of RMV Clusters Phase II apartment complex.",
};

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  car: Car,
  wrench: Wrench,
  users: Users,
  building: Building,
  "trash-2": Trash2,
};

export default function GuidelinesPage() {
  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Community Guidelines
          </h1>
          <p className="mt-2 text-gray-600">
            Last updated: {formatDate(guidelinesData.lastUpdated)}
          </p>
          <div className="mt-4 h-1 w-16 bg-primary-500 rounded mx-auto" />
        </div>

        {/* Mobile TOC */}
        <div className="lg:hidden mb-8">
          <div className="flex flex-wrap gap-2">
            {guidelinesData.sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="px-3 py-1.5 text-xs font-medium bg-primary-50 text-primary-700 rounded-full hover:bg-primary-100 transition-colors"
              >
                {section.title}
              </a>
            ))}
          </div>
        </div>

        <div className="flex gap-8">
          {/* Table of Contents - desktop sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <nav className="sticky top-24 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Sections
              </h3>
              <ul className="space-y-1">
                {guidelinesData.sections.map((section) => {
                  const Icon = iconMap[section.icon];
                  return (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-primary-700 hover:bg-primary-50 rounded-md transition-colors"
                      >
                        {Icon && <Icon size={14} />}
                        {section.title}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-12">
            {guidelinesData.sections.map((section) => {
              const Icon = iconMap[section.icon];
              return (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-24"
                >
                  <div className="flex items-center gap-3 mb-6">
                    {Icon && (
                      <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                        <Icon size={20} className="text-primary-600" />
                      </div>
                    )}
                    <h2 className="text-xl font-bold text-gray-900">
                      {section.title}
                    </h2>
                  </div>
                  <div className="space-y-4">
                    {section.rules.map((rule, rIndex) => (
                      <div
                        key={rIndex}
                        className="bg-white rounded-lg p-5 shadow-sm border border-gray-100"
                      >
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {rule.title}
                        </h3>
                        <p className="text-gray-600 text-sm leading-relaxed">
                          {rule.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
