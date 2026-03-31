import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
const deadline = new Date(Date.now() + TWO_WEEKS);

const polls = [
  {
    title: "Which block do you belong to?",
    description:
      "This helps us segment survey responses by block. Please select your block.",
    type: "SINGLE",
    isAnonymous: false,
    options: ["Block 1", "Block 2", "Block 3", "Block 4"],
  },
  {
    title: "Have you installed the MyGate app?",
    description:
      "We want to understand MyGate adoption across the community.",
    type: "SINGLE",
    isAnonymous: false,
    options: [
      "Yes, actively using it",
      "Yes, but rarely use it",
      "No, haven't installed it",
      "Didn't know about it",
    ],
  },
  {
    title: "Do you use MyGate for visitor approvals?",
    description:
      "MyGate allows you to approve or reject visitors directly from the app instead of waiting for a phone call from security.",
    type: "SINGLE",
    isAnonymous: false,
    options: [
      "Yes, I approve/reject all visitors via MyGate",
      "Sometimes, but I also rely on security calling me",
      "No, I prefer the security guard to call me",
      "Not aware of this feature",
    ],
  },
  {
    title: "Do you use MyGate for raising complaints/issues?",
    description:
      "MyGate has a feature to raise and track maintenance complaints and issues within the community.",
    type: "SINGLE",
    isAnonymous: false,
    options: [
      "Yes, regularly",
      "Tried it once or twice",
      "No, I use other channels (WhatsApp, in-person)",
      "Not aware of this feature",
    ],
  },
  {
    title: "Do you use MyGate for paying maintenance?",
    description:
      "Maintenance payment via MyGate is currently enabled for select blocks and will be rolled out to others soon.",
    type: "SINGLE",
    isAnonymous: false,
    options: [
      "Yes, I pay maintenance through MyGate",
      "Not yet, but I plan to start",
      "No, I prefer bank transfer / cash / cheque",
      "Maintenance payment is not enabled for my block yet",
    ],
  },
  {
    title: "What challenges have you faced with MyGate?",
    description:
      "Select all issues you've experienced. This helps us address common problems and improve the experience.",
    type: "MULTIPLE",
    isAnonymous: false,
    options: [
      "App is confusing / hard to navigate",
      "Notifications are too frequent / annoying",
      "Visitor approval doesn't work reliably",
      "Payment process is not smooth",
      "Don't trust online payments through the app",
      "No issues, it works well for me",
      "Haven't used it enough to comment",
    ],
  },
  {
    title: "Do you need help with MyGate installation or onboarding?",
    description:
      "We're planning a help desk session to assist residents with MyGate setup. This will help us estimate the turnout and plan accordingly.",
    type: "SINGLE",
    isAnonymous: false,
    options: [
      "Yes, I need help installing the app",
      "Yes, I need help understanding how to use it",
      "Yes, I need help with both installation and usage",
      "No, I'm comfortable using it already",
      "Not interested in using MyGate",
    ],
  },
  {
    title: "Overall, how would you rate your MyGate experience?",
    description:
      "Your feedback helps us decide the direction for MyGate adoption across all blocks.",
    type: "SINGLE",
    isAnonymous: false,
    options: [
      "Excellent — makes life much easier",
      "Good — useful but has room for improvement",
      "Average — use it occasionally",
      "Poor — too many issues",
      "Haven't used it enough to rate",
    ],
  },
];

async function main() {
  // Find an admin to attribute the polls to
  const admin = await prisma.resident.findFirst({
    where: { roles: { some: { name: { in: ["ADMIN", "SUPERADMIN"] } } } },
    select: { id: true, name: true },
  });

  if (!admin) {
    console.error("No admin resident found. Please create one first.");
    process.exit(1);
  }

  console.log(`Creating polls as: ${admin.name} (${admin.id})\n`);

  // Get all approved residents for notifications
  const residents = await prisma.resident.findMany({
    where: { isApproved: true },
    select: { id: true },
  });

  for (const pollData of polls) {
    const poll = await prisma.poll.create({
      data: {
        title: pollData.title,
        description: pollData.description,
        type: pollData.type,
        isAnonymous: pollData.isAnonymous,
        deadline,
        createdById: admin.id,
        options: {
          create: pollData.options.map((text, i) => ({
            text,
            sortOrder: i,
          })),
        },
      },
    });

    // Send notifications
    if (residents.length > 0) {
      await prisma.notification.createMany({
        data: residents.map((r) => ({
          residentId: r.id,
          pollId: poll.id,
          message: `New survey: ${poll.title}`,
        })),
        skipDuplicates: true,
      });
    }

    console.log(`✓ Created: ${poll.title}`);
  }

  console.log(`\nDone! ${polls.length} polls created with deadline: ${deadline.toLocaleDateString()}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
