// One-off cleanup: delete every QuizSession (and the cascading
// QuizPlayer + QuizAnswer rows) so the lobby is clean for tonight's
// Bollywood quiz. Quiz definitions (the question banks) and admin
// stats are untouched — only sessions go.
//
// Run: npx tsx scripts/_clear-quiz-sessions.ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

async function main() {
  const before = await prisma.quizSession.findMany({
    select: { id: true, code: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (before.length === 0) {
    console.log("No quiz sessions to clear.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${before.length} quiz session(s):`);
  for (const s of before) {
    console.log(`  • ${s.code} — ${s.status} — ${s.createdAt.toISOString()}`);
  }

  // Cascade: QuizSession → QuizPlayer (onDelete Cascade) → QuizAnswer
  // (onDelete Cascade). One delete clears everything.
  const result = await prisma.quizSession.deleteMany({});
  console.log(`\n✓ Deleted ${result.count} session(s) and all related players/answers.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
