// Seed script: Creates a "Bollywood Dialogues" quiz from the JSON bank.
//
// Run: npx tsx scripts/_seed-bollywood-quiz.ts
//
// Pre-requisite: your email must exist in the Resident table as an admin.
// The script will find the first Resident with SUPER_ADMIN role to use as
// the quiz creator, or fall back to the first Resident if none found.
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";
import dialogues from "./bollywood-dialogues.json";

const QUIZ_TITLE = "Bollywood Dialogues — Guess the Movie!";
const QUIZ_DESCRIPTION =
  "Famous Hindi movie dialogues. Can you name the movie? 50 iconic lines from the 1970s to the 2020s.";
const TIME_LIMIT_SECS = 15; // seconds per question

async function main() {
  // Find a resident to be the quiz creator (prefer superadmin)
  const creator = await prisma.resident.findFirst({
    where: { roles: { some: { name: "SUPERADMIN" } } },
    select: { id: true, name: true },
  });

  if (!creator) {
    console.error(
      "No SUPERADMIN resident found. Need at least one to assign as quiz creator."
    );
    process.exit(1);
  }

  console.log(`Quiz creator: ${creator.name} (${creator.id})`);

  // Check if quiz already exists
  const existing = await prisma.quiz.findFirst({
    where: { title: QUIZ_TITLE },
  });

  if (existing) {
    console.log(
      `Quiz "${QUIZ_TITLE}" already exists (id: ${existing.id}). Skipping creation.`
    );
    console.log("Delete it first from /admin/quiz if you want to re-seed.");
    await prisma.$disconnect();
    return;
  }

  // Create the quiz
  const quiz = await prisma.quiz.create({
    data: {
      title: QUIZ_TITLE,
      description: QUIZ_DESCRIPTION,
      createdById: creator.id,
    },
  });

  console.log(`Created quiz: ${quiz.id}`);

  // Create questions
  const questionData = dialogues.map(
    (d: { dialogue: string; options: string[]; correct: number; year: number }, i: number) => ({
      quizId: quiz.id,
      questionText: `"${d.dialogue}"`,
      options: JSON.stringify(d.options),
      correctIndex: d.correct,
      timeLimitSecs: TIME_LIMIT_SECS,
      sortOrder: i,
    })
  );

  await prisma.quizQuestion.createMany({ data: questionData });

  console.log(`Inserted ${questionData.length} questions.`);
  console.log(
    `\nDone! Go to /admin/quiz to start a session from "${QUIZ_TITLE}".`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
