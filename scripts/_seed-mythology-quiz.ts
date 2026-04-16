// Seed script: Creates an "Indian Mythology" quiz from the JSON bank.
// Run: npx tsx scripts/_seed-mythology-quiz.ts
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";
import questions from "./indian-mythology.json";

const QUIZ_TITLE = "Indian Mythology — How Well Do You Know?";
const QUIZ_DESCRIPTION =
  "50 questions on Ramayana, Mahabharata, Hindu gods, Puranas, and more. Test your knowledge of ancient India!";
const TIME_LIMIT_SECS = 15;

async function main() {
  const creator = await prisma.resident.findFirst({
    where: { roles: { some: { name: "SUPERADMIN" } } },
    select: { id: true, name: true },
  });

  if (!creator) {
    console.error("No SUPERADMIN resident found.");
    process.exit(1);
  }

  console.log(`Quiz creator: ${creator.name} (${creator.id})`);

  const existing = await prisma.quiz.findFirst({
    where: { title: QUIZ_TITLE },
  });

  if (existing) {
    console.log(`Quiz "${QUIZ_TITLE}" already exists (id: ${existing.id}). Skipping.`);
    console.log("Delete it from /admin/quiz if you want to re-seed.");
    await prisma.$disconnect();
    return;
  }

  const quiz = await prisma.quiz.create({
    data: {
      title: QUIZ_TITLE,
      description: QUIZ_DESCRIPTION,
      createdById: creator.id,
    },
  });

  console.log(`Created quiz: ${quiz.id}`);

  const data = questions.map(
    (q: { question: string; options: string[]; correct: number }, i: number) => ({
      quizId: quiz.id,
      questionText: q.question,
      options: JSON.stringify(q.options),
      correctIndex: q.correct,
      timeLimitSecs: TIME_LIMIT_SECS,
      sortOrder: i,
    })
  );

  await prisma.quizQuestion.createMany({ data });

  console.log(`Inserted ${data.length} questions.`);
  console.log(`\nDone! Go to /admin/quiz to start a session from "${QUIZ_TITLE}".`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
