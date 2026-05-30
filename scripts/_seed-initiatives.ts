import "dotenv/config";
import { prisma } from "../src/lib/prisma";

// Demo seed for the Initiatives feature. All rows are tagged "[demo]" in the
// initiative body so _clear-initiatives-seed.ts can remove exactly these.
const MARK = "[demo]";

async function main() {
  const me = await prisma.resident.findFirst({
    where: { email: "lakshmankamathk@gmail.com" },
  });
  if (!me) throw new Error("your resident record not found");

  // Idempotent: wipe prior demo initiatives first (cascade clears comments+likes).
  const old = await prisma.initiative.findMany({
    where: { body: { contains: MARK } },
    select: { id: true },
  });
  if (old.length) {
    await prisma.initiative.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    console.log(`cleared ${old.length} previous demo initiatives`);
  }

  const others = await prisma.resident.findMany({
    where: { isApproved: true, id: { not: me.id } },
    take: 5,
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const pick = (i: number) => (others.length ? others[i % others.length] : me);

  const now = Date.now();
  const inDays = (d: number) => new Date(now + d * 24 * 3600 * 1000);
  const agoDays = (d: number) => new Date(now - d * 24 * 3600 * 1000);

  // ── Initiative 1: OPEN, authored by you (so you can post + reply as committee)
  const open = await prisma.initiative.create({
    data: {
      authorId: me.id,
      title: "New visitor parking policy",
      body:
        "We're proposing dedicated visitor parking in the stilt area of Tower B, " +
        "with a 3-hour limit enforced via the gate register. Share your thoughts " +
        "before we finalise with the facility team.\n\n" + MARK,
      status: "OPEN",
      commentsCloseAt: inDays(7),
    },
  });

  // Top-level feedback from a few residents
  const fb1 = await prisma.initiativeComment.create({
    data: {
      initiativeId: open.id,
      authorId: pick(0).id,
      parentId: null,
      content: "Great idea, but 3 hours is too short for guests who come for lunch. Can we make it 5?",
      isOfficial: false,
      createdAt: agoDays(2),
    },
  });
  const fb2 = await prisma.initiativeComment.create({
    data: {
      initiativeId: open.id,
      authorId: pick(1).id,
      parentId: null,
      content: "Who enforces the limit at night? The gate is unmanned after 11pm.",
      isOfficial: false,
      createdAt: agoDays(1),
    },
  });
  await prisma.initiativeComment.create({
    data: {
      initiativeId: open.id,
      authorId: pick(2).id,
      parentId: null,
      content: "Please reserve at least one slot for differently-abled visitors near the lift.",
      isOfficial: false,
      createdAt: agoDays(1),
    },
  });

  // Committee reply (you) under the first feedback
  await prisma.initiativeComment.create({
    data: {
      initiativeId: open.id,
      authorId: me.id,
      parentId: fb1.id,
      content: "Fair point — we'll trial a 5-hour limit for the first month and review.",
      isOfficial: true,
      createdAt: agoDays(1),
    },
  });

  // Some likes on the feedback (from other residents)
  const likers = others.slice(0, 3);
  for (const r of likers) {
    await prisma.initiativeCommentLike.create({ data: { commentId: fb1.id, residentId: r.id } });
  }
  if (likers[0]) {
    await prisma.initiativeCommentLike.create({ data: { commentId: fb2.id, residentId: likers[0].id } });
  }

  // ── Initiative 2: OPEN, authored by another resident (committee member-ish demo)
  const open2 = await prisma.initiative.create({
    data: {
      authorId: pick(0).id,
      title: "Switch to compostable garbage bags",
      body:
        "Proposal to move the whole community to compostable wet-waste bags from next " +
        "quarter. Slightly higher cost (~₹40/month per flat) but big reduction in plastic. " +
        "Feedback welcome.\n\n" + MARK,
      status: "OPEN",
      commentsCloseAt: inDays(3),
    },
  });
  await prisma.initiativeComment.create({
    data: {
      initiativeId: open2.id,
      authorId: me.id,
      parentId: null,
      content: "Strongly support this. Could we get a sample before committing?",
      isOfficial: false,
      createdAt: agoDays(1),
    },
  });

  // ── Initiative 3: CLOSED (deadline in the past) — to see read-only state
  await prisma.initiative.create({
    data: {
      authorId: me.id,
      title: "Diwali celebration plan 2025 (closed)",
      body:
        "Feedback window for the Diwali plan has ended. Thanks to everyone who " +
        "contributed — the committee has finalised the schedule.\n\n" + MARK,
      status: "OPEN", // status OPEN but past deadline → effectively closed
      commentsCloseAt: agoDays(2),
    },
  });

  console.log("\n✅ Created demo initiatives:");
  console.log(`   • ${open.title} (OPEN, closes in 7d) — 3 feedback + 1 committee reply + likes`);
  console.log(`   • ${open2.title} (OPEN, closes in 3d) — 1 feedback, by ${pick(0).name}`);
  console.log(`   • Diwali celebration plan 2025 (CLOSED — past deadline)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FAIL", e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
