import {
  Shield,
  TreePine,
  Baby,
  Droplets,
} from "lucide-react";
import SectionHeading from "@/components/ui/SectionHeading";

const amenities = [
  {
    icon: Shield,
    title: "24/7 Security",
    description:
      "Round-the-clock security with CCTV surveillance and trained security personnel at the gate.",
  },
  {
    icon: TreePine,
    title: "Green Spaces",
    description:
      "Green areas and open spaces for residents to relax and unwind.",
  },
  {
    icon: Baby,
    title: "Children's Play Area",
    description:
      "Play area for children with equipment for outdoor activities.",
  },
  {
    icon: Droplets,
    title: "Water Supply",
    description:
      "Reliable water supply through Cauvery connection and borewell with overhead tank storage.",
  },
];

export default function HighlightsSection() {
  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Community Amenities"
          subtitle="Everything you need for comfortable living, right at your doorstep"
        />
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {amenities.map((amenity, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center mb-4">
                <amenity.icon size={24} className="text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {amenity.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {amenity.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
