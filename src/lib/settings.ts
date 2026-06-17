import { prisma } from "@/lib/prisma";

// Global app settings keys (stored in the AppSetting key/value table).
export const AUTO_APPROVE_REGISTRATIONS = "autoApproveRegistrations";

/** Read a boolean app setting; returns `fallback` if unset. */
export async function getBoolSetting(key: string, fallback = false): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  return row.value === "true";
}

/** Upsert a boolean app setting. */
export async function setBoolSetting(key: string, value: boolean): Promise<void> {
  const v = value ? "true" : "false";
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: v },
    update: { value: v },
  });
}
