// List all quiz sessions ordered by creation time so we can find the
// one that was actually played last night.
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

async function main() {
  const sessions = await prisma.quizSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      quiz: { select: { title: true } },
      _count: { select: { players: true } },
      players: {
        orderBy: { score: "desc" },
        take: 1,
        select: { score: true },
      },
    },
  });

  if (sessions.length === 0) {
    console.log("No quiz sessions found.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Last ${sessions.length} sessions:\n`);
  console.log("Code    Status            Players  Top  Quiz                            Created");
  console.log("──────  ────────────────  ───────  ───  ──────────────────────────────  ──────────────────────");
  for (const s of sessions) {
    const code = s.code.padEnd(6, " ");
    const status = s.status.padEnd(16, " ");
    const players = String(s._count.players).padStart(7, " ");
    const top = String(s.players[0]?.score ?? 0).padStart(3, " ");
    const title = (s.quiz.title || "—").padEnd(30, " ").slice(0, 30);
    const when = s.createdAt.toISOString().replace("T", " ").slice(0, 19);
    console.log(`${code}  ${status}  ${players}  ${top}  ${title}  ${when}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
