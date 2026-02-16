import Link from "next/link";
import { MapPin, Phone, Mail, Clock, Instagram, Youtube } from "lucide-react";
import siteData from "@/data/site.json";

const quickLinks = [
  { href: "/", label: "Home" },
  { href: "/contact", label: "Contact" },
];

export default function Footer() {
  return (
    <footer className="bg-primary-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-semibold mb-4">{siteData.name}</h3>
            <p className="text-primary-200 text-sm leading-relaxed mb-4">
              A well-established apartment community in Devinagar, Bengaluru. Stay
              connected with your neighbours and stay informed about community
              happenings.
            </p>
            <div className="flex gap-3">
              {siteData.socialLinks.instagram && (
                <a
                  href={siteData.socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-primary-800 flex items-center justify-center text-primary-200 hover:text-white hover:bg-primary-700 transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram size={18} />
                </a>
              )}
              {siteData.socialLinks.youtube && (
                <a
                  href={siteData.socialLinks.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-primary-800 flex items-center justify-center text-primary-200 hover:text-white hover:bg-primary-700 transition-colors"
                  aria-label="YouTube"
                >
                  <Youtube size={18} />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-primary-200 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact</h3>
            <ul className="space-y-3 text-sm text-primary-200">
              <li className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 shrink-0" />
                <span>
                  {siteData.address.line2}, {siteData.address.city},{" "}
                  {siteData.address.zip}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={16} className="shrink-0" />
                <span>{siteData.contact.phone}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={16} className="shrink-0" />
                <span>{siteData.contact.email}</span>
              </li>
              <li className="flex items-center gap-2">
                <Clock size={16} className="shrink-0" />
                <span>{siteData.contact.officeHours}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-800 mt-8 pt-8 text-center text-sm text-primary-300">
          <p>
            &copy; {new Date().getFullYear()} {siteData.name}. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
