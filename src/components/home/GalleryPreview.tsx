import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SectionHeading from "@/components/ui/SectionHeading";
import galleryData from "@/data/gallery.json";

export default function GalleryPreview() {
  const featured = galleryData.images.filter((img) => img.featured).slice(0, 4);

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Community Gallery"
          subtitle="Take a glimpse at life in RMV Clusters Phase II"
        />
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featured.map((image) => (
            <div
              key={image.id}
              className="relative aspect-[4/3] rounded-xl overflow-hidden group"
            >
              <Image
                src={image.thumb}
                alt={image.alt}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="absolute bottom-3 left-3 text-white text-sm font-medium">
                  {image.caption}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/gallery"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium transition-colors"
          >
            View All Photos
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
