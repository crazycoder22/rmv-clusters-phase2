"use client";

import { useState, Fragment } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import type { FAQItem } from "@/data/faqTopics";

// ── Tiny inline-bold renderer ────────────────────────────────────────────
// Splits a paragraph on **...** and renders the matched runs as <strong>.
// Avoids pulling in a markdown library for this tiny need.
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>);
    }
    parts.push(
      <strong key={key++} className="font-semibold text-gray-900 dark:text-gray-100">
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  }
  return parts;
}

// Render an answer string as one or more paragraphs split on blank lines.
function Answer({ text }: { text: string }) {
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  return (
    <>
      {paragraphs.map((p, i) => (
        <p
          key={i}
          className={clsx(
            "text-sm sm:text-[15px] leading-relaxed text-gray-700 dark:text-gray-300",
            i > 0 && "mt-3"
          )}
        >
          {renderInline(p)}
        </p>
      ))}
    </>
  );
}

// ── Accordion ────────────────────────────────────────────────────────────

export default function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-2 sm:space-y-3">
      {items.map((item, idx) => {
        const isOpen = openIds.has(item.id);
        return (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={isOpen}
              aria-controls={`${item.id}-panel`}
              // min-h ensures comfortable mobile tap target (>= 44px)
              className="w-full flex items-start gap-3 text-left p-4 sm:p-5 min-h-[3rem] hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
            >
              <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-50 dark:bg-primary-900/40 text-[11px] font-bold text-primary-700 dark:text-primary-300">
                {idx + 1}
              </span>
              <span className="flex-1 font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 leading-snug">
                {item.question}
              </span>
              <ChevronDown
                size={18}
                className={clsx(
                  "shrink-0 mt-0.5 text-gray-400 dark:text-gray-500 transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>

            {isOpen && (
              <div
                id={`${item.id}-panel`}
                className="px-4 sm:px-5 pb-4 sm:pb-5 pl-[3.25rem] sm:pl-[3.75rem]"
              >
                <Answer text={item.answer} />

                {item.bullets && item.bullets.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {item.bullets.map((b, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm sm:text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed"
                      >
                        <span
                          aria-hidden="true"
                          className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-primary-500 dark:bg-primary-400"
                        />
                        <span>{renderInline(b)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {item.note && (
                  <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle
                      size={16}
                      className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"
                      aria-hidden="true"
                    />
                    <p className="text-xs sm:text-sm leading-relaxed text-amber-900 dark:text-amber-200 italic">
                      {renderInline(item.note)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
