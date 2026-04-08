import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageAnnouncements } from "@/lib/roles";
import { generateGameCode } from "@/lib/tambola";

export const dynamic = "force-dynamic";

// POST — Create a new Tambola session (admin only)
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

  const { title } = await request.json();
  if (!title || typeof title !== "string")
    return NextResponse.json({ error: "Title is required" }, { status: 400 });

  // Generate unique 6-char code with retry on collision
  let code = generateGameCode();
  let attempts = 0;
  while (attempts < 10) {
    const existing = await prisma.tambolaSession.findUnique({ where: { code } });
    if (!existing) break;
    code = generateGameCode();
    attempts++;
  }
  if (attempts >= 10) {
    return NextResponse.json(
      { error: "Failed to generate unique code" },
      { status: 500 }
    );
  }

  const tambolaSession = await prisma.tambolaSession.create({
    data: {
      code,
      title: title.trim(),
      createdById: resident.id,
    },
  });

  return NextResponse.json({
    id: tambolaSession.id,
    code: tambolaSession.code,
    title: tambolaSession.title,
  });
}

// GET — List recent sessions (public)
export async function GET() {
  const sessions = await prisma.tambolaSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      _count: { select: { tickets: true } },
    },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      code: s.code,
      title: s.title,
      status: s.status,
      playerCount: s._count.tickets,
      createdAt: s.createdAt,
    })),
  });
}
