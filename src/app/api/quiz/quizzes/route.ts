import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageAnnouncements } from "@/lib/roles";

export const dynamic = "force-dynamic";

// GET — List quizzes (admin)
export async function GET() {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAnnouncements(session.user.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const quizzes = await prisma.quiz.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questions: true, sessions: true } },
    },
  });

  return NextResponse.json({ quizzes });
}

// POST — Create a quiz (admin)
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

  const { title, description } = await request.json();
  if (!title?.trim())
    return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const quiz = await prisma.quiz.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      createdById: resident.id,
    },
  });

  return NextResponse.json({ quiz });
}
