import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManagePolls } from "@/lib/roles";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManagePolls(session.user.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

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
                    select: { name: true, block: true, flatNumber: true, email: true },
                  },
                },
                orderBy: { createdAt: "asc" },
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

  // Count unique respondents (residents + guests by email)
  const respondentSet = new Set<string>();
  for (const poll of survey.polls) {
    for (const opt of poll.options) {
      for (const v of opt.votes) {
        if (v.residentId) respondentSet.add(`r:${v.residentId}`);
        else if (v.guestEmail) respondentSet.add(`g:${v.guestEmail}`);
      }
    }
  }

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
        voters: opt.votes.map((v) => ({
          name: v.resident?.name ?? v.guestName ?? "Unknown",
          block: v.resident?.block ?? v.guestBlock ?? 0,
          flat: v.resident?.flatNumber ?? v.guestFlat ?? "",
          email: v.resident?.email ?? v.guestEmail ?? "",
          isGuest: !v.residentId,
          votedAt: v.createdAt,
        })),
      })),
    };
  });

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
    totalRespondents: respondentSet.size,
    isClosed,
  });
}
