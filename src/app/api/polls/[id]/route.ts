import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManagePolls } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resident = await getAuthedResident(request);
  if (!resident) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const poll = await prisma.poll.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, block: true, flatNumber: true } },
      options: {
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { votes: true } },
          votes: {
            include: {
              resident: { select: { name: true, block: true, flatNumber: true } },
            },
          },
        },
      },
      _count: { select: { votes: true } },
    },
  });

  if (!poll) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }

  // Get current user's votes
  const myVotes = await prisma.pollVote.findMany({
    where: { pollId: id, residentId: resident.id },
    select: { pollOptionId: true },
  });

  // Strip voter details if anonymous
  const options = poll.options.map((opt) => ({
    id: opt.id,
    text: opt.text,
    sortOrder: opt.sortOrder,
    voteCount: opt._count.votes,
    voters: poll.isAnonymous ? [] : opt.votes.map((v) => v.resident),
  }));

  return NextResponse.json({
    poll: {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      type: poll.type,
      isAnonymous: poll.isAnonymous,
      deadline: poll.deadline,
      status: poll.status,
      createdBy: poll.createdBy,
      createdAt: poll.createdAt,
      totalVotes: poll._count.votes,
      options,
    },
    myVotes: myVotes.map((v) => v.pollOptionId),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManagePolls(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { title, description, deadline, status } = body;

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (deadline !== undefined) data.deadline = new Date(deadline);
  if (status !== undefined) data.status = status;

  const poll = await prisma.poll.update({
    where: { id },
    data,
  });

  return NextResponse.json({ poll });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManagePolls(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  await prisma.poll.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
