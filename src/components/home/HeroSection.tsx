import Image from "next/image";
import Link from "next/link";
import siteData from "@/data/site.json";

export default function HeroSection() {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center">
      <Image
        src="/images/hero-bg.jpg"
        alt={`${siteData.name} community view`}
        fill
        className="object-cover"
        priority
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/40" />
      <div className="relative z-10 text-center text-white px-4">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 drop-shadow-lg">
          {siteData.name}
        </h1>
        <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto drop-shadow">
          {siteData.tagline}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="#about"
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Explore Our Community
          </Link>
          <Link
            href="/contact"
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-6 py-3 rounded-lg font-medium transition-colors border border-white/30"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </section>
  );
}
