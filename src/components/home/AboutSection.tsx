import Image from "next/image";
import { MapPin, Shield, Leaf, Users } from "lucide-react";

const highlights = [
  { icon: Shield, text: "24/7 Security with CCTV surveillance" },
  { icon: Leaf, text: "Well-maintained common areas and green spaces" },
  { icon: Users, text: "Active and welcoming community" },
  { icon: MapPin, text: "Prime location in Devinagar, Bengaluru" },
];

export default function AboutSection() {
  return (
    <section id="about" className="py-16 bg-primary-50 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              Welcome to Our Community
            </h2>
            <div className="h-1 w-16 bg-primary-500 rounded mb-6" />
            <p className="text-gray-700 leading-relaxed mb-6">
              RMV Clusters Phase II is a well-established residential apartment
              community located in the heart of Devinagar, Bengaluru. Our
              community offers a comfortable and secure living environment
              with a close-knit neighbourhood.
            </p>
            <ul className="space-y-3">
              {highlights.map((item, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center shrink-0">
                    <item.icon size={16} className="text-accent-600" />
                  </div>
                  <span className="text-gray-700">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative h-80 lg:h-96 rounded-xl overflow-hidden shadow-lg">
            <Image
              src="/images/gallery/block-3.jpg"
              alt="Block 3 of RMV Clusters Phase II"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
