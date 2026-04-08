import React from "react";
import RichTextViewer from "@/components/editor/RichTextViewer";
import type { AdsPageDescriptor } from "@/lib/newsletter-pages";

interface NewspaperAdPageProps {
  page: AdsPageDescriptor;
  pageNumber: number;
  totalPages: number;
}

const NewspaperAdPage = React.forwardRef<HTMLDivElement, NewspaperAdPageProps>(
  ({ page, pageNumber, totalPages }, ref) => {
    const { sections } = page;

    return (
      <div ref={ref} className="newspaper-page">
        <div className="h-full flex flex-col overflow-hidden">
          <div className="newspaper-section-label text-center">
            Notices & Advertisements
          </div>

          <div className="flex-1 overflow-hidden space-y-4 mt-2">
            {sections.map((section) => (
              <div key={section.id} className="newspaper-ad-box">
                <div className="newspaper-ad-label">Advertisement</div>
                <h3 className="newspaper-headline newspaper-headline-sm text-center mb-2">
                  {section.title}
                </h3>
                <div className="text-xs leading-relaxed text-center">
                  <RichTextViewer html={section.contentHtml} />
                </div>
              </div>
            ))}
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

NewspaperAdPage.displayName = "NewspaperAdPage";

export default NewspaperAdPage;
