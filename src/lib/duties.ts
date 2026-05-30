// Shared helpers for the Duty Checklist Tracker — recurring daily staff duties.
// "Today" always derives from the server clock in IST (istTodayYmd), never the
// client. One completion per item per IST day.

export const MAX_TITLE = 120;
export const MAX_ITEMS = 30;
export const MAX_OWNERS = 10;

export type DutyReminderWaveValue = "MORNING" | "EVENING";

export interface ValidatedChecklist {
  title: string;
  description: string | null;
  reminderWave: DutyReminderWaveValue;
  items: string[];
  ownerIds: string[];
}

export function validateChecklist(
  raw: unknown
): { ok: true; data: ValidatedChecklist } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid request" };
  const r = raw as Record<string, unknown>;

  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!title) return { ok: false, error: "Give the checklist a name" };
  if (title.length > MAX_TITLE) return { ok: false, error: `Name must be under ${MAX_TITLE} characters` };

  const reminderWave: DutyReminderWaveValue = r.reminderWave === "EVENING" ? "EVENING" : "MORNING";

  if (!Array.isArray(r.items)) return { ok: false, error: "Add at least one duty item" };
  const items = r.items
    .map((i) => (typeof i === "string" ? i.trim() : ""))
    .filter((i) => i.length > 0);
  if (items.length < 1) return { ok: false, error: "Add at least one duty item" };
  if (items.length > MAX_ITEMS) return { ok: false, error: `At most ${MAX_ITEMS} items` };
  if (items.some((i) => i.length > MAX_TITLE)) return { ok: false, error: `Each item must be under ${MAX_TITLE} characters` };

  const ownerIds = Array.isArray(r.ownerIds)
    ? Array.from(new Set(r.ownerIds.filter((o): o is string => typeof o === "string" && o.length > 0)))
    : [];
  if (ownerIds.length > MAX_OWNERS) return { ok: false, error: `At most ${MAX_OWNERS} owners` };

  const description = typeof r.description === "string" && r.description.trim() ? r.description.trim() : null;

  return { ok: true, data: { title, description, reminderWave, items, ownerIds } };
}
