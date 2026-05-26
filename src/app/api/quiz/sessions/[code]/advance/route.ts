import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// POST — Advance to next question or show results (admin).
// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const me = await getAuthedResident(request);
  if (!me)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAnnouncements(me.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action } = await request.json();
  // action: "next" | "show_results"

  const session = await prisma.quizSession.findUnique({
    where: { code },
    include: {
      quiz: { include: { _count: { select: { questions: true } } } },
    },
  });

  if (!session)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const totalQuestions = session.quiz._count.questions;

  if (action === "show_results") {
    // Show results for current question
    await prisma.quizSession.update({
      where: { id: session.id },
      data: { status: "SHOWING_RESULTS" },
    });
    return NextResponse.json({ status: "SHOWING_RESULTS" });
  }

  // action === "next" — advance to next question
  const nextIdx = session.currentQuestionIdx + 1;

  if (nextIdx >= totalQuestions) {
    // Quiz is over
    await prisma.quizSession.update({
      where: { id: session.id },
      data: { status: "COMPLETED", currentQuestionIdx: nextIdx },
    });
    return NextResponse.json({ status: "COMPLETED" });
  }

  await prisma.quizSession.update({
    where: { id: session.id },
    data: {
      currentQuestionIdx: nextIdx,
      questionStartedAt: new Date(),
      status: "ACTIVE",
    },
  });

  return NextResponse.json({
    status: "ACTIVE",
    currentQuestionIdx: nextIdx,
  });
}
