import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageNewsletters } from "@/lib/roles";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!canManageNewsletters(session.user.roles)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const newsletters = await prisma.newsletter.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { sections: true } },
    },
  });

  return NextResponse.json({ newsletters });
}

export async function POST(request: Request) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const body = await request.json();
  const { title, edition } = body;

  if (!title?.trim()) {
    return NextResponse.json(
      { error: "Title is required" },
      { status: 400 }
    );
  }

  const newsletter = await prisma.newsletter.create({
    data: {
      title: title.trim(),
      edition: edition?.trim() || null,
    },
  });

  return NextResponse.json({ newsletter }, { status: 201 });
}
