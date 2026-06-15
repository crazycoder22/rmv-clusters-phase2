import { HeartPulse, Phone, Siren, type LucideIcon } from "lucide-react";

// `icon` (lucide) is used by Home; `ms` is the Material Symbol name used by the
// OneRMV Emergency hub page.
export type EmergencyContact = { name: string; phone: string; icon: LucideIcon; ms: string };

// Community emergency phone numbers (shared by Home + the Emergency hub page).
export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { name: "Facility Manager", phone: "9945038871", icon: Phone, ms: "call" },
  { name: "Kodigehalli Police Station", phone: "+91 80 22943703", icon: Siren, ms: "local_police" },
  { name: "RMV Hospital", phone: "+91 80 42664366", icon: HeartPulse, ms: "cardiology" },
  { name: "MS Ramaiah Hospital", phone: "+91 80 40502000", icon: HeartPulse, ms: "cardiology" },
  { name: "Helpline (Police / Fire / Ambulance)", phone: "112", icon: Phone, ms: "emergency" },
];
