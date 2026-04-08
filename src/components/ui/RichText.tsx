"use client";

import { formatRichText } from "@/lib/format-text";

/**
 * Renders plain text with common formatting (newlines, URLs, bullets, bold, italic)
 * as properly styled HTML.
 */
export default function RichText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <div
      className={`rich-text leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: formatRichText(text) }}
    />
  );
}
