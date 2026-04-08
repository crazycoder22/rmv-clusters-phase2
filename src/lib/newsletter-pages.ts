import type { NewsletterData, NewsletterSectionData, NewsletterSectionType } from "@/types";

export interface FrontPageDescriptor {
  type: "front";
  coverHtml: string | null;
  leadSection: NewsletterSectionData | null;
  headlineSections: NewsletterSectionData[];
}

export interface ArticlePageDescriptor {
  type: "article";
  section: NewsletterSectionData;
}

export interface EventsPageDescriptor {
  type: "events";
  section: NewsletterSectionData;
}

export interface AdsPageDescriptor {
  type: "ads";
  sections: NewsletterSectionData[];
}

export type PageDescriptor =
  | FrontPageDescriptor
  | ArticlePageDescriptor
  | EventsPageDescriptor
  | AdsPageDescriptor;

export function organizeIntoPages(newsletter: NewsletterData): PageDescriptor[] {
  const pages: PageDescriptor[] = [];
  const sections = [...newsletter.sections].sort((a, b) => a.sortOrder - b.sortOrder);

  // Separate by type
  const newsSections = sections.filter((s) => s.type === "news" || s.type === "article");
  const eventsSections = sections.filter((s) => s.type === "events");
  const adSections = sections.filter((s) => s.type === "ad");

  // Front page
  const leadSection = newsSections[0] || sections[0] || null;
  const headlineSections = newsSections.slice(1, 4);
  pages.push({
    type: "front",
    coverHtml: newsletter.coverHtml,
    leadSection,
    headlineSections,
  });

  // Inner pages for remaining news/article sections
  const remainingSections = leadSection
    ? newsSections.filter((s) => s.id !== leadSection.id && !headlineSections.some((h) => h.id === s.id))
    : [];

  // All headline sections also get their own inner pages
  for (const section of headlineSections) {
    pages.push({ type: "article", section });
  }

  for (const section of remainingSections) {
    pages.push({ type: "article", section });
  }

  // Events pages
  for (const section of eventsSections) {
    pages.push({ type: "events", section });
  }

  // Ads: combine into groups of up to 3
  if (adSections.length > 0) {
    for (let i = 0; i < adSections.length; i += 3) {
      pages.push({ type: "ads", sections: adSections.slice(i, i + 3) });
    }
  }

  return pages;
}

export function extractExcerpt(html: string, maxLength: number = 200): string {
  // Strip HTML tags
  const text = html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
  if (text.length <= maxLength) return text;
  // Cut at last space before maxLength
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + "...";
}

export function stripHtmlToFirstParagraph(html: string): string {
  // Get content of the first <p> tag, or first chunk of text
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  if (match) {
    return match[1].replace(/<[^>]*>/g, "").trim();
  }
  return html.replace(/<[^>]*>/g, "").trim();
}

export function getSectionTypeLabel(type: NewsletterSectionType): string {
  const labels: Record<NewsletterSectionType, string> = {
    news: "News",
    article: "Feature",
    ad: "Advertisement",
    events: "Community Events",
  };
  return labels[type] || type;
}
