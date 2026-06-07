import { HeartPulse, Phone, Shield, Siren, type LucideIcon } from "lucide-react";

export type EmergencyContact = { name: string; phone: string; icon: LucideIcon };

// Community emergency phone numbers (shared by Home + the Emergency hub page).
export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  { name: "Security at MainGate", phone: "9019903594", icon: Shield },
  { name: "Kodigehalli Police Station", phone: "+91 80 22943703", icon: Siren },
  { name: "RMV Hospital", phone: "+91 80 42664366", icon: HeartPulse },
  { name: "MS Ramaiah Hospital", phone: "+91 80 40502000", icon: HeartPulse },
  { name: "Helpline (Police / Fire / Ambulance)", phone: "112", icon: Phone },
];
