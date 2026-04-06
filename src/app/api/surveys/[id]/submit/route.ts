import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;
  const body = await request.json();
  const { answers, guestName, guestEmail, guestBlock, guestFlat, guestPhone } = body;
  // answers: { [pollId]: string[] (optionIds) }

  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "Answers are required" }, { status: 400 });
  }

  // Determine if resident or guest
  let residentId: string | null = null;
  let isGuest = false;

  if (session?.user?.email) {
    const resident = await prisma.resident.findUnique({
      where: { email: session.user.email },
      select: { id: true, isApproved: true },
    });
    if (resident?.isApproved) {
      residentId = resident.id;
    }
  }

  if (!residentId) {
    // Guest path — require name, email, block, flat
    if (!guestName?.trim())
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!guestEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail))
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    if (!guestBlock || ![1, 2, 3, 4].includes(Number(guestBlock)))
      return NextResponse.json({ error: "Valid block is required" }, { status: 400 });
    if (!guestFlat?.trim())
      return NextResponse.json({ error: "Flat number is required" }, { status: 400 });
    isGuest = true;
  }

  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      polls: {
        orderBy: { sortOrder: "asc" },
        include: { options: { select: { id: true } } },
      },
    },
  });

  if (!survey) return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  if (survey.status !== "ACTIVE") return NextResponse.json({ error: "Survey is closed" }, { status: 400 });
  if (new Date(survey.deadline) < new Date())
    return NextResponse.json({ error: "Survey deadline has passed" }, { status: 400 });

  // For guests: prevent duplicate submission by email per poll
  if (isGuest) {
    const pollIds = survey.polls.map((p) => p.id);
    const existing = await prisma.pollVote.findFirst({
      where: { guestEmail: guestEmail.trim().toLowerCase(), pollId: { in: pollIds } },
    });
    if (existing) {
      return NextResponse.json({ error: "You have already submitted this survey" }, { status: 409 });
    }
  }

  // Build votes
  const votesToCreate: {
    pollId: string;
    pollOptionId: string;
    residentId?: string;
    guestName?: string;
    guestEmail?: string;
    guestBlock?: number;
    guestFlat?: string;
    guestPhone?: string;
  }[] = [];

  for (const poll of survey.polls) {
    const selectedOptions: string[] = answers[poll.id] || [];
    if (selectedOptions.length === 0) continue;

    if (poll.type === "SINGLE" && selectedOptions.length !== 1) {
      return NextResponse.json(
        { error: `Question "${poll.title}" allows only one answer` },
        { status: 400 }
      );
    }

    const validOptionIds = new Set(poll.options.map((o) => o.id));
    for (const oid of selectedOptions) {
      if (!validOptionIds.has(oid))
        return NextResponse.json({ error: "Invalid option selected" }, { status: 400 });

      votesToCreate.push({
        pollId: poll.id,
        pollOptionId: oid,
        ...(residentId
          ? { residentId }
          : {
              guestName: guestName.trim(),
              guestEmail: guestEmail.trim().toLowerCase(),
              guestBlock: Number(guestBlock),
              guestFlat: guestFlat.trim(),
              guestPhone: guestPhone?.trim() || null,
            }),
      });
    }
  }

  if (votesToCreate.length === 0) {
    return NextResponse.json({ error: "Please answer at least one question" }, { status: 400 });
  }

  // For residents: skip already-voted polls
  if (residentId) {
    const existingVotes = await prisma.pollVote.findMany({
      where: { residentId, pollId: { in: votesToCreate.map((v) => v.pollId) } },
      select: { pollId: true },
    });
    const alreadyVotedPolls = new Set(existingVotes.map((v) => v.pollId));
    const newVotes = votesToCreate.filter((v) => !alreadyVotedPolls.has(v.pollId));
    if (newVotes.length > 0) {
      await prisma.$transaction(newVotes.map((v) => prisma.pollVote.create({ data: v })));
    }
    return NextResponse.json({ success: true, votesCreated: newVotes.length });
  }

  // Guests: create all votes
  await prisma.$transaction(votesToCreate.map((v) => prisma.pollVote.create({ data: v })));
  return NextResponse.json({ success: true, votesCreated: votesToCreate.length });
}
