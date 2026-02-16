import type { Metadata } from "next";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import SectionHeading from "@/components/ui/SectionHeading";
import siteData from "@/data/site.json";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with RMV Clusters Phase II management. Find our location, office hours, and emergency contacts.",
};

export default function ContactPage() {
  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Contact Us"
          subtitle="Get in touch with the management office or find our location"
        />

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Information */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Management Office
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin size={18} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Address</p>
                    <p className="text-sm text-gray-600">
                      {siteData.address.line1}
                      <br />
                      {siteData.address.line2}
                      <br />
                      {siteData.address.city}, {siteData.address.state}{" "}
                      {siteData.address.zip}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                    <Phone size={18} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Phone</p>
                    <p className="text-sm text-gray-600">
                      {siteData.contact.phone}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                    <Mail size={18} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email</p>
                    <p className="text-sm text-gray-600">
                      {siteData.contact.email}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                    <Clock size={18} className="text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Office Hours
                    </p>
                    <p className="text-sm text-gray-600">
                      {siteData.contact.officeHours}
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Email CTA */}
            <a
              href={`mailto:${siteData.contact.email}`}
              className="block bg-primary-600 hover:bg-primary-700 text-white text-center py-3 px-6 rounded-lg font-medium transition-colors"
            >
              Send us an Email
            </a>
          </div>

          {/* Map */}
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
            <iframe
              src={siteData.googleMapsEmbedUrl}
              width="100%"
              height="400"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="RMV Clusters Phase II Location"
              className="w-full h-[400px] lg:h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
