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
  category: "maintenance" | "event" | "general" | "urgent" | "sports";
  priority: "low" | "normal" | "high";
  summary: string;
  body: string;
  author: string;
  link?: string;
  linkText?: string;
  published?: boolean;
  eventConfig?: EventConfigType | null;
  sportsConfig?: SportsConfigType | null;
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
  mealType: "breakfast" | "lunch" | "dinner" | null;
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

// Sports Event types
export interface SportItemType {
  id: string;
  name: string;
  sortOrder: number;
}

export interface SportsConfigType {
  id: string;
  announcementId: string;
  registrationDeadline: string;
  sportItems: SportItemType[];
}

export interface SportItemFormEntry {
  tempId: string;
  name: string;
}

export interface ParticipantFormEntry {
  tempId: string;
  name: string;
  ageCategory: "kid" | "teen" | "adult";
  sportItemIds: string[];
}

export interface ParticipantType {
  id: string;
  name: string;
  ageCategory: string;
  sports: { id: string; sportItemId: string; sportItem: SportItemType }[];
}

export interface SportsRegistrationType {
  id: string;
  sportsConfigId: string;
  residentId: string;
  resident: {
    id: string;
    name: string;
    email: string;
    block: number;
    flatNumber: string;
  };
  participants: ParticipantType[];
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Notification types
export interface NotificationType {
  id: string;
  announcementId: string | null;
  visitorId: string | null;
  issueId: string | null;
  taskId: string | null;
  read: boolean;
  createdAt: string;
  announcement: {
    id: string;
    title: string;
    category: "maintenance" | "event" | "general" | "urgent" | "sports";
  } | null;
  visitor: {
    id: string;
    name: string;
    status: string;
  } | null;
  issue: {
    id: string;
    title: string;
    category: string;
    status: string;
  } | null;
  task: {
    id: string;
    title: string;
    status: string;
    priority: string;
  } | null;
}

// Visitor types
export interface VisitorRecord {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  vehicleNumber: string | null;
  visitingBlock: number;
  visitingFlat: string;
  status: string;
  createdAt: string;
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
