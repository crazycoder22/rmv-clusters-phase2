import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManagePolls } from "@/lib/roles";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!resident) {
    return NextResponse.json({ error: "Not registered" }, { status: 403 });
  }

  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, block: true, flatNumber: true } },
      polls: {
        orderBy: { sortOrder: "asc" },
        include: {
          options: {
            orderBy: { sortOrder: "asc" },
            include: {
              _count: { select: { votes: true } },
              votes: {
                include: {
                  resident: {
                    select: { name: true, block: true, flatNumber: true },
                  },
                },
              },
            },
          },
          _count: { select: { votes: true } },
        },
      },
    },
  });

  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  // Get current user's votes for all polls in this survey
  const myVotes = await prisma.pollVote.findMany({
    where: {
      residentId: resident.id,
      pollId: { in: survey.polls.map((p) => p.id) },
    },
    select: { pollId: true, pollOptionId: true },
  });

  const myVotesByPoll: Record<string, string[]> = {};
  for (const v of myVotes) {
    if (!myVotesByPoll[v.pollId]) myVotesByPoll[v.pollId] = [];
    myVotesByPoll[v.pollId].push(v.pollOptionId);
  }

  // Format polls with results
  const questions = survey.polls.map((poll) => {
    const totalOptionVotes = poll.options.reduce(
      (sum, o) => sum + o._count.votes,
      0
    );
    return {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      type: poll.type,
      sortOrder: poll.sortOrder,
      totalVotes: poll._count.votes,
      totalOptionVotes,
      options: poll.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        sortOrder: opt.sortOrder,
        voteCount: opt._count.votes,
        voters: survey.isAnonymous
          ? []
          : opt.votes.map((v) => v.resident),
      })),
      myVotes: myVotesByPoll[poll.id] || [],
    };
  });

  // Check if user has completed the survey (voted on all questions)
  const hasCompleted = survey.polls.every(
    (p) => (myVotesByPoll[p.id] || []).length > 0
  );

  const isExpired = new Date(survey.deadline) < new Date();
  const isClosed = survey.status === "CLOSED" || isExpired;

  return NextResponse.json({
    survey: {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      isAnonymous: survey.isAnonymous,
      deadline: survey.deadline,
      status: survey.status,
      createdBy: survey.createdBy,
      createdAt: survey.createdAt,
      questionCount: survey.polls.length,
    },
    questions,
    hasCompleted,
    isClosed,
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
  if (description !== undefined)
    data.description = description?.trim() || null;
  if (deadline !== undefined) data.deadline = new Date(deadline);
  if (status !== undefined) {
    data.status = status;
    // Also close all child polls
    if (status === "CLOSED") {
      await prisma.poll.updateMany({
        where: { surveyId: id },
        data: { status: "CLOSED" },
      });
    }
  }

  const survey = await prisma.survey.update({
    where: { id },
    data,
  });

  return NextResponse.json({ survey });
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
  await prisma.survey.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
