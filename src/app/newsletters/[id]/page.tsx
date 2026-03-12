"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Newspaper,
  Download,
  Loader2,
  FileText,
} from "lucide-react";
import RichTextViewer from "@/components/editor/RichTextViewer";
import type { NewsletterData, NewsletterSectionType } from "@/types";

const SECTION_EMOJI: Record<NewsletterSectionType, string> = {
  news: "📰",
  article: "✍️",
  ad: "📢",
  events: "📅",
};

export default function NewsletterViewPage() {
  const { id } = useParams<{ id: string }>();
  const [newsletter, setNewsletter] = useState<NewsletterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchNewsletter = useCallback(async () => {
    const res = await fetch(`/api/newsletters/${id}`);
    if (res.ok) {
      const data = await res.json();
      setNewsletter(data.newsletter);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchNewsletter();
  }, [fetchNewsletter]);

  async function handleDownloadPdf() {
    if (!contentRef.current || !newsletter) return;
    setDownloading(true);

    try {
      const { toPng } = await import("html-to-image");
      const { default: jsPDF } = await import("jspdf");

      const dataUrl = await toPng(contentRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const pxWidth = img.width;
      const pxHeight = img.height;

      // A4 portrait in mm
      const pdfWidth = 210;
      const pdfHeight = (pxHeight * pdfWidth) / pxWidth;

      const pdf = new jsPDF({
        orientation: pdfHeight > 297 ? "portrait" : "portrait",
        unit: "mm",
        format: [pdfWidth, Math.max(pdfHeight, 297)],
      });

      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);

      const filename = `${newsletter.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("PDF generation failed:", err);
      // Fallback: browser print
      window.print();
    }

    setDownloading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  if (!newsletter) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <FileText className="text-gray-400" size={48} />
        <p className="text-gray-500">Newsletter not found.</p>
        <Link
          href="/newsletters"
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          Back to Newsletters
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header actions */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Link
            href="/newsletters"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600 transition-colors"
          >
            <ArrowLeft size={16} />
            All Newsletters
          </Link>
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Download size={16} />
            {downloading ? "Generating..." : "Download PDF"}
          </button>
        </div>

        {/* Newsletter Content */}
        <div
          ref={contentRef}
          className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
        >
          {/* Title Header */}
          <div className="bg-gradient-to-r from-primary-700 to-primary-900 text-white px-8 py-8">
            <div className="flex items-center gap-3 mb-2">
              <Newspaper size={28} />
              <span className="text-primary-200 text-sm font-medium uppercase tracking-wider">
                Newsletter
              </span>
            </div>
            <h1 className="text-3xl font-bold">{newsletter.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-primary-200 text-sm">
              {newsletter.edition && <span>{newsletter.edition}</span>}
              {newsletter.publishedAt && (
                <span>
                  Published{" "}
                  {new Date(newsletter.publishedAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Cover / Editor's Note */}
          {newsletter.coverHtml && (
            <div className="px-8 py-6 border-b border-gray-200 bg-primary-50/30">
              <RichTextViewer html={newsletter.coverHtml} />
            </div>
          )}

          {/* Table of Contents */}
          {newsletter.sections.length > 2 && (
            <div className="px-8 py-5 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                In This Issue
              </h3>
              <ul className="space-y-1">
                {newsletter.sections.map((section, idx) => (
                  <li key={section.id}>
                    <a
                      href={`#section-${idx}`}
                      className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
                    >
                      {SECTION_EMOJI[section.type as NewsletterSectionType]}{" "}
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sections */}
          <div className="divide-y divide-gray-200">
            {newsletter.sections.map((section, idx) => (
              <div key={section.id} id={`section-${idx}`} className="px-8 py-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">
                    {SECTION_EMOJI[section.type as NewsletterSectionType]}
                  </span>
                  <h2 className="text-xl font-bold text-gray-900">
                    {section.title}
                  </h2>
                </div>
                {section.authorName && (
                  <p className="text-sm text-gray-500 mb-3 italic">
                    by {section.authorName}
                    {section.authorBlock
                      ? ` — Block ${section.authorBlock}${
                          section.authorFlat ? `, ${section.authorFlat}` : ""
                        }`
                      : ""}
                  </p>
                )}
                <RichTextViewer html={section.contentHtml} />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 text-center text-xs text-gray-400">
            RMV Clusters Newsletter &middot;{" "}
            {newsletter.edition || newsletter.title}
          </div>
        </div>
      </div>
    </div>
  );
}
