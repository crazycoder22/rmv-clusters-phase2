// Read-only: dump a survey's polls, options and vote tallies.
// Usage: npx tsx scripts/_check-survey.ts <SURVEY_ID>
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import { prisma } from "../src/lib/prisma";

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: npx tsx scripts/_check-survey.ts <SURVEY_ID>");
    process.exit(1);
  }

  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      polls: {
        orderBy: { sortOrder: "asc" },
        include: {
          options: {
            orderBy: { sortOrder: "asc" },
            include: {
              _count: { select: { votes: true } },
            },
          },
          _count: { select: { votes: true } },
        },
      },
    },
  });

  if (!survey) {
    console.log(`No survey with id "${id}".`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\nSurvey: ${survey.title}`);
  if (survey.description) console.log(`Description: ${survey.description}`);
  console.log(`Status: ${survey.status}  |  Anonymous: ${survey.isAnonymous}`);
  console.log(`Deadline: ${survey.deadline.toISOString()}`);
  console.log(`Created by: ${survey.createdBy.name} on ${survey.createdAt.toISOString()}`);
  console.log(`Polls: ${survey.polls.length}`);

  // Uniqueness — distinct resident/guest voters across all polls.
  // (One "respondent" may vote on every poll; this is the count of unique people.)
  const allVotes = await prisma.pollVote.findMany({
    where: { poll: { surveyId: survey.id } },
    select: { residentId: true, guestEmail: true, guestPhone: true, guestName: true },
  });
  const respondentKeys = new Set<string>();
  let residentCount = 0;
  let guestCount = 0;
  for (const v of allVotes) {
    if (v.residentId) {
      if (!respondentKeys.has("r:" + v.residentId)) residentCount += 1;
      respondentKeys.add("r:" + v.residentId);
    } else {
      const gKey = "g:" + (v.guestEmail || v.guestPhone || v.guestName || "anon");
      if (!respondentKeys.has(gKey)) guestCount += 1;
      respondentKeys.add(gKey);
    }
  }
  console.log(`\nUnique respondents: ${respondentKeys.size} (residents: ${residentCount}, guests: ${guestCount})`);

  // Per-poll breakdown.
  for (const p of survey.polls) {
    const total = p._count.votes;
    console.log(`\n─── Q${p.sortOrder + 1}: ${p.title} ───`);
    if (p.description) console.log(`   ${p.description}`);
    console.log(`   type=${p.type}  status=${p.status}  total votes=${total}`);

    if (p.options.length === 0) {
      console.log(`   (no options)`);
      continue;
    }

    const maxCount = Math.max(...p.options.map((o) => o._count.votes));
    for (const o of p.options) {
      const count = o._count.votes;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const barLen = maxCount > 0 ? Math.round((count / maxCount) * 30) : 0;
      const bar = "█".repeat(barLen) + "░".repeat(30 - barLen);
      const label = o.text.length > 50 ? o.text.slice(0, 47) + "…" : o.text;
      console.log(
        `   ${bar}  ${String(count).padStart(3)}  (${String(pct).padStart(2)}%)  ${label}`
      );
    }
  }

  console.log(`\nCSV export: /api/admin/surveys/${survey.id}?format=csv (if supported)\n`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
