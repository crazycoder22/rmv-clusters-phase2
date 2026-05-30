// Quick read: list players who joined a given quiz session.
// Usage: npx tsx scripts/_check-quiz-session.ts <CODE>
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

async function main() {
  const code = (process.argv[2] || "").toUpperCase();
  if (!code) {
    console.error("Usage: npx tsx scripts/_check-quiz-session.ts <CODE>");
    process.exit(1);
  }

  const session = await prisma.quizSession.findUnique({
    where: { code },
    include: {
      quiz: { select: { title: true } },
      players: {
        include: {
          player: {
            select: { name: true, block: true, flatNumber: true, email: true },
          },
        },
        orderBy: { score: "desc" },
      },
    },
  });

  if (!session) {
    console.log(`No quiz session found with code "${code}".`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\nSession: ${code} — ${session.quiz.title}`);
  console.log(`Status: ${session.status}`);
  console.log(`Created: ${session.createdAt.toISOString()}`);
  console.log(`Current question idx: ${session.currentQuestionIdx}`);
  console.log(`Players: ${session.players.length}\n`);

  if (session.players.length === 0) {
    console.log("(No players have joined yet.)");
  } else {
    console.log("Rank  Score  Name                      Block/Flat");
    console.log("────  ─────  ────────────────────────  ──────────");
    session.players.forEach((p, i) => {
      const rank = String(i + 1).padStart(2, " ");
      const score = String(p.score).padStart(5, " ");
      const name = (p.player.name || "—").padEnd(24, " ").slice(0, 24);
      const where = `B${p.player.block} ${p.player.flatNumber}`;
      console.log(`  ${rank}  ${score}  ${name}  ${where}`);
    });
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
