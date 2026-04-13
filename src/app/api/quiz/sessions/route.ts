import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageAnnouncements } from "@/lib/roles";
import { generateQuizCode } from "@/lib/quiz";

export const dynamic = "force-dynamic";

// POST — Create a live quiz session
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAnnouncements(session.user.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const resident = await prisma.resident.findUnique({
    where: { email: session.user.email },
  });
  if (!resident)
    return NextResponse.json({ error: "Resident not found" }, { status: 404 });

  const { quizId } = await request.json();
  if (!quizId)
    return NextResponse.json({ error: "quizId required" }, { status: 400 });

  // Verify quiz exists and has questions
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { _count: { select: { questions: true } } },
  });
  if (!quiz)
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  if (quiz._count.questions === 0)
    return NextResponse.json(
      { error: "Quiz has no questions" },
      { status: 400 }
    );

  // Generate unique code
  let code = generateQuizCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await prisma.quizSession.findUnique({ where: { code } });
    if (!existing) break;
    code = generateQuizCode();
    attempts++;
  }

  const quizSession = await prisma.quizSession.create({
    data: {
      code,
      quizId,
      createdById: resident.id,
    },
  });

  return NextResponse.json({
    id: quizSession.id,
    code: quizSession.code,
  });
}

// GET — List recent sessions
export async function GET() {
  const sessions = await prisma.quizSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      quiz: { select: { title: true } },
      _count: { select: { players: true } },
    },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      code: s.code,
      quizTitle: s.quiz.title,
      status: s.status,
      playerCount: s._count.players,
      createdAt: s.createdAt,
    })),
  });
}
