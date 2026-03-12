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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;

  const newsletter = await prisma.newsletter.findUnique({
    where: { id },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!newsletter) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ newsletter });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const body = await request.json();
  const { title, edition, coverHtml, status } = body;

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title.trim();
  if (edition !== undefined) data.edition = edition?.trim() || null;
  if (coverHtml !== undefined) data.coverHtml = coverHtml;
  if (status !== undefined) {
    data.status = status;
    if (status === "published") {
      data.publishedAt = new Date();
    }
  }

  const newsletter = await prisma.newsletter.update({
    where: { id },
    data,
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json({ newsletter });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;

  await prisma.newsletter.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
