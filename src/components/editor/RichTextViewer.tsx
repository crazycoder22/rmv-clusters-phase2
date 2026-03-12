"use client";

interface RichTextViewerProps {
  html: string;
  className?: string;
}

export default function RichTextViewer({ html, className = "" }: RichTextViewerProps) {
  return (
    <div
      className={`newsletter-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
