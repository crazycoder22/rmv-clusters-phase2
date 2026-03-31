import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find the 8 MyGate polls (they have "MyGate" or "mygate" in title/description)
  const myGatePolls = await prisma.poll.findMany({
    where: {
      OR: [
        { title: { contains: "MyGate", mode: "insensitive" } },
        { title: { contains: "block do you belong", mode: "insensitive" } },
        { description: { contains: "MyGate", mode: "insensitive" } },
      ],
      surveyId: null, // Only unlinked polls
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, createdById: true, deadline: true, isAnonymous: true },
  });

  if (myGatePolls.length === 0) {
    console.log("No MyGate polls found to link.");
    process.exit(0);
  }

  console.log(`Found ${myGatePolls.length} MyGate polls:`);
  myGatePolls.forEach((p, i) => console.log(`  ${i + 1}. ${p.title}`));

  // Create the survey
  const firstPoll = myGatePolls[0];
  const survey = await prisma.survey.create({
    data: {
      title: "MyGate Adoption Survey",
      description:
        "Help us understand how residents are using MyGate for maintenance payments, visitor approvals, and issue tracking. Your responses will help us plan better onboarding and support.",
      deadline: firstPoll.deadline,
      isAnonymous: firstPoll.isAnonymous,
      createdById: firstPoll.createdById,
    },
  });

  console.log(`\nCreated survey: ${survey.title} (${survey.id})`);

  // Link all polls to the survey with sort order
  for (let i = 0; i < myGatePolls.length; i++) {
    await prisma.poll.update({
      where: { id: myGatePolls[i].id },
      data: { surveyId: survey.id, sortOrder: i },
    });
    console.log(`  ✓ Linked: ${myGatePolls[i].title}`);
  }

  console.log(`\nDone! Survey accessible at /surveys/${survey.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
