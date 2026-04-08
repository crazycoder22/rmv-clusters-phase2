import React from "react";
import RichTextViewer from "@/components/editor/RichTextViewer";
import type { ArticlePageDescriptor } from "@/lib/newsletter-pages";
import { getSectionTypeLabel } from "@/lib/newsletter-pages";

interface NewspaperArticlePageProps {
  page: ArticlePageDescriptor;
  pageNumber: number;
  totalPages: number;
}

const NewspaperArticlePage = React.forwardRef<HTMLDivElement, NewspaperArticlePageProps>(
  ({ page, pageNumber, totalPages }, ref) => {
    const { section } = page;

    return (
      <div ref={ref} className="newspaper-page">
        <div className="h-full flex flex-col overflow-hidden">
          {/* Section label */}
          <div className="newspaper-section-label">
            {getSectionTypeLabel(section.type)}
          </div>

          {/* Headline */}
          <h2 className="newspaper-headline newspaper-headline-lg mb-1">
            {section.title}
          </h2>

          {/* Byline */}
          {section.authorName && (
            <p className="newspaper-byline">
              By {section.authorName}
              {section.authorBlock
                ? ` — Block ${section.authorBlock}${section.authorFlat ? `, ${section.authorFlat}` : ""}`
                : ""}
            </p>
          )}

          <hr className="newspaper-divider" />

          {/* Article body in columns */}
          <div className="flex-1 overflow-hidden newspaper-body-columns newspaper-dropcap">
            <RichTextViewer html={section.contentHtml} />
          </div>

          {/* Page number */}
          <div className="newspaper-page-number">
            {pageNumber} of {totalPages}
          </div>
        </div>
      </div>
    );
  }
);

NewspaperArticlePage.displayName = "NewspaperArticlePage";

export default NewspaperArticlePage;
