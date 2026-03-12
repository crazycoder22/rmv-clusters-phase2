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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdmin();
  if ("error" in check && check.error) return check.error;

  const { id } = await params;
  const body = await request.json();
  const { type, title, contentHtml, authorName, authorBlock, authorFlat } = body;

  if (!type || !title?.trim()) {
    return NextResponse.json(
      { error: "Type and title are required" },
      { status: 400 }
    );
  }

  // Get next sort order
  const maxSort = await prisma.newsletterSection.aggregate({
    where: { newsletterId: id },
    _max: { sortOrder: true },
  });
  const nextSortOrder = (maxSort._max.sortOrder ?? -1) + 1;

  const section = await prisma.newsletterSection.create({
    data: {
      newsletterId: id,
      type,
      title: title.trim(),
      contentHtml: contentHtml || "",
      authorName: authorName?.trim() || null,
      authorBlock: authorBlock || null,
      authorFlat: authorFlat?.trim() || null,
      sortOrder: nextSortOrder,
    },
  });

  return NextResponse.json({ section }, { status: 201 });
}
