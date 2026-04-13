import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET — Polling endpoint for game state
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get("playerId");

  const session = await prisma.quizSession.findUnique({
    where: { code },
    include: {
      quiz: {
        include: {
          questions: { orderBy: { sortOrder: "asc" } },
        },
      },
      players: {
        include: {
          player: { select: { name: true, block: true } },
        },
        orderBy: { score: "desc" },
      },
      _count: { select: { players: true } },
    },
  });

  if (!session)
    return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const totalQuestions = session.quiz.questions.length;
  const currentQuestion =
    session.currentQuestionIdx >= 0 &&
    session.currentQuestionIdx < totalQuestions
      ? session.quiz.questions[session.currentQuestionIdx]
      : null;

  // Build leaderboard (top 10 + current player)
  const leaderboard = session.players.slice(0, 10).map((p, i) => ({
    rank: i + 1,
    name: p.player.name,
    block: p.player.block,
    score: p.score,
    playerId: p.playerId,
  }));

  // Build response
  const result: Record<string, unknown> = {
    id: session.id,
    code: session.code,
    quizTitle: session.quiz.title,
    status: session.status,
    currentQuestionIdx: session.currentQuestionIdx,
    totalQuestions,
    playerCount: session._count.players,
    leaderboard,
    updatedAt: session.updatedAt,
  };

  // Include current question (without correct answer for players)
  if (currentQuestion && session.status === "ACTIVE") {
    result.question = {
      id: currentQuestion.id,
      text: currentQuestion.questionText,
      options: JSON.parse(currentQuestion.options),
      timeLimitSecs: currentQuestion.timeLimitSecs,
    };
    result.questionStartedAt = session.questionStartedAt;
  }

  // If showing results, include correct answer
  if (currentQuestion && session.status === "SHOWING_RESULTS") {
    result.question = {
      id: currentQuestion.id,
      text: currentQuestion.questionText,
      options: JSON.parse(currentQuestion.options),
      timeLimitSecs: currentQuestion.timeLimitSecs,
      correctIndex: currentQuestion.correctIndex,
    };

    // Count answers per option
    const answers = await prisma.quizAnswer.findMany({
      where: { questionId: currentQuestion.id },
    });
    const answerCounts = [0, 0, 0, 0];
    answers.forEach((a) => {
      if (a.answerIndex >= 0 && a.answerIndex < 4) answerCounts[a.answerIndex]++;
    });
    result.answerCounts = answerCounts;
    result.totalAnswers = answers.length;
  }

  // Player-specific data
  if (playerId) {
    const quizPlayer = await prisma.quizPlayer.findUnique({
      where: { sessionId_playerId: { sessionId: session.id, playerId } },
      include: { answers: true },
    });
    if (quizPlayer) {
      result.playerScore = quizPlayer.score;
      result.playerRank =
        session.players.findIndex((p) => p.playerId === playerId) + 1;
      result.hasAnswered = currentQuestion
        ? quizPlayer.answers.some((a) => a.questionId === currentQuestion.id)
        : false;
      // Include the player's answer for results screen
      if (currentQuestion) {
        const playerAnswer = quizPlayer.answers.find(
          (a) => a.questionId === currentQuestion.id
        );
        if (playerAnswer) {
          result.playerAnswer = {
            answerIndex: playerAnswer.answerIndex,
            isCorrect: playerAnswer.isCorrect,
            points: playerAnswer.points,
          };
        }
      }
    } else {
      result.hasJoined = false;
    }
  }

  return NextResponse.json(result);
}
