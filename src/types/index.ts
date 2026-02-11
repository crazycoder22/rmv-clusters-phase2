export interface SiteConfig {
  name: string;
  tagline: string;
  address: Address;
  contact: ContactInfo;
  googleMapsEmbedUrl: string;
  socialLinks: Record<string, string>;
  noticeBanner: NoticeBanner | null;
  emergencyContacts: EmergencyContact[];
}

export interface Address {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

export interface ContactInfo {
  phone: string;
  email: string;
  officeHours: string;
}

export interface NoticeBanner {
  message: string;
  type: "info" | "warning" | "urgent";
  active: boolean;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  icon: string;
}

export interface GuidelineSection {
  id: string;
  title: string;
  icon: string;
  rules: Rule[];
}

export interface Rule {
  title: string;
  description: string;
}

export interface GuidelinesData {
  lastUpdated: string;
  sections: GuidelineSection[];
}

export interface Announcement {
  id: string;
  title: string;
  date: string;
  category: "maintenance" | "event" | "general" | "urgent";
  priority: "low" | "normal" | "high";
  summary: string;
  body: string;
  author: string;
  link?: string;
  linkText?: string;
}

export interface GalleryImage {
  id: string;
  src: string;
  thumb: string;
  alt: string;
  caption: string;
  category: string;
  featured: boolean;
}

export interface GalleryData {
  images: GalleryImage[];
  categories: string[];
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface FAQData {
  categories: string[];
  items: FAQItem[];
}
