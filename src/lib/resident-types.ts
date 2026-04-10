/**
 * Shared constants for Resident types.
 * The DB `Resident.residentType` column is a free-form String, but these are
 * the only values accepted by the API validators and shown in UI dropdowns.
 */
export const RESIDENT_TYPES = [
  "OWNER",
  "OWNER_FAMILY",
  "TENANT",
  "TENANT_FAMILY",
  "MULTI_TENANT",
] as const;

export type ResidentType = (typeof RESIDENT_TYPES)[number];

export const RESIDENT_TYPE_LABELS: Record<ResidentType, string> = {
  OWNER: "Owner",
  OWNER_FAMILY: "Owner Family",
  TENANT: "Tenant",
  TENANT_FAMILY: "Tenant Family",
  MULTI_TENANT: "Multi Tenant",
};

/** Tailwind badge colour classes keyed by type. Used in admin residents list. */
export const RESIDENT_TYPE_BADGE_CLASSES: Record<ResidentType, string> = {
  OWNER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  OWNER_FAMILY: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  TENANT: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  TENANT_FAMILY: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  MULTI_TENANT: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

export function isValidResidentType(value: unknown): value is ResidentType {
  return typeof value === "string" && (RESIDENT_TYPES as readonly string[]).includes(value);
}
