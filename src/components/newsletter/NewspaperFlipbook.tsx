"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import type { NewsletterData } from "@/types";
import { organizeIntoPages } from "@/lib/newsletter-pages";
import NewspaperFrontPage from "./NewspaperFrontPage";
import NewspaperArticlePage from "./NewspaperArticlePage";
import NewspaperEventsPage from "./NewspaperEventsPage";
import NewspaperAdPage from "./NewspaperAdPage";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface NewspaperFlipbookProps {
  newsletter: NewsletterData;
}

export default function NewspaperFlipbook({ newsletter }: NewspaperFlipbookProps) {
  const flipBookRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [currentPage, setCurrentPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [FlipBookComponent, setFlipBookComponent] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [dimensions, setDimensions] = useState({ width: 550, height: 733 });

  // Dynamically import react-pageflip (client-only)
  useEffect(() => {
    import("react-pageflip").then((mod) => {
      setFlipBookComponent(() => mod.default);
    });
  }, []);

  // Responsive detection
  useEffect(() => {
    function checkMobile() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // Calculate dimensions based on container
      const containerWidth = Math.min(window.innerWidth - 32, 1000);
      if (mobile) {
        const w = Math.min(containerWidth, 400);
        setDimensions({ width: w, height: Math.round(w * 1.4) });
      } else {
        const w = Math.min(containerWidth / 2, 550);
        setDimensions({ width: w, height: Math.round(w * 1.33) });
      }
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Organize sections into pages
  const pages = useMemo(() => organizeIntoPages(newsletter), [newsletter]);
  const totalPages = pages.length;

  // Build a map: sectionId -> pageIndex (for front page headline clicks)
  const headlinePageMap = useMemo(() => {
    const map = new Map<string, number>();
    pages.forEach((page, idx) => {
      if (page.type === "article") {
        map.set(page.section.id, idx);
      } else if (page.type === "events") {
        map.set(page.section.id, idx);
      } else if (page.type === "ads") {
        page.sections.forEach((s) => map.set(s.id, idx));
      }
    });
    return map;
  }, [pages]);

  const navigateToPage = useCallback((pageIndex: number) => {
    if (flipBookRef.current) {
      flipBookRef.current.pageFlip().flip(pageIndex);
    }
  }, []);

  const handleFlipPrev = useCallback(() => {
    if (flipBookRef.current) {
      flipBookRef.current.pageFlip().flipPrev();
    }
  }, []);

  const handleFlipNext = useCallback(() => {
    if (flipBookRef.current) {
      flipBookRef.current.pageFlip().flipNext();
    }
  }, []);

  const onFlip = useCallback((e: { data: number }) => {
    setCurrentPage(e.data);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        handleFlipPrev();
      } else if (e.key === "ArrowRight") {
        handleFlipNext();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlipPrev, handleFlipNext]);

  if (!FlipBookComponent) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="newspaper-page" style={{ width: dimensions.width, height: dimensions.height }}>
          <div className="animate-pulse space-y-4 p-6">
            <div className="h-8 bg-stone-200 dark:bg-stone-700 rounded w-3/4 mx-auto" />
            <div className="h-px bg-stone-300 dark:bg-stone-600" />
            <div className="h-4 bg-stone-200 dark:bg-stone-700 rounded w-1/2 mx-auto" />
            <div className="h-px bg-stone-300 dark:bg-stone-600" />
            <div className="space-y-2 mt-6">
              <div className="h-6 bg-stone-200 dark:bg-stone-700 rounded w-4/5" />
              <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded w-1/3" />
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded" />
                  <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded" />
                  <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded w-3/4" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded" />
                  <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded" />
                  <div className="h-3 bg-stone-100 dark:bg-stone-800 rounded w-3/4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const HTMLFlipBook = FlipBookComponent;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Flipbook */}
      <div className="newspaper-flipbook-container w-full flex justify-center">
        <HTMLFlipBook
          ref={flipBookRef}
          width={dimensions.width}
          height={dimensions.height}
          size="stretch"
          minWidth={280}
          maxWidth={1000}
          minHeight={400}
          maxHeight={1400}
          showCover={true}
          mobileScrollSupport={false}
          flippingTime={800}
          usePortrait={isMobile}
          startPage={0}
          drawShadow={true}
          maxShadowOpacity={0.5}
          onFlip={onFlip}
          className="newspaper-flipbook"
          style={{}}
          useMouseEvents={true}
          swipeDistance={30}
          showPageCorners={true}
          disableFlipByClick={false}
          clickEventForward={true}
          startZIndex={0}
          autoSize={true}
        >
          {pages.map((page, idx) => {
            switch (page.type) {
              case "front":
                return (
                  <NewspaperFrontPage
                    key={`page-${idx}`}
                    page={page}
                    edition={newsletter.edition}
                    publishedAt={newsletter.publishedAt}
                    totalPages={totalPages}
                    onNavigateToPage={navigateToPage}
                    headlinePageMap={headlinePageMap}
                  />
                );
              case "article":
                return (
                  <NewspaperArticlePage
                    key={`page-${idx}`}
                    page={page}
                    pageNumber={idx + 1}
                    totalPages={totalPages}
                  />
                );
              case "events":
                return (
                  <NewspaperEventsPage
                    key={`page-${idx}`}
                    page={page}
                    pageNumber={idx + 1}
                    totalPages={totalPages}
                  />
                );
              case "ads":
                return (
                  <NewspaperAdPage
                    key={`page-${idx}`}
                    page={page}
                    pageNumber={idx + 1}
                    totalPages={totalPages}
                  />
                );
            }
          })}
        </HTMLFlipBook>
      </div>

      {/* Navigation */}
      <div className="newspaper-flipbook-nav flex items-center gap-4 print:hidden">
        <button
          onClick={handleFlipPrev}
          disabled={currentPage === 0}
          className="newspaper-nav-btn disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-medium text-stone-500 dark:text-stone-400 tabular-nums"
          style={{ fontFamily: "var(--font-newspaper-body), Georgia, serif" }}
        >
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          onClick={handleFlipNext}
          disabled={currentPage >= totalPages - 1}
          className="newspaper-nav-btn disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Swipe hint on mobile */}
      {isMobile && currentPage === 0 && (
        <p className="text-xs text-stone-400 dark:text-stone-500 animate-pulse print:hidden">
          Swipe or tap edges to flip pages
        </p>
      )}
    </div>
  );
}
