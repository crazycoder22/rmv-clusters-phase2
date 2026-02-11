import type { Metadata } from "next";
import SectionHeading from "@/components/ui/SectionHeading";
import GalleryGrid from "@/components/gallery/GalleryGrid";

export const metadata: Metadata = {
  title: "Photo Gallery",
  description:
    "Browse photos of RMV Clusters Phase II community, amenities, and events.",
};

export default function GalleryPage() {
  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Photo Gallery"
          subtitle="Explore our beautiful community through photos"
        />
        <div className="mt-12">
          <GalleryGrid />
        </div>
      </div>
    </div>
  );
}
