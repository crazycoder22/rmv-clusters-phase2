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
  published?: boolean;
  eventConfig?: EventConfigType | null;
}

export interface MenuItemType {
  id: string;
  name: string;
  pricePerPlate: number;
  sortOrder: number;
}

export interface EventConfigType {
  id: string;
  announcementId: string;
  mealType: "breakfast" | "lunch" | "dinner";
  rsvpDeadline: string;
  menuItems: MenuItemType[];
}

export interface RsvpItemType {
  id: string;
  menuItemId: string;
  menuItem: MenuItemType;
  plates: number;
}

export interface RsvpType {
  id: string;
  eventConfigId: string;
  residentId: string;
  resident: {
    id: string;
    name: string;
    email: string;
    block: number;
    flatNumber: string;
  };
  items: RsvpItemType[];
  paid: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItemFormEntry {
  tempId: string;
  name: string;
  pricePerPlate: string;
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
