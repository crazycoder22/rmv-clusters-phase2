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
  const { optionIds } = body;

  if (!optionIds || !Array.isArray(optionIds) || optionIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one option" },
      { status: 400 }
    );
  }

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true, isApproved: true },
  });
  if (!resident || !resident.isApproved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const poll = await prisma.poll.findUnique({
    where: { id },
    include: { options: { select: { id: true } } },
  });
  if (!poll) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }
  if (poll.status !== "ACTIVE") {
    return NextResponse.json({ error: "Poll is closed" }, { status: 400 });
  }
  if (new Date(poll.deadline) < new Date()) {
    return NextResponse.json({ error: "Poll deadline has passed" }, { status: 400 });
  }

  // Validate poll type
  if (poll.type === "SINGLE" && optionIds.length !== 1) {
    return NextResponse.json(
      { error: "Select exactly one option for this poll" },
      { status: 400 }
    );
  }

  // Validate all optionIds belong to this poll
  const validOptionIds = new Set(poll.options.map((o) => o.id));
  for (const oid of optionIds) {
    if (!validOptionIds.has(oid)) {
      return NextResponse.json({ error: "Invalid option" }, { status: 400 });
    }
  }

  // Check if already voted
  const existingVote = await prisma.pollVote.findFirst({
    where: { pollId: id, residentId: resident.id },
  });
  if (existingVote) {
    return NextResponse.json(
      { error: "You have already voted on this poll" },
      { status: 400 }
    );
  }

  // Cast votes
  await prisma.$transaction(
    optionIds.map((optionId: string) =>
      prisma.pollVote.create({
        data: {
          pollId: id,
          pollOptionId: optionId,
          residentId: resident.id,
        },
      })
    )
  );

  // Return updated results
  const updatedOptions = await prisma.pollOption.findMany({
    where: { pollId: id },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { votes: true } } },
  });

  return NextResponse.json({
    success: true,
    options: updatedOptions.map((o) => ({
      id: o.id,
      text: o.text,
      voteCount: o._count.votes,
    })),
  });
}
