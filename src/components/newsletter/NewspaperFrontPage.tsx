import React from "react";
import NewspaperMasthead from "./NewspaperMasthead";
import RichTextViewer from "@/components/editor/RichTextViewer";
import type { FrontPageDescriptor } from "@/lib/newsletter-pages";
import { extractExcerpt, getSectionTypeLabel } from "@/lib/newsletter-pages";

interface NewspaperFrontPageProps {
  page: FrontPageDescriptor;
  edition?: string | null;
  publishedAt?: string | null;
  totalPages: number;
  onNavigateToPage?: (pageIndex: number) => void;
  headlinePageMap?: Map<string, number>;
}

const NewspaperFrontPage = React.forwardRef<HTMLDivElement, NewspaperFrontPageProps>(
  ({ page, edition, publishedAt, totalPages, onNavigateToPage, headlinePageMap }, ref) => {
    const { coverHtml, leadSection, headlineSections } = page;

    return (
      <div ref={ref} className="newspaper-page">
        <div className="h-full flex flex-col overflow-hidden">
          <NewspaperMasthead edition={edition} publishedAt={publishedAt} />

          {/* Lead story + sidebar */}
          <div className="newspaper-front-grid flex-1 overflow-hidden">
            {/* Lead story */}
            <div>
              {leadSection && (
                <>
                  <div className="newspaper-section-label">
                    {getSectionTypeLabel(leadSection.type)}
                  </div>
                  <h2 className="newspaper-headline newspaper-headline-lg">
                    {leadSection.title}
                  </h2>
                  {leadSection.authorName && (
                    <p className="newspaper-byline">
                      By {leadSection.authorName}
                    </p>
                  )}
                  <p className="newspaper-excerpt newspaper-dropcap">
                    {extractExcerpt(leadSection.contentHtml, 280)}
                  </p>
                  <hr className="newspaper-divider" />
                </>
              )}

              {/* Editor's note if present */}
              {coverHtml && (
                <div className="mt-1">
                  <p className="newspaper-section-label">Editor&apos;s Note</p>
                  <div className="newspaper-excerpt italic text-xs leading-relaxed opacity-80 overflow-hidden" style={{ maxHeight: '5rem' }}>
                    <RichTextViewer html={coverHtml} />
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar headlines */}
            {headlineSections.length > 0 && (
              <div className="newspaper-front-sidebar space-y-3">
                {headlineSections.map((section) => {
                  const pageIdx = headlinePageMap?.get(section.id);
                  return (
                    <div key={section.id} className="pb-3 border-b border-stone-300 dark:border-stone-700 last:border-b-0">
                      <div className="newspaper-section-label">
                        {getSectionTypeLabel(section.type)}
                      </div>
                      <h3
                        className="newspaper-headline newspaper-headline-sm cursor-pointer hover:underline"
                        onClick={() => pageIdx !== undefined && onNavigateToPage?.(pageIdx)}
                      >
                        {section.title}
                      </h3>
                      {section.authorName && (
                        <p className="newspaper-byline text-[0.65rem]">
                          By {section.authorName}
                        </p>
                      )}
                      <p className="newspaper-excerpt text-[0.7rem] leading-snug">
                        {extractExcerpt(section.contentHtml, 80)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Page number */}
          <div className="newspaper-page-number">1 of {totalPages}</div>
        </div>
      </div>
    );
  }
);

NewspaperFrontPage.displayName = "NewspaperFrontPage";

export default NewspaperFrontPage;
