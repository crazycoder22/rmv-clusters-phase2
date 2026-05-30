import "dotenv/config";
import { prisma } from "../src/lib/prisma";

// Demo seed for the Referendum feature. Rows are tagged "[demo]" in the body
// so _clear-referendums-seed.ts can remove exactly these.
//
// Secret-ballot model: a ReferendumBallot records that a FLAT voted (no choice);
// the choice is reflected only as anonymous voteCount increments on options.
// This seed mirrors that — it inserts ballots from distinct OTHER flats and
// bumps option counters to match, so turnout + results look real, while YOUR
// flat is intentionally left un-voted on the open referendum so you can vote.
const MARK = "[demo]";

async function main() {
  const me = await prisma.resident.findFirst({
    where: { email: "lakshmankamathk@gmail.com" },
  });
  if (!me) throw new Error("your resident record not found");

  // Idempotent: wipe prior demo referendums first (cascade clears options+ballots).
  const old = await prisma.referendum.findMany({
    where: { body: { contains: MARK } },
    select: { id: true },
  });
  if (old.length) {
    await prisma.referendum.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    console.log(`cleared ${old.length} previous demo referendums`);
  }

  // Distinct OTHER flats (exclude my flat so I can still vote on the open one).
  const flatGroups = await prisma.resident.groupBy({
    by: ["block", "flatNumber"],
    where: { isApproved: true, NOT: { block: me.block, flatNumber: me.flatNumber } },
  });
  // Pick one representative resident per flat (the ballot needs a residentId).
  const flats: { block: number; flatNumber: string; residentId: string }[] = [];
  for (const g of flatGroups) {
    const rep = await prisma.resident.findFirst({
      where: { isApproved: true, block: g.block, flatNumber: g.flatNumber },
      select: { id: true },
    });
    if (rep) flats.push({ block: g.block, flatNumber: g.flatNumber, residentId: rep.id });
  }
  if (flats.length < 3) {
    console.warn(`Only ${flats.length} other flats available — demo turnout will be small.`);
  }

  const now = Date.now();
  const inDays = (d: number) => new Date(now + d * 24 * 3600 * 1000);
  const agoDays = (d: number) => new Date(now - d * 24 * 3600 * 1000);

  // Helper: cast N demo ballots spread across the given options (by index),
  // inserting ballot rows from distinct flats + incrementing option counters.
  async function castVotes(
    referendumId: string,
    optionIds: string[],
    distribution: number[], // votes per option, same length as optionIds
    flatOffset: number
  ) {
    let fi = flatOffset;
    for (let oi = 0; oi < optionIds.length; oi++) {
      for (let n = 0; n < (distribution[oi] ?? 0); n++) {
        const flat = flats[fi % flats.length];
        fi++;
        if (!flat) continue;
        // Guard against the unique (referendum, block, flatNumber) constraint
        // if we wrap around the flat list.
        const exists = await prisma.referendumBallot.findUnique({
          where: {
            referendumId_block_flatNumber: {
              referendumId,
              block: flat.block,
              flatNumber: flat.flatNumber,
            },
          },
          select: { id: true },
        });
        if (exists) continue;
        await prisma.referendumBallot.create({
          data: {
            referendumId,
            residentId: flat.residentId,
            block: flat.block,
            flatNumber: flat.flatNumber,
          },
        });
        await prisma.referendumOption.update({
          where: { id: optionIds[oi] },
          data: { voteCount: { increment: 1 } },
        });
      }
    }
    return fi;
  }

  // ── 1) OPEN, ALL_RESIDENTS — you can vote; a few flats already have ──────────
  const open = await prisma.referendum.create({
    data: {
      authorId: me.id,
      title: "Approve the clubhouse renovation budget (₹12L)",
      body:
        "The committee proposes a ₹12 lakh renovation of the clubhouse — new flooring, " +
        "AC, and a revamped kids' area — funded from the corpus. Vote to approve or reject.\n\n" + MARK,
      eligibility: "ALL_RESIDENTS",
      status: "OPEN",
      closesAt: inDays(5),
      options: { create: [
        { text: "Approve the budget", sortOrder: 0 },
        { text: "Reject the budget", sortOrder: 1 },
        { text: "Approve, but cap at ₹8L", sortOrder: 2 },
      ] },
    },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  const offset1 = await castVotes(open.id, open.options.map((o) => o.id), [4, 1, 2], 0);

  // ── 2) CLOSED, ALL_RESIDENTS — results visible ──────────────────────────────
  const closed = await prisma.referendum.create({
    data: {
      authorId: me.id,
      title: "Gym equipment vendor selection",
      body:
        "Voting has ended. Residents chose between three vendors for the new gym " +
        "equipment. Thank you for participating.\n\n" + MARK,
      eligibility: "ALL_RESIDENTS",
      status: "CLOSED",
      closesAt: agoDays(1),
      closedAt: agoDays(1),
      closedById: me.id,
      options: { create: [
        { text: "FitPro Systems", sortOrder: 0 },
        { text: "IronWorks India", sortOrder: 1 },
        { text: "PowerFit Co.", sortOrder: 2 },
      ] },
    },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  await castVotes(closed.id, closed.options.map((o) => o.id), [6, 3, 2], offset1);

  // ── 3) OPEN, OWNERS_ONLY — to test eligibility gating ───────────────────────
  const ownersOnly = await prisma.referendum.create({
    data: {
      authorId: me.id,
      title: "Amend the bye-laws: pet policy (owners only)",
      body:
        "A proposed amendment to the community bye-laws on pets. As this changes the " +
        "registered bye-laws, only owners may vote.\n\n" + MARK,
      eligibility: "OWNERS_ONLY",
      status: "OPEN",
      closesAt: inDays(10),
      options: { create: [
        { text: "Adopt the new pet policy", sortOrder: 0 },
        { text: "Keep the current policy", sortOrder: 1 },
      ] },
    },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
  // a couple of owner-flat votes (best-effort; uses whatever flats exist)
  await castVotes(ownersOnly.id, ownersOnly.options.map((o) => o.id), [1, 1], offset1 + 11);

  // Report
  const summary = async (id: string) => {
    const opts = await prisma.referendumOption.findMany({ where: { referendumId: id }, orderBy: { sortOrder: "asc" } });
    const ballots = await prisma.referendumBallot.count({ where: { referendumId: id } });
    return { ballots, split: opts.map((o) => `${o.text}=${o.voteCount}`).join(", ") };
  };
  console.log("\n✅ Created demo referendums:");
  console.log(`   • [OPEN · all] ${open.title}`);
  console.log(`        ${JSON.stringify(await summary(open.id))} (your flat has NOT voted — go vote!)`);
  console.log(`   • [CLOSED · all] ${closed.title}`);
  console.log(`        ${JSON.stringify(await summary(closed.id))} (results visible)`);
  console.log(`   • [OPEN · owners only] ${ownersOnly.title}`);
  console.log(`        ${JSON.stringify(await summary(ownersOnly.id))} (you can vote only if your flat is an owner)`);
  console.log(`\n   Your flat: Block ${me.block}, ${me.flatNumber} · residentType ${me.residentType}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
