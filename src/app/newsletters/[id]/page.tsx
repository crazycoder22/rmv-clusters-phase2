"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Loader2,
  FileText,
  BookOpen,
  List,
} from "lucide-react";
import RichTextViewer from "@/components/editor/RichTextViewer";
import NewspaperFlipbook from "@/components/newsletter/NewspaperFlipbook";
import type { NewsletterData, NewsletterSectionType } from "@/types";

const SECTION_EMOJI: Record<NewsletterSectionType, string> = {
  news: "\ud83d\udcf0",
  article: "\u270d\ufe0f",
  ad: "\ud83d\udce2",
  events: "\ud83d\udcc5",
};

export default function NewsletterViewPage() {
  const { id } = useParams<{ id: string }>();
  const [newsletter, setNewsletter] = useState<NewsletterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [viewMode, setViewMode] = useState<"newspaper" | "scroll">("newspaper");
  const printRef = useRef<HTMLDivElement>(null);

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
    if (!printRef.current || !newsletter) return;
    setDownloading(true);

    try {
      const { toPng } = await import("html-to-image");
      const { default: jsPDF } = await import("jspdf");

      const dataUrl = await toPng(printRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: "#FDF5E6",
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const pxWidth = img.width;
      const pxHeight = img.height;
      const pdfWidth = 210;
      const pdfHeight = (pxHeight * pdfWidth) / pxWidth;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pdfWidth, Math.max(pdfHeight, 297)],
      });

      pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);

      const filename = `${newsletter.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("PDF generation failed:", err);
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
    <div className="min-h-screen bg-stone-100 dark:bg-stone-900">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header actions */}
        <div className="flex items-center justify-between mb-4 print:hidden">
          <Link
            href="/newsletters"
            className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
          >
            <ArrowLeft size={16} />
            All Issues
          </Link>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center bg-stone-200 dark:bg-stone-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("newspaper")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === "newspaper"
                    ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm"
                    : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
                }`}
              >
                <BookOpen size={14} />
                Newspaper
              </button>
              <button
                onClick={() => setViewMode("scroll")}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === "scroll"
                    ? "bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm"
                    : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"
                }`}
              >
                <List size={14} />
                Scroll
              </button>
            </div>
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 bg-stone-800 dark:bg-stone-700 text-white rounded-lg text-sm font-medium hover:bg-stone-900 dark:hover:bg-stone-600 disabled:opacity-50 transition-colors"
            >
              <Download size={16} />
              {downloading ? "Generating..." : "PDF"}
            </button>
          </div>
        </div>

        {/* Newspaper Flipbook View */}
        {viewMode === "newspaper" && (
          <NewspaperFlipbook newsletter={newsletter} />
        )}

        {/* Classic Scroll View */}
        {viewMode === "scroll" && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            {/* Title Header */}
            <div className="newspaper-page px-8 py-6 border-b border-stone-300 dark:border-stone-600">
              <div className="newspaper-masthead">
                <h1 className="newspaper-masthead-title text-2xl">
                  OneRMV Newsletter
                </h1>
                <div className="newspaper-masthead-meta">
                  <span>
                    {newsletter.publishedAt
                      ? new Date(newsletter.publishedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : ""}
                  </span>
                  {newsletter.edition && <span>{newsletter.edition}</span>}
                </div>
              </div>
            </div>

            {/* Cover / Editor's Note */}
            {newsletter.coverHtml && (
              <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-700 bg-primary-50/30 dark:bg-primary-900/10">
                <RichTextViewer html={newsletter.coverHtml} />
              </div>
            )}

            {/* Sections */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {newsletter.sections.map((section) => (
                <div key={section.id} className="px-8 py-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">
                      {SECTION_EMOJI[section.type as NewsletterSectionType]}
                    </span>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      {section.title}
                    </h2>
                  </div>
                  {section.authorName && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 italic">
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
            <div className="px-8 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-center text-xs text-gray-400 dark:text-gray-500">
              OneRMV Newsletter &middot;{" "}
              {newsletter.edition || newsletter.title}
            </div>
          </div>
        )}

        {/* Hidden print layout for PDF generation */}
        <div ref={printRef} className="fixed left-[-9999px] top-0 w-[800px]" aria-hidden="true">
          <div className="newspaper-page p-8">
            <div className="newspaper-masthead mb-4">
              <h1 className="newspaper-masthead-title text-3xl">OneRMV Newsletter</h1>
              <div className="newspaper-masthead-meta">
                <span>
                  {newsletter.publishedAt
                    ? new Date(newsletter.publishedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : ""}
                </span>
                {newsletter.edition && <span>{newsletter.edition}</span>}
              </div>
            </div>
            {newsletter.coverHtml && (
              <div className="mb-4 text-sm italic">
                <RichTextViewer html={newsletter.coverHtml} />
              </div>
            )}
            {newsletter.sections.map((section) => (
              <div key={section.id} className="mb-6">
                <hr className="newspaper-divider" />
                <h2 className="newspaper-headline newspaper-headline-md mb-1">
                  {section.title}
                </h2>
                {section.authorName && (
                  <p className="newspaper-byline mb-2">
                    By {section.authorName}
                  </p>
                )}
                <div className="newspaper-body-columns">
                  <RichTextViewer html={section.contentHtml} />
                </div>
              </div>
            ))}
            <div className="text-center text-xs text-stone-400 mt-8 pt-4 border-t border-stone-300">
              OneRMV Newsletter &middot; {newsletter.edition || newsletter.title}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
