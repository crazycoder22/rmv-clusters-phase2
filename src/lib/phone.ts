/**
 * Normalise an Indian phone number to its 10-digit form (strips +91, leading
 * 91, a leading 0, spaces, and dashes). Returns null if it can't be reduced to
 * a 10-digit number. Used both when storing public-event registrations and when
 * matching a logged-in resident back to their (phone-keyed) registrations.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}
