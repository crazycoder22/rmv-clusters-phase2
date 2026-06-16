import fs from "fs";
import { prisma } from "@/lib/prisma";
import { upsertStepEntries } from "@/lib/steps";

const CSV_PATH =
  "/Users/lakshmankamath/Downloads/New Folder With Items 36/f4f47b10-694c-11f1-9920-576a8b9fc22c.csv";
const ANNOUNCEMENT_ID = "cmq6yv8a60000cw0xnwqbu3ky";
const WINDOW_START = "2026-06-15";
const WINDOW_END = "2026-06-28";

const EXCLUDE = [
  "archana",
  "lakshman",
  "raviteja",
  "jyothirmayi",
  "ramu kamath",
  "rajeshwari",
];

// CSV name -> registered resident name
const ALIASES: Record<string, string> = {
  "sainyukta kavi": "S K",
  "madhura kavi": "Mrs. Madhura Abhijit Kavi",
  "deepthi shenoy": "Deepti Pramod Shenoy",
  "vignesh kamath": "vignesha kamath",
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const tokens = (s: string) =>
  norm(s)
    .split(" ")
    .filter((t) => t.length > 1);

// Naive CSV split (no quoted commas in this export)
function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.length > 0)
    .map((l) => l.split(","));
}

async function main() {
  const ann = await prisma.announcement.findUnique({
    where: { id: ANNOUNCEMENT_ID },
    select: { eventConfig: { select: { id: true } } },
  });
  const eventConfigId = ann?.eventConfig?.id;
  if (!eventConfigId) {
    console.log("ERROR: could not resolve eventConfig id");
    return;
  }

  const rows = parseCsv(fs.readFileSync(CSV_PATH, "utf8"));
  const header = rows[0];
  const dateCols: { idx: number; date: string }[] = [];
  header.forEach((h, i) => {
    const t = h.trim();
    if (/^2026-\d\d-\d\d$/.test(t) && t >= WINDOW_START && t <= WINDOW_END) {
      dateCols.push({ idx: i, date: t });
    }
  });
  console.log("Date columns in window:", dateCols.map((d) => d.date).join(", ") || "(none)");
  if (dateCols.length === 0) {
    console.log("No in-window date columns; making no changes.");
    return;
  }

  // Load registered participants
  const rsvps = await prisma.rsvp.findMany({
    where: { eventConfigId },
    select: { id: true, resident: { select: { name: true } } },
  });
  const registered = rsvps
    .filter((r) => r.resident?.name)
    .map((r) => ({ rsvpId: r.id, name: r.resident!.name as string }));

  const findMatch = (csvName: string): { rsvpId: string; name: string } | null => {
    const n = norm(csvName);
    // a. exact
    let m = registered.find((r) => norm(r.name) === n);
    if (m) return m;
    // b. alias
    const aliasTarget = ALIASES[n];
    if (aliasTarget) {
      m = registered.find((r) => norm(r.name) === norm(aliasTarget));
      if (m) return m;
    }
    // c. fuzzy: same first & last token (after dropping 1-char tokens)
    const ct = tokens(csvName);
    if (ct.length >= 1) {
      const cFirst = ct[0];
      const cLast = ct[ct.length - 1];
      m = registered.find((r) => {
        const rt = tokens(r.name);
        if (rt.length < 1) return false;
        return rt[0] === cFirst && rt[rt.length - 1] === cLast;
      });
      if (m) return m;
    }
    return null;
  };

  const NAME_COL = 1;
  const entries: { date: string; steps: number; rsvpId: string }[] = [];
  const excluded: string[] = [];
  const unmatched: { name: string; steps: number }[] = [];
  const rsvpNames = new Map<string, string>(); // rsvpId -> resident name

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = (row[NAME_COL] || "").trim();
    if (!name) continue;
    const nn = norm(name);
    if (EXCLUDE.some((ex) => nn.includes(ex))) {
      excluded.push(name);
      continue;
    }
    // gather in-window steps for this row
    const rowEntries: { date: string; steps: number }[] = [];
    for (const dc of dateCols) {
      const cell = (row[dc.idx] || "").trim();
      if (!cell || cell.toUpperCase() === "N.A") continue;
      const steps = parseInt(cell, 10);
      if (!Number.isFinite(steps) || steps === 0) continue;
      rowEntries.push({ date: dc.date, steps });
    }
    if (rowEntries.length === 0) continue;

    const match = findMatch(name);
    if (!match) {
      const total = rowEntries.reduce((a, b) => a + b.steps, 0);
      unmatched.push({ name, steps: total });
      continue;
    }
    rsvpNames.set(match.rsvpId, match.name);
    for (const re of rowEntries) {
      entries.push({ date: re.date, steps: re.steps, rsvpId: match.rsvpId });
    }
  }

  // Capture existing values for changed-value reporting
  const existingByKey = new Map<string, number>();
  const keyOf = (rsvpId: string, date: string) => `${rsvpId}|${date}`;
  const uniqRsvpIds = [...new Set(entries.map((e) => e.rsvpId))];
  const existing = await prisma.stepEntry.findMany({
    where: {
      eventConfigId,
      rsvpId: { in: uniqRsvpIds },
      date: { in: dateCols.map((d) => new Date(d.date + "T00:00:00.000Z")) },
    },
    select: { rsvpId: true, date: true, steps: true },
  });
  for (const e of existing) {
    const ds = e.date.toISOString().slice(0, 10);
    if (e.rsvpId) existingByKey.set(keyOf(e.rsvpId, ds), e.steps);
  }

  const result = await upsertStepEntries(eventConfigId, entries);

  // Report
  console.log("\n=== SYNC RESULT ===");
  console.log("eventConfigId:", eventConfigId);
  console.log("upsert result:", JSON.stringify(result));

  // per-date counts
  const perDate: Record<string, number> = {};
  for (const e of entries) perDate[e.date] = (perDate[e.date] || 0) + 1;
  console.log("\nEntries upserted per date:");
  for (const d of Object.keys(perDate).sort()) console.log(`  ${d}: ${perDate[d]}`);

  // changed / new values
  const changed: string[] = [];
  const added: string[] = [];
  for (const e of entries) {
    const prev = existingByKey.get(keyOf(e.rsvpId, e.date));
    const who = rsvpNames.get(e.rsvpId) || e.rsvpId;
    if (prev === undefined) {
      added.push(`  + ${who} ${e.date}: ${e.steps}`);
    } else if (prev !== e.steps) {
      changed.push(`  ~ ${who} ${e.date}: ${prev} -> ${e.steps}`);
    }
  }
  console.log("\nNewly-added entries (no prior value):");
  console.log(added.length ? added.join("\n") : "  (none)");
  console.log("\nChanged values (old -> new):");
  console.log(changed.length ? changed.join("\n") : "  (none)");

  console.log("\nUnmatched (needs manual registration):");
  console.log(
    unmatched.length
      ? unmatched.map((u) => `  ${u.name}: ${u.steps}`).join("\n")
      : "  (none)"
  );

  console.log("\nExcluded (synced via OneRMV app):");
  console.log(excluded.length ? "  " + excluded.join(", ") : "  (none)");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect();
  });
