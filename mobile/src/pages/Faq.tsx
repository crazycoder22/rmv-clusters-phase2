import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Browser } from "@capacitor/browser";
import Icon from "../components/Icon";
import { FAQ_TOPICS, type FAQItem, type FAQTopic } from "../data/faqTopics";
import { API_BASE_URL } from "../config";

// OneRMV FAQ — topic list → topic detail accordion. Follows OneRMV FAQ.dc.html.
export default function FaqPage() {
  const navigate = useNavigate();
  const [topicSlug, setTopicSlug] = useState<string | null>(null);
  const topic = topicSlug ? FAQ_TOPICS.find((t) => t.slug === topicSlug) ?? null : null;

  return (
    <div
      className="one-surface flex flex-1 flex-col px-[18px] pt-[env(safe-area-inset-top,0px)] pb-8"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <header className="flex items-center gap-3 py-3">
        <button
          onClick={() => (topic ? setTopicSlug(null) : navigate(-1))}
          className="flex active:opacity-70"
          aria-label="Back"
        >
          <Icon name="arrow_back" size={24} style={{ color: "var(--text-2)" }} />
        </button>
        <h1
          className="min-w-0 flex-1 truncate font-extrabold tracking-tight"
          style={{ color: "var(--text)", fontSize: topic ? 20 : 25 }}
        >
          {topic ? topic.title : "FAQ"}
        </h1>
      </header>

      {topic ? <TopicView topic={topic} /> : <TopicList onPick={setTopicSlug} />}
    </div>
  );
}

function TopicList({ onPick }: { onPick: (slug: string) => void }) {
  return (
    <>
      <p className="pb-3 text-[14px]" style={{ color: "var(--text-2)" }}>
        Pick a topic to browse questions and answers.
      </p>
      <div className="flex flex-col gap-3.5">
        {FAQ_TOPICS.map((t) => (
          <button
            key={t.slug}
            onClick={() => onPick(t.slug)}
            className="flex w-full items-start gap-3.5 rounded-[18px] p-[15px] text-left active:opacity-90"
            style={{
              background: "var(--surface)",
              border: `1px solid ${t.isNew ? "var(--border-strong)" : "var(--border)"}`,
              boxShadow: t.isNew ? "0 4px 12px rgba(0,0,0,0.12)" : "none",
            }}
          >
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[13px] text-[23px] leading-none"
              style={{ background: "var(--accent-soft)" }}
            >
              {t.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[16.5px] font-bold leading-tight tracking-tight" style={{ color: "var(--text)" }}>
                  {t.title}
                </span>
                {t.isNew && (
                  <span
                    className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-bold"
                    style={{ background: "var(--warning-soft)", color: "var(--warning)" }}
                  >
                    <Icon name="auto_awesome" size={13} fill style={{ color: "var(--warning)" }} />New
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[13px] leading-snug" style={{ color: "var(--text-2)" }}>
                {t.description}
              </p>
              <div className="mt-2.5 flex items-center gap-2 text-[12px] font-semibold" style={{ color: "var(--text-3)" }}>
                <span className="flex items-center gap-1">
                  <Icon name="help" size={15} style={{ color: "var(--text-3)" }} />
                  {t.items.length} question{t.items.length === 1 ? "" : "s"}
                </span>
                {t.publishedAt && (
                  <>
                    <span className="h-[3px] w-[3px] rounded-full" style={{ background: "var(--text-3)" }} />
                    <span>{t.publishedAt}</span>
                  </>
                )}
              </div>
            </div>
            <Icon name="chevron_right" size={20} className="self-center" style={{ color: "var(--text-3)" }} />
          </button>
        ))}
      </div>
    </>
  );
}

function TopicView({ topic }: { topic: FAQTopic }) {
  const openPdf = () => {
    if (!topic.pdfUrl) return;
    const url = topic.pdfUrl.startsWith("http") ? topic.pdfUrl : `${API_BASE_URL}${topic.pdfUrl}`;
    Browser.open({ url }).catch(() => window.open(url, "_blank"));
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {topic.intro && (
        <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-2)" }}>
          {topic.intro}
        </p>
      )}

      {topic.pdfUrl && (
        <button
          onClick={openPdf}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[13px] py-3.5 text-[14px] font-bold active:opacity-90"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent)",
            border: "1px solid color-mix(in srgb, var(--accent) 45%, var(--border))",
          }}
        >
          <Icon name="description" size={19} style={{ color: "var(--accent)" }} />Open full PDF
        </button>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        {topic.items.map((item) => (
          <FaqAccordion key={item.id} item={item} />
        ))}
      </div>

      {topic.publishedAt && (
        <div
          className="one-mono mt-5 text-center text-[10px]"
          style={{ color: "var(--text-3)", letterSpacing: "0.08em" }}
        >
          UPDATED {topic.publishedAt.toUpperCase()} · RMV ADMIN
        </div>
      )}
    </div>
  );
}

function FaqAccordion({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);
  const paragraphs = item.answer.split(/\n\n+/);
  return (
    <div
      className="overflow-hidden rounded-[15px]"
      style={{
        background: "var(--surface)",
        border: `1px solid ${open ? "var(--border-strong)" : "var(--border)"}`,
        boxShadow: open ? "0 4px 14px rgba(0,0,0,0.14)" : "none",
      }}
    >
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2.5 p-[15px] text-left">
        <span className="min-w-0 flex-1 text-[14.5px] font-bold leading-snug" style={{ color: "var(--text)" }}>
          {item.question}
        </span>
        <Icon
          name="expand_more"
          size={21}
          className="flex-shrink-0"
          style={{
            color: open ? "var(--accent)" : "var(--text-3)",
            transform: `rotate(${open ? 180 : 0}deg)`,
            transition: "transform .22s ease",
            marginTop: 1,
          }}
        />
      </button>
      {open && (
        <div className="px-[15px] pb-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="text-[13.5px] leading-relaxed"
              style={{ color: "var(--text-2)", marginTop: i === 0 ? 0 : 8 }}
              dangerouslySetInnerHTML={{ __html: renderBold(p) }}
            />
          ))}
          {item.bullets && item.bullets.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px]" style={{ color: "var(--text-2)" }}>
              {item.bullets.map((b, i) => (
                <li key={i} dangerouslySetInnerHTML={{ __html: renderBold(b) }} />
              ))}
            </ul>
          )}
          {item.note && (
            <div
              className="mt-3 rounded-[10px] px-3 py-2 text-[12.5px] leading-relaxed"
              style={{ background: "var(--warning-soft)", color: "var(--warning)", border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)" }}
            >
              {item.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderBold(s: string): string {
  const esc = s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
