import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronDown, FileText, Sparkles } from "lucide-react";
import clsx from "clsx";
import { Browser } from "@capacitor/browser";
import { FAQ_TOPICS, type FAQItem, type FAQTopic } from "../data/faqTopics";
import { API_BASE_URL } from "../config";

export default function FaqPage() {
  const [topicSlug, setTopicSlug] = useState<string | null>(null);
  const topic = topicSlug
    ? FAQ_TOPICS.find((t) => t.slug === topicSlug) ?? null
    : null;

  return (
    <div className="flex flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)]">
      <header className="flex items-center gap-2 py-4">
        <Link
          to={topic ? "#" : "/more"}
          onClick={(e) => {
            if (topic) {
              e.preventDefault();
              setTopicSlug(null);
            }
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-300 hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold text-white">
          {topic ? topic.title : "FAQ"}
        </h1>
      </header>

      {topic ? (
        <TopicView topic={topic} />
      ) : (
        <TopicList onPick={setTopicSlug} />
      )}
    </div>
  );
}

function TopicList({ onPick }: { onPick: (slug: string) => void }) {
  return (
    <>
      <p className="mb-4 text-xs text-slate-500">
        Pick a topic to browse questions and answers.
      </p>
      <div className="space-y-3">
        {FAQ_TOPICS.map((t) => (
          <button
            key={t.slug}
            onClick={() => onPick(t.slug)}
            className="flex w-full items-start gap-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-left active:bg-slate-800"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-2xl">
              {t.emoji}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">
                  {t.title}
                </h2>
                {t.isNew && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                    <Sparkles size={9} />
                    New
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {t.description}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {t.items.length} question{t.items.length === 1 ? "" : "s"}
                {t.publishedAt ? ` · ${t.publishedAt}` : ""}
              </p>
            </div>
            <span className="text-slate-500">›</span>
          </button>
        ))}
      </div>
    </>
  );
}

function TopicView({ topic }: { topic: FAQTopic }) {
  const openPdf = () => {
    if (!topic.pdfUrl) return;
    const url = topic.pdfUrl.startsWith("http")
      ? topic.pdfUrl
      : `${API_BASE_URL}${topic.pdfUrl}`;
    Browser.open({ url }).catch(() => window.open(url, "_blank"));
  };

  return (
    <>
      {topic.intro && (
        <p className="mb-4 text-sm leading-relaxed text-slate-300">
          {topic.intro}
        </p>
      )}

      {topic.pdfUrl && (
        <button
          onClick={openPdf}
          className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2.5 text-sm font-semibold text-indigo-200 active:bg-indigo-500/20"
        >
          <FileText size={14} />
          Open full PDF
        </button>
      )}

      <div className="space-y-2">
        {topic.items.map((item) => (
          <FaqAccordion key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}

function FaqAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/60">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left active:bg-slate-800"
      >
        <span className="flex-1 text-sm font-medium text-white">
          {item.question}
        </span>
        <ChevronDown
          size={16}
          className={clsx(
            "flex-shrink-0 text-slate-500 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="border-t border-slate-700 px-4 py-3 text-sm leading-relaxed text-slate-300">
          <p
            dangerouslySetInnerHTML={{
              __html: renderBold(item.answer),
            }}
          />
          {item.bullets && item.bullets.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
              {item.bullets.map((b, i) => (
                <li
                  key={i}
                  dangerouslySetInnerHTML={{ __html: renderBold(b) }}
                />
              ))}
            </ul>
          )}
          {item.note && (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              {item.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderBold(s: string): string {
  // Minimal **bold** → <strong>bold</strong>. Escape HTML first.
  const esc = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
