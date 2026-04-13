import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageAnnouncements } from "@/lib/roles";

export const dynamic = "force-dynamic";

// GET — Get quiz with questions
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
      _count: { select: { sessions: true } },
    },
  });

  if (!quiz)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ quiz });
}

// PUT — Update quiz + questions
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAnnouncements(session.user.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, description, questions } = await request.json();

  // Update quiz metadata
  await prisma.quiz.update({
    where: { id },
    data: { title: title?.trim(), description: description?.trim() || null },
  });

  // If questions provided, replace all
  if (Array.isArray(questions)) {
    // Delete existing questions
    await prisma.quizQuestion.deleteMany({ where: { quizId: id } });

    // Create new questions
    if (questions.length > 0) {
      await prisma.quizQuestion.createMany({
        data: questions.map(
          (
            q: {
              questionText: string;
              options: string[];
              correctIndex: number;
              timeLimitSecs?: number;
            },
            i: number
          ) => ({
            quizId: id,
            questionText: q.questionText,
            options: JSON.stringify(q.options),
            correctIndex: q.correctIndex,
            timeLimitSecs: q.timeLimitSecs ?? 20,
            sortOrder: i,
          })
        ),
      });
    }
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ quiz });
}

// DELETE — Delete quiz
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAnnouncements(session.user.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.quiz.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
