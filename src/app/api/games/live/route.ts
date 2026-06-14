import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthedResident } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// GET /api/games/live — currently-running quiz / tambola sessions a resident can
// jump into. Powers the "Live now" banner on the Games page. Dual auth; returns
// an empty list for anonymous callers (no banner). "Live" = not COMPLETED.
export async function GET(request: Request) {
  const me = await getAuthedResident(request);
  if (!me) return NextResponse.json({ live: [] });

  const [quiz, tambola] = await Promise.all([
    prisma.quizSession.findFirst({
      where: { status: { in: ["WAITING", "ACTIVE", "SHOWING_RESULTS"] } },
      orderBy: { createdAt: "desc" },
      include: { quiz: { select: { title: true } }, _count: { select: { players: true } } },
    }),
    prisma.tambolaSession.findFirst({
      where: { status: { in: ["WAITING", "ACTIVE"] } },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { tickets: true } } },
    }),
  ]);

  const live: Array<{
    kind: "quiz" | "tambola";
    code: string;
    title: string;
    status: string;
    players: number;
  }> = [];

  if (quiz) {
    live.push({ kind: "quiz", code: quiz.code, title: quiz.quiz.title || "Quiz Night", status: quiz.status, players: quiz._count.players });
  }
  if (tambola) {
    live.push({ kind: "tambola", code: tambola.code, title: tambola.title || "Tambola", status: tambola.status, players: tambola._count.tickets });
  }

  return NextResponse.json({ live });
}
