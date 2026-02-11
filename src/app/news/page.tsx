import type { Metadata } from "next";
import SectionHeading from "@/components/ui/SectionHeading";
import NewsFeed from "@/components/news/NewsFeed";

export const metadata: Metadata = {
  title: "News & Announcements",
  description:
    "Latest news, updates, and announcements from RMV Clusters Phase II community.",
};

export default function NewsPage() {
  return (
    <div className="py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="News & Announcements"
          subtitle="Stay updated with the latest community news and important notices"
        />
        <div className="mt-12">
          <NewsFeed />
        </div>
      </div>
    </div>
  );
}
