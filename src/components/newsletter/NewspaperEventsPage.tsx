import React from "react";
import RichTextViewer from "@/components/editor/RichTextViewer";
import type { EventsPageDescriptor } from "@/lib/newsletter-pages";

interface NewspaperEventsPageProps {
  page: EventsPageDescriptor;
  pageNumber: number;
  totalPages: number;
}

const NewspaperEventsPage = React.forwardRef<HTMLDivElement, NewspaperEventsPageProps>(
  ({ page, pageNumber, totalPages }, ref) => {
    const { section } = page;

    return (
      <div ref={ref} className="newspaper-page">
        <div className="h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div className="text-center mb-3">
            <div className="newspaper-section-label text-center">
              Community Events
            </div>
            <h2 className="newspaper-headline newspaper-headline-md">
              {section.title}
            </h2>
          </div>

          <hr className="newspaper-divider" />

          {/* Events content */}
          <div className="flex-1 overflow-hidden">
            <div className="newspaper-body-columns">
              <RichTextViewer html={section.contentHtml} />
            </div>
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

NewspaperEventsPage.displayName = "NewspaperEventsPage";

export default NewspaperEventsPage;
