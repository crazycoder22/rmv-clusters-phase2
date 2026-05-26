import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageAnnouncements } from "@/lib/roles";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// GET — List quizzes (admin).
// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAnnouncements(me.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const quizzes = await prisma.quiz.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questions: true, sessions: true } },
    },
  });

  return NextResponse.json({ quizzes });
}

// POST — Create a quiz (admin).
// Accepts NextAuth cookie (web) or `Authorization: Bearer <jwt>` (mobile).
export async function POST(request: Request) {
  const resident = await getAuthedResident(request);
  if (!resident)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAnnouncements(resident.roles))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
