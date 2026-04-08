import React from "react";

interface NewspaperPageProps {
  pageNumber?: number;
  totalPages?: number;
  children: React.ReactNode;
  className?: string;
}

const NewspaperPage = React.forwardRef<HTMLDivElement, NewspaperPageProps>(
  ({ pageNumber, totalPages, children, className = "" }, ref) => {
    return (
      <div ref={ref} className={`newspaper-page ${className}`}>
        <div className="h-full flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">{children}</div>
        </div>
        {pageNumber !== undefined && (
          <div className="newspaper-page-number">
            {pageNumber}
            {totalPages !== undefined && ` of ${totalPages}`}
          </div>
        )}
      </div>
    );
  }
);

NewspaperPage.displayName = "NewspaperPage";

export default NewspaperPage;
