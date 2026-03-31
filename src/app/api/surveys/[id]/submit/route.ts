import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { answers } = body;
  // answers: { [pollId]: string[] (optionIds) }

  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "Answers are required" }, { status: 400 });
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, isApproved: true },
  });
  if (!resident || !resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
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

  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }
  if (survey.status !== "ACTIVE") {
    return NextResponse.json({ error: "Survey is closed" }, { status: 400 });
  }
  if (new Date(survey.deadline) < new Date()) {
    return NextResponse.json(
      { error: "Survey deadline has passed" },
      { status: 400 }
    );
  }

  // Validate and create votes for each question
  const votesToCreate: { pollId: string; pollOptionId: string; residentId: string }[] = [];

  for (const poll of survey.polls) {
    const selectedOptions: string[] = answers[poll.id] || [];
    if (selectedOptions.length === 0) {
      // Skip unanswered questions (allow partial submission)
      continue;
    }

    // Validate type
    if (poll.type === "SINGLE" && selectedOptions.length !== 1) {
      return NextResponse.json(
        { error: `Question "${poll.title}" allows only one answer` },
        { status: 400 }
      );
    }

    // Validate option IDs
    const validOptionIds = new Set(poll.options.map((o) => o.id));
    for (const oid of selectedOptions) {
      if (!validOptionIds.has(oid)) {
        return NextResponse.json(
          { error: "Invalid option selected" },
          { status: 400 }
        );
      }
      votesToCreate.push({
        pollId: poll.id,
        pollOptionId: oid,
        residentId: resident.id,
      });
    }
  }

  if (votesToCreate.length === 0) {
    return NextResponse.json(
      { error: "Please answer at least one question" },
      { status: 400 }
    );
  }

  // Check for existing votes and skip already-answered questions
  const existingVotes = await prisma.pollVote.findMany({
    where: {
      residentId: resident.id,
      pollId: { in: votesToCreate.map((v) => v.pollId) },
    },
    select: { pollId: true },
  });
  const alreadyVotedPolls = new Set(existingVotes.map((v) => v.pollId));

  const newVotes = votesToCreate.filter(
    (v) => !alreadyVotedPolls.has(v.pollId)
  );

  if (newVotes.length > 0) {
    await prisma.$transaction(
      newVotes.map((v) =>
        prisma.pollVote.create({ data: v })
      )
    );
  }

  return NextResponse.json({ success: true, votesCreated: newVotes.length });
}
