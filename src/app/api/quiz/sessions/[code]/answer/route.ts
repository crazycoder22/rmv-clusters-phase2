import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePoints } from "@/lib/quiz";

export const dynamic = "force-dynamic";

// POST — Submit an answer
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { playerId, questionId, answerIndex } = await request.json();

  if (!playerId || !questionId || answerIndex === undefined)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const session = await prisma.quizSession.findUnique({
    where: { code },
    include: {
      quiz: {
        include: { questions: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!session)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "ACTIVE")
    return NextResponse.json({ error: "No active question" }, { status: 400 });

  // Find the current question
  const question = session.quiz.questions[session.currentQuestionIdx];
  if (!question || question.id !== questionId)
    return NextResponse.json({ error: "Wrong question" }, { status: 400 });

  // Find the quiz player
  const quizPlayer = await prisma.quizPlayer.findUnique({
    where: { sessionId_playerId: { sessionId: session.id, playerId } },
  });
  if (!quizPlayer)
    return NextResponse.json({ error: "Not joined" }, { status: 400 });

  // Check if already answered
  const existing = await prisma.quizAnswer.findUnique({
    where: {
      quizPlayerId_questionId: {
        quizPlayerId: quizPlayer.id,
        questionId: question.id,
      },
    },
  });
  if (existing)
    return NextResponse.json({ error: "Already answered" }, { status: 400 });

  // Check time limit
  const now = Date.now();
  const startedAt = session.questionStartedAt?.getTime() ?? now;
  const responseMs = now - startedAt;
  const timeLimitMs = question.timeLimitSecs * 1000;

  if (responseMs > timeLimitMs + 2000) {
    // 2s grace period for network latency
    return NextResponse.json({ error: "Time expired" }, { status: 400 });
  }

  const isCorrect = answerIndex === question.correctIndex;
  const points = calculatePoints(responseMs, question.timeLimitSecs, isCorrect);

  // Create answer and update score
  await prisma.$transaction([
    prisma.quizAnswer.create({
      data: {
        quizPlayerId: quizPlayer.id,
        questionId: question.id,
        answerIndex,
        isCorrect,
        responseMs,
        points,
      },
    }),
    prisma.quizPlayer.update({
      where: { id: quizPlayer.id },
      data: { score: { increment: points } },
    }),
  ]);

  return NextResponse.json({ points, isCorrect });
}
